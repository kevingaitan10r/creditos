import pool from '../config/db';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

// Configurar transportador de correo desde variables de entorno
const getMailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: (process.env.SMTP_PASS || '').replace(/\s+/g, '') // Eliminar espacios en blanco comunes en contraseñas de app de Gmail
    }
  });
};

// Utilidad para convertir un array de objetos en un string CSV compatible con Excel (BOM + punto y coma)
const convertToCSV = (data: any[], headers: string[], keys: string[]) => {
  const csvRows = [];
  csvRows.push(headers.join(';'));
  
  data.forEach(row => {
    const values = keys.map(key => {
      const val = row[key];
      if (val === null || val === undefined) return '';
      const cleanVal = String(val).replace(/"/g, '""');
      return cleanVal.includes(';') || cleanVal.includes('\n') || cleanVal.includes('"') 
        ? `"${cleanVal}"` 
        : cleanVal;
    });
    csvRows.push(values.join(';'));
  });
  
  return '\uFEFF' + csvRows.join('\r\n'); // Retornar con UTF-8 BOM y saltos CRLF para Excel en Windows
};

export const obtenerDatosRespaldosCSV = async () => {
  // Consultar registros de todas las tablas
  const usuarios = await pool.query('SELECT id_usuario, nombre, email, rol, estado, fecha_creacion::text FROM usuarios ORDER BY id_usuario ASC');
  const rutas = await pool.query('SELECT id_ruta, nombre_ruta, fecha_creacion::text FROM rutas ORDER BY id_ruta ASC');
  const clientes = await pool.query('SELECT id_cliente, documento, nombre, telefono, direccion, id_ruta FROM clientes ORDER BY id_cliente ASC');
  const creditedQuery = await pool.query('SELECT id_credito, id_cliente, monto_prestado, tasa_interes, total_a_pagar, saldo_pendiente, valor_cuota, frecuencia_pago, fecha_desembolso::text, estado FROM creditos ORDER BY id_credito ASC');
  const pagos = await pool.query('SELECT id_pago, id_credito, id_cobrador, monto_pagado, tipo_pago, fecha_hora::text, latitud, longitud FROM pagos ORDER BY id_pago ASC');
  const gastos = await pool.query('SELECT id_gasto, id_cobrador, descripcion, monto, fecha::text FROM gastos ORDER BY id_gasto ASC');
  const liquidaciones = await pool.query('SELECT id_liquidacion, id_cobrador, fecha::text, total_recaudado, total_gastos, efectivo_entregado, diferencia, estado FROM liquidaciones ORDER BY id_liquidacion ASC');

  // Convertir a CSV (UTF-8 BOM y delimitador ;)
  const usuariosCsv = convertToCSV(
    usuarios.rows,
    ['ID Usuario', 'Nombre', 'Email', 'Rol', 'Estado', 'Fecha Registro'],
    ['id_usuario', 'nombre', 'email', 'rol', 'estado', 'fecha_creacion']
  );
  const rutasCsv = convertToCSV(
    rutas.rows,
    ['ID Ruta', 'Nombre Ruta', 'Fecha Creacion'],
    ['id_ruta', 'nombre_ruta', 'fecha_creacion']
  );
  const clientesCsv = convertToCSV(
    clientes.rows,
    ['ID Cliente', 'Documento', 'Nombre', 'Telefono', 'Direccion', 'ID Ruta'],
    ['id_cliente', 'documento', 'nombre', 'telefono', 'direccion', 'id_ruta']
  );
  const creditosCsv = convertToCSV(
    creditedQuery.rows,
    ['ID Credito', 'ID Cliente', 'Monto Prestado', 'Tasa Interes', 'Total a Pagar', 'Saldo Pendiente', 'Valor Cuota', 'Frecuencia', 'Fecha Desembolso', 'Estado'],
    ['id_credito', 'id_cliente', 'monto_prestado', 'tasa_interes', 'total_a_pagar', 'saldo_pendiente', 'valor_cuota', 'frecuencia_pago', 'fecha_desembolso', 'estado']
  );
  const pagosCsv = convertToCSV(
    pagos.rows,
    ['ID Pago', 'ID Credito', 'ID Cobrador', 'Monto Pagado', 'Tipo Pago', 'Fecha Hora', 'Latitud', 'Longitud'],
    ['id_pago', 'id_credito', 'id_cobrador', 'monto_pagado', 'tipo_pago', 'fecha_hora', 'latitud', 'longitud']
  );
  const gastosCsv = convertToCSV(
    gastos.rows,
    ['ID Gasto', 'ID Cobrador', 'Descripcion', 'Monto', 'Fecha'],
    ['id_gasto', 'id_cobrador', 'descripcion', 'monto', 'fecha']
  );
  const liquidacionesCsv = convertToCSV(
    liquidaciones.rows,
    ['ID Liquidacion', 'ID Cobrador', 'Fecha', 'Total Recaudado', 'Total Gastos', 'Efectivo Entregado', 'Diferencia', 'Estado'],
    ['id_liquidacion', 'id_cobrador', 'fecha', 'total_recaudado', 'total_gastos', 'efectivo_entregado', 'diferencia', 'estado']
  );

  return {
    usuariosCsv,
    rutasCsv,
    clientesCsv,
    creditosCsv,
    pagosCsv,
    gastosCsv,
    liquidacionesCsv
  };
};

export const generarYEnviarRespaldo = async () => {
  const mailUser = process.env.SMTP_USER;
  const mailPass = process.env.SMTP_PASS;

  if (!mailUser || !mailPass) {
    console.error('⚠️ [BACKUP CORREO] Configuración SMTP incompleta en el archivo .env. Saltando envío.');
    return { success: false, message: 'Configuración SMTP incompleta en el archivo .env.' };
  }

  try {
    console.log('🔄 [BACKUP CORREO] Iniciando generación de respaldos diários en CSV...');

    // 1. Obtener todos los correos de administradores activos
    const adminsQuery = await pool.query("SELECT email FROM usuarios WHERE rol = 'ADMIN' AND estado = TRUE");
    const adminEmails = adminsQuery.rows.map(r => r.email);

    if (adminEmails.length === 0) {
      console.warn('⚠️ [BACKUP CORREO] No se encontraron administradores activos en el sistema.');
      return { success: false, message: 'No se encontraron administradores activos.' };
    }

    // 2. Obtener datos estructurados en CSV
    const csvData = await obtenerDatosRespaldosCSV();

    // 3. Configurar adjuntos para el correo
    const fechaActual = new Date().toISOString().split('T')[0];
    const attachments = [
      { filename: '1_usuarios.csv', content: csvData.usuariosCsv },
      { filename: '2_rutas.csv', content: csvData.rutasCsv },
      { filename: '3_clientes.csv', content: csvData.clientesCsv },
      { filename: '4_creditos.csv', content: csvData.creditosCsv },
      { filename: '5_pagos.csv', content: csvData.pagosCsv },
      { filename: '6_gastos.csv', content: csvData.gastosCsv },
      { filename: '7_liquidaciones.csv', content: csvData.liquidacionesCsv }
    ];

    // 4. Enviar Correo
    const transporter = getMailTransporter();
    const mailOptions = {
      from: process.env.SMTP_FROM || `"Zenu Credits Backups" <${mailUser}>`,
      to: adminEmails.join(', '),
      subject: `Respaldo Diario Zenu Credits - ${fechaActual}`,
      text: `Adjunto a este correo encontrará las copias de seguridad de la base de datos de Zenu Credits en formato Excel (CSV) correspondientes al día de hoy, ${fechaActual}.\n\nSe incluyen las tablas de usuarios, rutas, clientes, créditos, pagos, gastos y cierres de caja diario.\n\nEste es un correo automático generado por el sistema a las 7:00 PM.`,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ [BACKUP CORREO] Respaldo diario enviado con éxito a:', adminEmails.join(', '), 'MessageId:', info.messageId);
    return { success: true, message: 'Copia de seguridad enviada con éxito.', info };
  } catch (error: any) {
    console.error('❌ [BACKUP CORREO] Error durante el proceso de respaldo por correo:', error);
    return { success: false, message: 'Error interno al generar/enviar el respaldo.', error: error.message };
  }
};

import { actualizarEstadosCreditos } from '../config/db';

// Inicializar el Cron Job para que corra respaldos a las 7:00 PM y recálculo de moras cada hora
export const iniciarRespaldoScheduler = () => {
  console.log('🗓️ [CRON JOB] Scheduler de respaldos y recálculo de moras activado.');
  
  // Enviar copia por correo a las 7:00 PM
  cron.schedule('0 19 * * *', async () => {
    console.log('⏰ [CRON JOB] Ejecutando envío automático de respaldo diario...');
    await generarYEnviarRespaldo();
  });

  // Actualizar moras y estados de créditos automáticamente cada hora
  cron.schedule('0 * * * *', async () => {
    try {
      await actualizarEstadosCreditos();
      console.log('⏰ [CRON JOB] Estados de cartera y mora actualizados correctamente.');
    } catch (err) {
      console.error('❌ [CRON JOB] Error al actualizar estados de cartera:', err);
    }
  });
};
