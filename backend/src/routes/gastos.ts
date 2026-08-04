import { Router, Response } from 'express';
import pool from '../config/db';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/gastos
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const queryStr = `
      SELECT 
        g.id_gasto as id,
        g.id_cobrador as "cobradorId",
        u.nombre as cobrador,
        g.descripcion,
        g.monto::float as monto,
        g.fecha::text as fecha
      FROM gastos g
      JOIN usuarios u ON g.id_cobrador = u.id_usuario
      ORDER BY g.id_gasto DESC;
    `;
    const result = await pool.query(queryStr);
    res.status(200).json({
      status: 'success',
      data: result.rows
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los gastos.',
      error: error.message
    });
  }
});

// POST /api/gastos
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { descripcion, monto, cobradorId, fecha } = req.body;

  if (!descripcion || !monto) {
    return res.status(400).json({
      status: 'error',
      message: 'La descripción y el monto del gasto son obligatorios.'
    });
  }

  const montoNum = parseFloat(monto);
  if (isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'El monto debe ser un número positivo.'
    });
  }

  let finalCobradorId = cobradorId || (req.user ? req.user.id_usuario : null);
  if (!finalCobradorId) {
    return res.status(400).json({
      status: 'error',
      message: 'No se pudo identificar al cobrador que registra el gasto.'
    });
  }

  const d = new Date();
  const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const finalFecha = fecha || localDateStr;

  try {
    const result = await pool.query(
      `INSERT INTO gastos (id_cobrador, descripcion, monto, fecha) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [finalCobradorId, descripcion, montoNum, finalFecha]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar el gasto.',
      error: error.message
    });
  }
});

// DELETE /api/gastos/:id
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM gastos WHERE id_gasto = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Gasto no encontrado.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Gasto eliminado correctamente.',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar el gasto.',
      error: error.message
    });
  }
});

export default router;
