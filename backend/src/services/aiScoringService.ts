import { GoogleGenAI } from '@google/genai';
import pool from '../config/db';
import { GEMINI_API_KEY } from '../config/env';

export interface EvaluacionRiesgoInput {
  clienteId: number;
  monto: number;
  tasa: number;
  cuotas: number;
  frecuencia: string;
}

export interface EvaluacionRiesgoOutput {
  score: number; // 0 a 100
  nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  decisionSugerida: 'APROBAR' | 'CONDICIONAR' | 'RECHAZAR';
  montoMaximoSugerido: number;
  factoresPositivos: string[];
  factoresRiesgo: string[];
  resumen: string;
  recomendaciones: string;
  origenAnalisis: 'GEMINI_AI' | 'HEURISTICA_AUTOMATICA';
}

/**
 * Recopila la información financiera histórica del cliente desde la base de datos
 */
async function recopilarHistorialCliente(clienteId: number) {
  // 1. Datos básicos del cliente
  const clientQuery = `
    SELECT 
      c.id_cliente,
      c.nombre,
      c.documento,
      c.telefono,
      c.direccion,
      c.fecha_creacion,
      r.nombre_ruta
    FROM clientes c
    LEFT JOIN rutas r ON c.id_ruta = r.id_ruta
    WHERE c.id_cliente = $1;
  `;
  const clientRes = await pool.query(clientQuery, [clienteId]);
  if (clientRes.rows.length === 0) {
    throw new Error('Cliente no encontrado');
  }
  const cliente = clientRes.rows[0];

  // 2. Historial de créditos
  const creditosQuery = `
    SELECT 
      id_credito,
      monto_prestado,
      tasa_interes,
      total_a_pagar,
      saldo_pendiente,
      valor_cuota,
      frecuencia_pago,
      fecha_desembolso,
      estado
    FROM creditos
    WHERE id_cliente = $1
    ORDER BY id_credito DESC;
  `;
  const creditosRes = await pool.query(creditosQuery, [clienteId]);
  const creditos = creditosRes.rows;

  // 3. Resumen de pagos
  const pagosQuery = `
    SELECT 
      p.id_credito,
      COUNT(p.id_pago) as total_cuotas_pagadas,
      COALESCE(SUM(p.monto_pagado), 0) as total_monto_pagado,
      MAX(p.fecha_hora) as fecha_ultimo_pago
    FROM pagos p
    JOIN creditos cr ON p.id_credito = cr.id_credito
    WHERE cr.id_cliente = $1
    GROUP BY p.id_credito;
  `;
  const pagosRes = await pool.query(pagosQuery, [clienteId]);
  const pagosMap = new Map();
  pagosRes.rows.forEach(r => pagosMap.set(r.id_credito, r));

  // Metadatos calculados
  const totalCreditos = creditos.length;
  const pagados = creditos.filter(c => c.estado === 'PAGADO').length;
  const enMora = creditos.filter(c => c.estado === 'MORA').length;
  const activos = creditos.filter(c => c.estado === 'ACTIVO').length;
  const saldoPendienteTotal = creditos.reduce((acc, c) => acc + parseFloat(c.saldo_pendiente || 0), 0);
  const montosPrevios = creditos.map(c => parseFloat(c.monto_prestado || 0));
  const montoMaximoPrevio = montosPrevios.length > 0 ? Math.max(...montosPrevios) : 0;

  return {
    cliente,
    creditos: creditos.map(c => ({
      ...c,
      monto_prestado: parseFloat(c.monto_prestado),
      saldo_pendiente: parseFloat(c.saldo_pendiente),
      total_a_pagar: parseFloat(c.total_a_pagar),
      valor_cuota: parseFloat(c.valor_cuota),
      pagos: pagosMap.get(c.id_credito) || { total_cuotas_pagadas: 0, total_monto_pagado: 0 }
    })),
    resumen: {
      totalCreditos,
      pagados,
      enMora,
      activos,
      saldoPendienteTotal,
      montoMaximoPrevio
    }
  };
}

/**
 * Motor heurístico de respaldo (si la API de Gemini no está configurada o se excede la cuota)
 */
