import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// POST /api/usuarios/ubicacion - Actualizar la ubicación actual del usuario en sesión
router.post('/ubicacion', async (req: AuthRequest, res: Response) => {
  const { lat, lng } = req.body;
  const id_usuario = req.user?.id_usuario;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Las coordenadas lat y lng son obligatorias.'
    });
  }

  try {
    await pool.query(
      `UPDATE usuarios 
       SET latitud_actual = $1, longitud_actual = $2, ultima_ubicacion = CURRENT_TIMESTAMP 
       WHERE id_usuario = $3`,
      [lat, lng, id_usuario]
    );

    res.status(200).json({
      status: 'success',
      message: 'Ubicación actualizada correctamente.'
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar la ubicación.',
      error: error.message
    });
  }
});

// A partir de aquí, todos los endpoints requieren rol de ADMIN
router.use(requireRole(['ADMIN']));

// GET /api/usuarios/ubicaciones - Obtener ubicaciones de todos los cobradores activos (Solo ADMIN)
router.get('/ubicaciones', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id_usuario as id, nombre, email, latitud_actual as lat, longitud_actual as lng, 
              ultima_ubicacion::text as "ultimaUbicacion"
       FROM usuarios 
       WHERE rol = 'COBRADOR' AND latitud_actual IS NOT NULL
       ORDER BY nombre ASC`
    );
    res.status(200).json({
      status: 'success',
      data: result.rows
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las ubicaciones de los cobradores.',
      error: error.message
    });
  }
});

// GET /api/usuarios - Obtener todos los usuarios del sistema
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id_usuario as id, nombre, email, rol, estado, fecha_creacion::text as "fechaCreacion"
       FROM usuarios 
       ORDER BY id_usuario ASC`
    );
    res.status(200).json({
      status: 'success',
      data: result.rows
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los usuarios del sistema.',
      error: error.message
    });
  }
});

// POST /api/usuarios - Crear un nuevo usuario del sistema
router.post('/', async (req: AuthRequest, res: Response) => {
  const { nombre, email, password, rol } = req.body;

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({
      status: 'error',
      message: 'Todos los campos (nombre, email, password, rol) son obligatorios.'
    });
  }

  if (rol !== 'ADMIN' && rol !== 'COBRADOR') {
    return res.status(400).json({
      status: 'error',
      message: 'El rol debe ser ADMIN o COBRADOR.'
    });
  }

  try {
    // Validar duplicado
    const checkEmail = await pool.query('SELECT id_usuario FROM usuarios WHERE email = $1', [email]);
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Ya existe un usuario registrado con ese correo electrónico.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, estado) 
       VALUES ($1, $2, $3, $4, TRUE) 
       RETURNING id_usuario as id, nombre, email, rol, estado`,
      [nombre, email, hash, rol]
    );

    res.status(201).json({
      status: 'success',
      message: 'Usuario creado exitosamente.',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al crear el usuario.',
      error: error.message
    });
  }
});

// PUT /api/usuarios/:id - Actualizar datos de un usuario
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { nombre, email, rol, estado, password } = req.body;

  if (!nombre || !email || !rol || estado === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Los campos nombre, email, rol y estado son obligatorios.'
    });
  }

  try {
    // Validar si el usuario existe
    const userCheck = await pool.query('SELECT password_hash FROM usuarios WHERE id_usuario = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado.'
      });
    }

    let finalHash = userCheck.rows[0].password_hash;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      finalHash = await bcrypt.hash(password, salt);
    }

    const result = await pool.query(
      `UPDATE usuarios 
       SET nombre = $1, email = $2, rol = $3, estado = $4, password_hash = $5 
       WHERE id_usuario = $6 
       RETURNING id_usuario as id, nombre, email, rol, estado`,
      [nombre, email, rol, estado, finalHash, id]
    );

    res.status(200).json({
      status: 'success',
      message: 'Usuario actualizado exitosamente.',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar el usuario.',
      error: error.message
    });
  }
});

// DELETE /api/usuarios/:id - Eliminar un usuario del sistema
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    // Evitar que el administrador se elimine a sí mismo
    if (req.user && req.user.id_usuario === Number(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'No puedes eliminar tu propio usuario en sesión.'
      });
    }

    const result = await pool.query('DELETE FROM usuarios WHERE id_usuario = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Usuario eliminado exitosamente.',
      data: { id: Number(id) }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar el usuario.',
      error: error.message
    });
  }
});

export default router;
