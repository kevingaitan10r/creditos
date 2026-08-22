import { Router, Response } from 'express';
import pool from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/pagos
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const queryStr = `
      SELECT 
        p.id_pago as id,
        p.id_credito as "creditoId",
        cl.nombre as "clienteNombre",
        cl.telefono as "clienteTelefono",
        u.nombre as cobrador,
        p.monto_pagado as monto,
        p.tipo_pago as tipo,
        p.fecha_hora::text as fecha,
        p.latitud::float as lat,
        p.longitud::float as lng
      FROM pagos p
      JOIN creditos cr ON p.id_credito = cr.id_credito
      JOIN clientes cl ON cr.id_cliente = cl.id_cliente
      JOIN usuarios u ON p.id_cobrador = u.id_usuario
      ORDER BY p.id_pago DESC;
    `;
    const result = await pool.query(queryStr);
    
    // Parse numeric types
    const data = result.rows.map(row => ({
      ...row,
      monto: parseFloat(row.monto)
    }));

    res.status(200).json({
      status: 'success',
      data
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los pagos.',
      error: error.message
    });
  }
});

// POST /api/pagos
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { creditoId, monto, tipo, lat, lng, cobradorId } = req.body;

  if (!creditoId || !monto) {
    return res.status(400).json({
      status: 'error',
      message: 'El id del crédito y el monto son obligatorios.'
    });
  }

  const montoNum = parseFloat(monto);
  if (isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'El monto a pagar debe ser un número positivo.'
    });
  }

  // Determinar quién registra el cobro (Prevenir IDOR: Solo ADMIN puede asignar otro cobradorId)
  const userRole = req.user?.rol;
  let finalCobradorId = req.user?.id_usuario;

  if (userRole === 'ADMIN' && cobradorId) {
    finalCobradorId = Number(cobradorId);
  }

  if (!finalCobradorId) {
    return res.status(400).json({
      status: 'error',
      message: 'No se pudo identificar al cobrador que registra el pago.'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener datos actuales del crédito
    const creditCheck = await client.query(
      'SELECT id_credito, saldo_pendiente, estado FROM creditos WHERE id_credito = $1 FOR UPDATE',
      [creditoId]
    );

    if (creditCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Crédito no encontrado.'
      });
    }

    const credit = creditCheck.rows[0];
    if (credit.estado === 'PAGADO') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'Este crédito ya se encuentra pagado en su totalidad.'
      });
    }

    const saldoPendienteActual = parseFloat(credit.saldo_pendiente);
    
    // Si el abono supera al saldo pendiente, ajustar abono o devolver el resto
    // Para simplificar, permitimos abonar hasta el saldo pendiente exacto
    const montoEfectivoAbonar = Math.min(montoNum, saldoPendienteActual);
    const nuevoSaldoPendiente = Math.max(0, saldoPendienteActual - montoEfectivoAbonar);
    const nuevoEstado = nuevoSaldoPendiente <= 0 ? 'PAGADO' : 'ACTIVO';

    // 2. Insertar Pago
    const insertQuery = `
      INSERT INTO pagos (id_credito, id_cobrador, monto_pagado, tipo_pago, latitud, longitud) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *;
    `;
    const insertResult = await client.query(insertQuery, [
      creditoId,
      finalCobradorId,
      montoEfectivoAbonar,
      tipo || 'EFECTIVO',
      lat ? parseFloat(lat) : null,
      lng ? parseFloat(lng) : null
    ]);

    // 3. Actualizar Crédito
    await client.query(
      'UPDATE creditos SET saldo_pendiente = $1, estado = $2 WHERE id_credito = $3',
      [nuevoSaldoPendiente, nuevoEstado, creditoId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      status: 'success',
      message: 'Pago registrado exitosamente.',
      data: {
        pago: insertResult.rows[0],
        credito: {
          id_credito: creditoId,
          saldo_pendiente: nuevoSaldoPendiente,
          estado: nuevoEstado
        }
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar el pago.',
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
