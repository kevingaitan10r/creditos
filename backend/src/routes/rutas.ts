import { Router, Response } from 'express';
import pool from '../config/db';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/rutas
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Consulta para obtener rutas con su cobrador y estadísticas del día actual
    const queryStr = `
      SELECT 
        r.id_ruta as id,
        r.nombre_ruta,
        r.id_cobrador as "cobradorId",
        COALESCE(u.nombre, 'Sin Asignar') as cobrador,
        COALESCE(
          (
            SELECT SUM(p.monto_pagado) 
            FROM pagos p 
            JOIN creditos cr ON p.id_credito = cr.id_credito
            JOIN clientes cl ON cr.id_cliente = cl.id_cliente
            WHERE cl.id_ruta = r.id_ruta AND p.fecha_hora::date = CURRENT_DATE
          ), 0
        )::float as recaudado,
        COALESCE(
          (
            SELECT SUM(cr.valor_cuota) 
            FROM creditos cr
            JOIN clientes cl ON cr.id_cliente = cl.id_cliente
            WHERE cl.id_ruta = r.id_ruta AND cr.estado IN ('ACTIVO', 'MORA')
          ), 0
        )::float as "totalEsperado"
      FROM rutas r
      LEFT JOIN usuarios u ON r.id_cobrador = u.id_usuario
      ORDER BY r.id_ruta ASC;
    `;

    const result = await pool.query(queryStr);
    
    // Calcular progreso para cada ruta
    const data = result.rows.map(row => {
      const progress = row.totalEsperado > 0 
        ? Math.min(Math.round((row.recaudado / row.totalEsperado) * 100), 100) 
        : 0;
      return {
        ...row,
        progress
      };
    });

    res.status(200).json({
      status: 'success',
      data
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las rutas.',
      error: error.message
    });
  }
});

// POST /api/rutas (Solo ADMIN)
router.post('/', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { nombre_ruta, id_cobrador } = req.body;

  if (!nombre_ruta) {
    return res.status(400).json({
      status: 'error',
      message: 'El nombre de la ruta es obligatorio.'
    });
  }

  try {
    const result = await pool.query(
      'INSERT INTO rutas (nombre_ruta, id_cobrador) VALUES ($1, $2) RETURNING *',
      [nombre_ruta, id_cobrador || null]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al crear la ruta.',
      error: error.message
    });
  }
});

// POST /api/rutas/asignar (Solo ADMIN)
router.post('/asignar', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { rutaId, cobradorId } = req.body;

  if (!rutaId) {
    return res.status(400).json({
      status: 'error',
      message: 'El id de la ruta es obligatorio.'
    });
  }

  try {
    // Validar si el cobrador existe y es COBRADOR
    if (cobradorId) {
      const userCheck = await pool.query('SELECT rol FROM usuarios WHERE id_usuario = $1', [cobradorId]);
      if (userCheck.rows.length === 0 || userCheck.rows[0].rol !== 'COBRADOR') {
        return res.status(400).json({
          status: 'error',
          message: 'El usuario asignado debe existir y tener el rol de COBRADOR.'
        });
      }
    }

    const result = await pool.query(
      'UPDATE rutas SET id_cobrador = $1 WHERE id_ruta = $2 RETURNING *',
      [cobradorId || null, rutaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Ruta no encontrada.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Cobrador asignado exitosamente.',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al asignar el cobrador.',
      error: error.message
    });
  }
});

export default router;
