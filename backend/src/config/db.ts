import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false, // Required for serverless databases like Neon
      },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'zenu_admin',
      password: process.env.DB_PASSWORD || 'zenu_secure_pass',
      database: process.env.DB_NAME || 'zenu_db',
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('Conexión con PostgreSQL establecida con éxito.');
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de clientes de base de datos:', err);
});

// Helper para ejecutar consultas rápidas
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

// Helper para actualizar los estados de créditos a ACTIVO, MORA o PAGADO basado en la regla de las 24 horas (gota-gota)
export const actualizarEstadosCreditos = async () => {
  const updateQuery = `
    WITH ultimo_pago AS (
      SELECT id_credito, MAX(fecha_hora) as ultima_fecha
      FROM pagos
      GROUP BY id_credito
    )
    UPDATE creditos cr
    SET estado = CASE 
      WHEN cr.saldo_pendiente <= 0 THEN 'PAGADO'
      WHEN COALESCE(up.ultima_fecha, cr.fecha_desembolso) < NOW() - INTERVAL '24 hours' THEN 'MORA'
      ELSE 'ACTIVO'
    END
    FROM creditos c2
    LEFT JOIN ultimo_pago up ON c2.id_credito = up.id_credito
    WHERE cr.id_credito = c2.id_credito AND cr.estado != 'PAGADO';
  `;
  await pool.query(updateQuery);
};

export default pool;
