import { Router, Response } from 'express';
import pool, { actualizarEstadosCreditos } from '../config/db';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/creditos
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await actualizarEstadosCreditos();
    const queryStr = `
      SELECT 
        cr.id_credito as id,
        cl.nombre as "clienteNombre",
        cl.documento,
        cl.telefono as "clienteTelefono",
        cr.monto_prestado as monto,
        cr.tasa_interes as interes,
        cr.total_a_pagar as "totalAPagar",
        cr.saldo_pendiente as "saldoPendiente",
        cr.valor_cuota as "valorCuota",
        (cr.total_a_pagar - cr.saldo_pendiente) as pagado,
        cr.frecuencia_pago as frecuencia,
        cr.fecha_desembolso::text as fecha,
        cr.estado
      FROM creditos cr
      JOIN clientes cl ON cr.id_cliente = cl.id_cliente
      ORDER BY cr.id_credito DESC;
    `;
    const result = await pool.query(queryStr);
    
    // Convert string decimals to numbers
    const data = result.rows.map(row => ({
      ...row,
      monto: parseFloat(row.monto),
      interes: parseFloat(row.interes),
      totalAPagar: parseFloat(row.totalAPagar),
      saldoPendiente: parseFloat(row.saldoPendiente),
      valorCuota: parseFloat(row.valorCuota),
      pagado: parseFloat(row.pagado)
    }));

    res.status(200).json({
      status: 'success',
      data
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los créditos.',
      error: error.message
    });
  }
});

// POST /api/creditos
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { clienteId, monto, tasa, frecuencia, cuotas } = req.body;

  if (!clienteId || !monto || !tasa || !frecuencia || !cuotas) {
    return res.status(400).json({
      status: 'error',
      message: 'Todos los campos (clienteId, monto, tasa, frecuencia, cuotas) son obligatorios.'
    });
  }

  const montoNum = parseFloat(monto);
  const tasaNum = parseFloat(tasa);
  const cuotasNum = parseInt(cuotas, 10);

  if (isNaN(montoNum) || isNaN(tasaNum) || isNaN(cuotasNum) || cuotasNum <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Valores numéricos inválidos.'
    });
  }

  // Cálculos de amortización
  const totalAPagar = Math.round(montoNum + (montoNum * (tasaNum / 100)));
  const valorCuota = Math.round(totalAPagar / cuotasNum);
  const saldoPendiente = totalAPagar;
  const d = new Date();
  const fechaDesembolso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  try {
    // Verificar si el cliente existe
    const clientCheck = await pool.query('SELECT id_cliente FROM clientes WHERE id_cliente = $1', [clienteId]);
    if (clientCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'El cliente especificado no existe.'
      });
    }

    const userRole = req.user?.rol;
    const estadoInicial = userRole === 'COBRADOR' ? 'PENDIENTE_APROBACION' : 'ACTIVO';

    const queryStr = `
      INSERT INTO creditos 
        (id_cliente, monto_prestado, tasa_interes, total_a_pagar, saldo_pendiente, valor_cuota, frecuencia_pago, fecha_desembolso, estado) 
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *;
    `;

    const result = await pool.query(queryStr, [
      clienteId,
      montoNum,
      tasaNum,
      totalAPagar,
      saldoPendiente,
      valorCuota,
      frecuencia,
      fechaDesembolso,
      estadoInicial
    ]);

    res.status(201).json({
      status: 'success',
      data: result.rows[0],
      requiereAprobacion: estadoInicial === 'PENDIENTE_APROBACION'
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al crear el crédito.',
      error: error.message
    });
  }
});

// PUT /api/creditos/:id/aprobar (Solo ADMIN)
router.put('/:id/aprobar', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE creditos SET estado = 'ACTIVO' WHERE id_credito = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Crédito no encontrado.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Crédito aprobado exitosamente.',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al aprobar el crédito.',
      error: error.message
    });
  }
});

// PUT /api/creditos/:id/rechazar (Solo ADMIN)
router.put('/:id/rechazar', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE creditos SET estado = 'RECHAZADO' WHERE id_credito = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Crédito no encontrado.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Crédito rechazado.',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al rechazar el crédito.',
      error: error.message
    });
  }
});

// PUT /api/creditos/:id (Solo ADMIN)
router.put('/:id', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { monto, tasa, saldoPendiente, estado, frecuencia } = req.body;

  if (monto === undefined || tasa === undefined || saldoPendiente === undefined || !estado || !frecuencia) {
    return res.status(400).json({
      status: 'error',
      message: 'Todos los campos son obligatorios.'
    });
  }

  try {
    const result = await pool.query(
      `UPDATE creditos 
       SET monto_prestado = $1, tasa_interes = $2, saldo_pendiente = $3, estado = $4, frecuencia_pago = $5 
       WHERE id_credito = $6 
       RETURNING *`,
      [monto, tasa, saldoPendiente, estado, frecuencia, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Crédito no encontrado.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Crédito actualizado exitosamente.',
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar el crédito.',
      error: error.message
    });
  }
});

// DELETE /api/creditos/:id (Solo ADMIN)
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM creditos WHERE id_credito = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Crédito no encontrado.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Crédito eliminado exitosamente.',
      data: { id: Number(id) }
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar el crédito. Verifique que no tenga pagos registrados.',
      error: error.message
    });
  }
});

export default router;
