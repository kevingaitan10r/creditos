import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id_usuario: number;
    nombre: string;
    email: string;
    rol: string;
  };
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Token de autenticación no proporcionado.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      return res.status(403).json({
        status: 'error',
        message: 'Token de autenticación inválido o expirado.'
      });
    }

    (req as AuthRequest).user = {
      id_usuario: decoded.id_usuario,
      nombre: decoded.nombre,
      email: decoded.email,
      rol: decoded.rol
    };

    next();
  });
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    if (!authReq.user || !roles.includes(authReq.user.rol)) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para realizar esta acción.'
      });
    }
    next();
  };
};