function calcularScoringHeuristico(
  datos: any,
  input: EvaluacionRiesgoInput
): EvaluacionRiesgoOutput {
  const { resumen, cliente } = datos;
  let score = 65; // Base para clientes nuevos
  const factoresPositivos: string[] = [];
  const factoresRiesgo: string[] = [];

  if (resumen.totalCreditos === 0) {
    factoresRiesgo.push('Cliente nuevo sin historial crediticio previo registrado en el sistema.');
    if (input.monto <= 500000) {
      score += 5;
      factoresPositivos.push('El monto solicitado es moderado y prudente para un cliente inicial.');
    } else {
      score -= 10;
      factoresRiesgo.push('Monto elevado para ser su primera operación de crédito.');
    }
  } else {
    // Historial previo
    if (resumen.pagados > 0) {
      const bonoPagados = Math.min(25, resumen.pagados * 10);
      score += bonoPagados;
      factoresPositivos.push(`Cuenta con ${resumen.pagados} crédito(s) completado(s) y cancelado(s) exitosamente.`);
    }

    if (resumen.enMora > 0) {
      score -= (resumen.enMora * 35);
      factoresRiesgo.push(`Registra ${resumen.enMora} crédito(s) actualmente en MORA.`);
    }

    if (resumen.saldoPendienteTotal > 0) {
      score -= 15;
      factoresRiesgo.push(`Tiene un saldo pendiente acumulado de $${resumen.saldoPendienteTotal.toLocaleString()} COP en créditos vigentes.`);
    }

    if (input.monto <= resumen.montoMaximoPrevio * 1.3) {
      score += 10;
      factoresPositivos.push(`El monto solicitado ($${input.monto.toLocaleString()}) es coherente con su capacidad previa demostrada ($${resumen.montoMaximoPrevio.toLocaleString()}).`);
    } else if (input.monto > resumen.montoMaximoPrevio * 2) {
      score -= 15;
      factoresRiesgo.push(`El monto solicitado más que duplica el crédito más alto registrado previamente.`);
    }
  }

  // Normalizar score entre 0 y 100
  score = Math.max(5, Math.min(98, Math.round(score)));

  let nivelRiesgo: EvaluacionRiesgoOutput['nivelRiesgo'] = 'BAJO';
  let decisionSugerida: EvaluacionRiesgoOutput['decisionSugerida'] = 'APROBAR';

  if (score >= 75) {
    nivelRiesgo = 'BAJO';
    decisionSugerida = 'APROBAR';
  } else if (score >= 55) {
    nivelRiesgo = 'MEDIO';
    decisionSugerida = 'CONDICIONAR';
  } else if (score >= 35) {
    nivelRiesgo = 'ALTO';
    decisionSugerida = 'CONDICIONAR';
  } else {
    nivelRiesgo = 'CRITICO';
    decisionSugerida = 'RECHAZAR';
  }

  const montoMaximoSugerido = decisionSugerida === 'RECHAZAR' 
    ? 0 
    : (decisionSugerida === 'CONDICIONAR' ? Math.round(input.monto * 0.75 / 10000) * 10000 : input.monto);

  return {
    score,
    nivelRiesgo,
    decisionSugerida,
    montoMaximoSugerido,
    factoresPositivos,
    factoresRiesgo,
    resumen: `Evaluación basada en perfil del cliente ${cliente.nombre}. Score calculado: ${score}/100.`,
    recomendaciones: decisionSugerida === 'APROBAR'
      ? 'Aprobación recomendada. El comportamiento histórico respalda la solicitud.'
      : decisionSugerida === 'CONDICIONAR'
      ? 'Se sugiere reducir el monto desembolsado o solicitar abonos con menor intervalo.'
      : 'No se recomienda aprobar debido al alto riesgo de incumplimiento detectado.',
    origenAnalisis: 'HEURISTICA_AUTOMATICA'
  };
}

/**
 * Evaluación de Riesgo Principal utilizando Google Gemini API
 */
