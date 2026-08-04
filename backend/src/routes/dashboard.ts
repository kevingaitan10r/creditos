import { Router, Response } from 'express';
import pool, { actualizarEstadosCreditos } from '../config/db';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { generarYEnviarRespaldo, obtenerDatosRespaldosCSV } from '../services/backupService';
import AdmZip from 'adm-zip';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await actualizarEstadosCreditos();
    const statsQuery = `
      SELECT
        COALESCE(SUM(saldo_pendiente) FILTER (WHERE estado != 'PAGADO'), 0)::float as "totalCapitalEnCalle",
        COALESCE(SUM(monto_prestado), 0)::float as "totalPrestado",
        COALESCE(
          (SELECT SUM(monto_pagado) FROM pagos WHERE fecha_hora::date = CURRENT_DATE), 0
        )::float as "totalRecaudadoHoy",
        COALESCE(
          (SELECT COUNT(DISTINCT id_cliente) FROM creditos WHERE estado IN ('ACTIVO', 'MORA')), 0
        )::int as "clientesActivosCount",
        COALESCE(
          (SELECT COUNT(*) FROM clientes), 0
        )::int as "totalClientesCount",
        COALESCE(
          ROUND(
            (COUNT(id_credito) FILTER (WHERE estado = 'MORA') * 100.0) /
            NULLIF(COUNT(id_credito) FILTER (WHERE estado IN ('ACTIVO', 'MORA')), 0)
          ), 0
        )::int as "moraGlobalPercent"
      FROM creditos;
    `;

    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0] || {
      totalCapitalEnCalle: 0,
      totalPrestado: 0,
      totalRecaudadoHoy: 0,
      clientesActivosCount: 0,
      totalClientesCount: 0,
      moraGlobalPercent: 0
    };

    res.status(200).json({
      status: 'success',
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener estadísticas del dashboard.',
      error: error.message
    });
  }
});

// GET /api/dashboard/backup - Descargar respaldo ZIP con planillas Excel (CSV) de la base de datos (Solo ADMIN)
router.get('/backup', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const fechaActual = new Date().toISOString().split('T')[0];
    
    // Obtener datos estructurados en CSV
    const csvData = await obtenerDatosRespaldosCSV();

    // Crear un archivo ZIP en memoria
    const zip = new AdmZip();
    zip.addFile('1_usuarios.csv', Buffer.from(csvData.usuariosCsv, 'utf8'));
    zip.addFile('2_rutas.csv', Buffer.from(csvData.rutasCsv, 'utf8'));
    zip.addFile('3_clientes.csv', Buffer.from(csvData.clientesCsv, 'utf8'));
    zip.addFile('4_creditos.csv', Buffer.from(csvData.creditosCsv, 'utf8'));
    zip.addFile('5_pagos.csv', Buffer.from(csvData.pagosCsv, 'utf8'));
    zip.addFile('6_gastos.csv', Buffer.from(csvData.gastosCsv, 'utf8'));
    zip.addFile('7_liquidaciones.csv', Buffer.from(csvData.liquidacionesCsv, 'utf8'));

    const zipBuffer = zip.toBuffer();

    res.setHeader('Content-disposition', `attachment; filename=Zenu_Backup_${fechaActual}.zip`);
    res.setHeader('Content-type', 'application/zip');
    res.status(200).send(zipBuffer);
  } catch (error: any) {
    console.error('❌ Error al generar respaldo local en ZIP:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar la copia de seguridad de la base de datos en formato ZIP.',
      error: error.message
    });
  }
});

// POST /api/dashboard/backup/test-email - Forzar el envío manual de una copia de seguridad por correo (Solo ADMIN)
router.post('/backup/test-email', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const result = await generarYEnviarRespaldo();
    if (result.success) {
      res.status(200).json({
        status: 'success',
        message: 'Correo de prueba enviado correctamente con los respaldos adjuntos.',
        data: result.info
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: result.message
      });
    }
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al enviar el correo de prueba.',
      error: error.message
    });
  }
});

export default router;
