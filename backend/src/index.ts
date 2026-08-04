import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pool from './config/db';

// Importar rutas
import authRouter from './routes/auth';
import rutasRouter from './routes/rutas';
import clientesRouter from './routes/clientes';
import creditosRouter from './routes/creditos';
import pagosRouter from './routes/pagos';
import gastosRouter from './routes/gastos';
import liquidacionesRouter from './routes/liquidaciones';
import dashboardRouter from './routes/dashboard';
import usuariosRouter from './routes/usuarios';
import { iniciarRespaldoScheduler } from './services/backupService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares globales de seguridad
app.use(helmet()); // Blindaje de cabeceras de respuesta HTTP

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // Máximo 500 peticiones por IP cada 15 minutos
  message: {
    status: 'error',
    message: 'Demasiadas peticiones desde esta IP, por favor intente de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(generalLimiter); // Límite contra ataques DoS/inundación de red

app.use(cors());
app.use(express.json());

// Registrar rutas de la API
app.use('/api/auth', authRouter);
app.use('/api/rutas', rutasRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/creditos', creditosRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/gastos', gastosRouter);
app.use('/api/liquidaciones', liquidacionesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/usuarios', usuariosRouter);

// Endpoint de salud del servidor (Health Check)
app.get('/api/health', async (req, res) => {
  try {
    // Verificar conexión activa con PostgreSQL
    const dbCheck = await pool.query('SELECT NOW() as db_time');
    res.status(200).json({
      status: 'success',
      message: 'Zenu API activa y conectada a PostgreSQL',
      db_time: dbCheck.rows[0].db_time,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Zenu API activa pero sin conexión con la base de datos',
      error: error.message,
      timestamp: new Date()
    });
  }
});

// Manejo de rutas inexistentes (404)
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Ruta no encontrada'
  });
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` ZENU MICROCRÉDITOS - API SERVER         `);
  console.log(` Servidor corriendo en puerto: ${PORT}    `);
  console.log(` Entorno: ${process.env.NODE_ENV}         `);
  console.log(`=========================================`);
  
  // Inicializar cron de respaldos
  iniciarRespaldoScheduler();
});

