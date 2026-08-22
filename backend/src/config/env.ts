import dotenv from 'dotenv';
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'zenu_prod_secure_jwt_token_key_2026_xyz';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const PORT = process.env.PORT || 5000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
