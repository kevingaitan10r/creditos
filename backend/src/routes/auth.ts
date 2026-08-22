import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from '../config/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env';

const router = Router();

// Limitador de fuerza bruta para inicio de sesión
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // Máximo 10 intentos por IP
  message: {
    status: 'error',
    message: 'Demasiados intentos fallidos. Por favor espere un minuto antes de intentar de nuevo.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Email y contraseña son obligatorios.'
    });
  }

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas.'
      });
    }

    const user = result.rows[0];

    // Verificar estado
    if (!user.estado) {
      return res.status(403).json({
        status: 'error',
        message: 'Usuario inactivo. Contacte al administrador.'
      });
    }

    // Comparar password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        status: 'error',
        message: 'Credenciales inválidas.'
      });
    }

    // Firmar Token
    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    res.status(200).json({
      status: 'success',
      data: {
        token,
        usuario: {
          id_usuario: user.id_usuario,
          nombre: user.nombre,
          email: user.email,
          rol: user.rol
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al iniciar sesión.',
      error: error.message
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'No autenticado.'
    });
  }

  try {
    const result = await pool.query(
      'SELECT id_usuario, nombre, email, rol, estado, fecha_creacion FROM usuarios WHERE id_usuario = $1',
      [req.user.id_usuario]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado.'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        usuario: result.rows[0]
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener datos del usuario.',
      error: error.message
    });
  }
});

export default router;