export async function evaluarRiesgoCrediticio(
  input: EvaluacionRiesgoInput
): Promise<EvaluacionRiesgoOutput> {
  const datosHistorial = await recopilarHistorialCliente(input.clienteId);

  // Si no hay API key configurada, usar heurística con mensaje informativo
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY no configurada. Utilizando motor heurístico de riesgo.');
    return calcularScoringHeuristico(datosHistorial, input);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const totalAPagarEstimado = Math.round(input.monto + (input.monto * (input.tasa / 100)));
    const cuotaEstimada = Math.round(totalAPagarEstimado / input.cuotas);

    const prompt = `
Eres un analista de riesgo crediticio experto en microfinanzas y créditos diarios/semanales de cobro en ruta.
Evalúa la siguiente solicitud de microcrédito y genera un dictamen financiero objetivo y estructurado en JSON.

INFORMACIÓN DEL CLIENTE:
- Nombre: ${datosHistorial.cliente.nombre}
- Documento: ${datosHistorial.cliente.documento}
- Ruta asignada: ${datosHistorial.cliente.nombre_ruta || 'Sin ruta'}
- Antigüedad: Registrado desde ${datosHistorial.cliente.fecha_creacion}

HISTORIAL EN LA PLATAFORMA:
- Créditos totales previos: ${datosHistorial.resumen.totalCreditos}
- Créditos finalizados y pagados: ${datosHistorial.resumen.pagados}
- Créditos en mora actualmente: ${datosHistorial.resumen.enMora}
- Créditos activos vigentes: ${datosHistorial.resumen.activos}
- Saldo de deuda pendiente actual: $${datosHistorial.resumen.saldoPendienteTotal} COP
- Monto máximo que ha pagado antes: $${datosHistorial.resumen.montoMaximoPrevio} COP
- Detalle créditos previos: ${JSON.stringify(datosHistorial.creditos.slice(0, 5))}

SOLICITUD ACTUAL:
- Monto solicitado: $${input.monto} COP
- Tasa de interés: ${input.tasa}%
- Frecuencia de pago: ${input.frecuencia}
- Número de cuotas: ${input.cuotas}
- Valor de cada cuota: $${cuotaEstimada} COP
- Total a pagar: $${totalAPagarEstimado} COP

REGLAS DE EVALUACIÓN:
1. Si el cliente tiene créditos en MORA o un saldo pendiente alto acumulado, el riesgo es ALTO o CRITICO y el score debe ser menor a 50.
2. Si es un cliente NUEVO (0 créditos), dale un score prudente (entre 60 y 72) y sugiere un monto acorde para probar cumplimiento.
3. Si es un cliente RECURRENTE con historial impecable de pagos, el score debe ser ALTO (80 a 98).
4. El montoMaximoSugerido debe ser un número entero en pesos colombianos (COP).
5. Retorna ÚNICAMENTE un objeto JSON válido con la siguiente estructura exacta:

{
  "score": number, // entero entre 0 y 100
  "nivelRiesgo": "BAJO" | "MEDIO" | "ALTO" | "CRITICO",
  "decisionSugerida": "APROBAR" | "CONDICIONAR" | "RECHAZAR",
  "montoMaximoSugerido": number,
  "factoresPositivos": ["factor 1", "factor 2"],
  "factoresRiesgo": ["factor 1", "factor 2"],
  "resumen": "resumen conciso de 1 a 2 oraciones para el administrador",
  "recomendaciones": "consejos prácticos para la aprobación o condiciones de cobro"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = response.text?.trim() || '';
    if (!responseText) {
      throw new Error('Respuesta vacía de Gemini');
    }

    const parsed = JSON.parse(responseText);

    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score || 60))),
      nivelRiesgo: parsed.nivelRiesgo || 'MEDIO',
      decisionSugerida: parsed.decisionSugerida || 'CONDICIONAR',
      montoMaximoSugerido: parsed.montoMaximoSugerido || input.monto,
      factoresPositivos: Array.isArray(parsed.factoresPositivos) ? parsed.factoresPositivos : [],
      factoresRiesgo: Array.isArray(parsed.factoresRiesgo) ? parsed.factoresRiesgo : [],
      resumen: parsed.resumen || 'Evaluación de riesgo generada por IA.',
      recomendaciones: parsed.recomendaciones || 'Revisar antecedentes antes de desembolsar.',
      origenAnalisis: 'GEMINI_AI'
    };
  } catch (error: any) {
    console.error('Error al invocar Gemini API para scoring:', error);
    // Fallback elegante a la heurística sin tumbar el servicio
    const fallback = calcularScoringHeuristico(datosHistorial, input);
    return fallback;
  }
}
