import { Router, Response } from 'express';
import pool from '../config/db';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/clientes
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const queryStr = `
      SELECT 
        c.id_cliente as id,
        c.documento,
        c.nombre,
        c.telefono,
        c.direccion,
        c.id_ruta as "rutaId",
        COALESCE(r.nombre_ruta, 'Sin Ruta') as "rutaNombre"
      FROM clientes c
      LEFT JOIN rutas r ON c.id_ruta = r.id_ruta
      ORDER BY c.nombre ASC;
    `;
    const result = await pool.query(queryStr);
    res.status(200).json({
      status: 'success',
      data: result.rows
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los clientes.',
      error: error.message
    });
  }
});

// POST /api/clientes
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { documento, nombre, telefono, direccion, rutaId } = req.body;

  if (!documento || !nombre || !telefono || !direccion || !rutaId) {
    return res.status(400).json({
      status: 'error',
      message: 'Todos los campos (documento, nombre, telefono, direccion, rutaId) son obligatorios.'
    });
  }

  try {
    // Validar si el cliente ya existe
    const docCheck = await pool.query('SELECT id_cliente FROM clientes WHERE documento = $1', [documento]);
    if (docCheck.rows.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe un cliente registrado con ese documento de identidad.'
      });
    }

    const result = await pool.query(
      `INSERT INTO clientes (documento, nombre, telefono, direccion, id_ruta) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [documento, nombre, telefono, direccion, rutaId]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al crear el cliente.',
      error: error.message
    });
  }
});

// PUT /api/clientes/:id (Solo ADMIN)
router.put('/:id', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { documento, nombre, telefono, direccion, rutaId } = req.body;

  if (!documento || !nombre || !telefono || !direccion || !rutaId) {
    return res.status(400).json({
      status: 'error',
      message: 'Todos los campos son obligatorios.'
    });
  }

  try {
    const result = await pool.query(
      `UPDATE clientes 
       SET documento = $1, nombre = $2, telefono = $3, direccion = $4, id_ruta = $5 
       WHERE id_cliente = $6 
       RETURNING *`,
      [documento, nombre, telefono, direccion, rutaId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Cliente no encontrado.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Cliente actualizado exitosamente.',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar el cliente.',
      error: error.message
    });
  }
});

// DELETE /api/clientes/:id (Solo ADMIN)
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM clientes WHERE id_cliente = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Cliente no encontrado.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Cliente eliminado exitosamente.',
      data: { id: Number(id) }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar el cliente. Verifique que no tenga créditos asociados.',
      error: error.message
    });
  }
});

export default router;
