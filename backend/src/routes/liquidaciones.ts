import { Router, Response } from 'express';
import pool from '../config/db';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/liquidaciones
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const queryStr = `
      SELECT 
        l.id_liquidacion as id,
        l.id_cobrador as "cobradorId",
        u.nombre as cobrador,
        l.fecha::text as fecha,
        l.total_recaudado::float as "totalRecaudado",
        l.total_gastos::float as "totalGastos",
        l.efectivo_entregado::float as "efectivoEntregado",
        l.diferencia::float as diferencia,
        l.estado,
        l.notas
      FROM liquidaciones l
      JOIN usuarios u ON l.id_cobrador = u.id_usuario
      ORDER BY l.fecha DESC, l.id_liquidacion DESC;
    `;
    const result = await pool.query(queryStr);
    res.status(200).json({
      status: 'success',
      data: result.rows
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las liquidaciones.',
      error: error.message
    });
  }
});

// GET /api/liquidaciones/previsualizar?cobradorId=X&fecha=YYYY-MM-DD
router.get('/previsualizar', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { cobradorId, fecha } = req.query;

  if (!cobradorId || !fecha) {
    return res.status(400).json({
      status: 'error',
      message: 'El id del cobrador y la fecha son parámetros obligatorios.'
    });
  }

  try {
    // 1. Suma de pagos
    const pagosResult = await pool.query(
      `SELECT COALESCE(SUM(monto_pagado), 0)::float as total 
       FROM pagos 
       WHERE id_cobrador = $1 AND fecha_hora::date = $2`,
      [cobradorId, fecha]
    );

    // 2. Suma de gastos
    const gastosResult = await pool.query(
      `SELECT COALESCE(SUM(monto), 0)::float as total 
       FROM gastos 
       WHERE id_cobrador = $1 AND fecha = $2`,
      [cobradorId, fecha]
    );

    // 3. Detalle de pagos (desglose)
    const pagosDetalleResult = await pool.query(
      `SELECT p.id_pago as id, p.monto_pagado as monto, p.tipo_pago as tipo, c.nombre as cliente_nombre 
       FROM pagos p
       LEFT JOIN creditos cr ON p.id_credito = cr.id_credito
       LEFT JOIN clientes c ON cr.id_cliente = c.id_cliente
       WHERE p.id_cobrador = $1 AND p.fecha_hora::date = $2`,
      [cobradorId, fecha]
    );

    // 4. Detalle de gastos (desglose)
    const gastosDetalleResult = await pool.query(
      `SELECT id_gasto as id, descripcion, monto 
       FROM gastos 
       WHERE id_cobrador = $1 AND fecha = $2`,
      [cobradorId, fecha]
    );

    const totalRecaudado = pagosResult.rows[0].total;
    const totalGastos = gastosResult.rows[0].total;
    const efectivoEsperado = Math.max(0, totalRecaudado - totalGastos);

    res.status(200).json({
      status: 'success',
      data: {
        cobradorId: Number(cobradorId),
        fecha: String(fecha),
        totalRecaudado,
        totalGastos,
        efectivoEsperado,
        pagosDetalle: pagosDetalleResult.rows,
        gastosDetalle: gastosDetalleResult.rows
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al previsualizar la liquidación.',
      error: error.message
    });
  }
});

// POST /api/liquidaciones (Solo ADMIN)
router.post('/', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { cobradorId, fecha, totalRecaudado, totalGastos, efectivoEntregado, notas, estado } = req.body;

  if (!cobradorId || !fecha || totalRecaudado === undefined || totalGastos === undefined || efectivoEntregado === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Faltan parámetros obligatorios para registrar la liquidación.'
    });
  }

  const recaudo = parseFloat(totalRecaudado);
  const gastos = parseFloat(totalGastos);
  const entregado = parseFloat(efectivoEntregado);
  const esperado = recaudo - gastos;
  const diferencia = entregado - esperado;

  try {
    // Verificar si ya existe liquidación para ese cobrador en esa fecha
    const dupCheck = await pool.query(
      'SELECT id_liquidacion FROM liquidaciones WHERE id_cobrador = $1 AND fecha = $2',
      [cobradorId, fecha]
    );

    if (dupCheck.rows.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe un registro de liquidación para este cobrador en la fecha indicada.'
      });
    }

    const queryStr = `
      INSERT INTO liquidaciones 
        (id_cobrador, fecha, total_recaudado, total_gastos, efectivo_entregado, diferencia, estado, notas) 
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *;
    `;

    const result = await pool.query(queryStr, [
      cobradorId,
      fecha,
      recaudo,
      gastos,
      entregado,
      diferencia,
      estado || 'PENDIENTE',
      notas || ''
    ]);

    res.status(201).json({
      status: 'success',
      message: 'Liquidación registrada exitosamente.',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar la liquidación.',
      error: error.message
    });
  }
});

// PUT /api/liquidaciones/:id/aprobar (Solo ADMIN)
router.put('/:id/aprobar', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE liquidaciones 
       SET estado = 'APROBADO', notas = CONCAT(notas, '\n[Aprobado por Admin]') 
       WHERE id_liquidacion = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Liquidación no encontrada.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Liquidación aprobada exitosamente.',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al aprobar la liquidación.',
      error: error.message
    });
  }
});

export default router;
