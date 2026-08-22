import React from 'react';

interface PosReceiptModalProps {
  show: boolean;
  receiptData: any;
  onClose: () => void;
  onShareWhatsApp: (data: any) => void;
}

export const PosReceiptModal: React.FC<PosReceiptModalProps> = ({
  show,
  receiptData,
  onClose,
  onShareWhatsApp
}) => {
  if (!show || !receiptData) return null;

  return (
    <div className="receipt-modal-overlay">
      <div className="receipt-modal-content">
        <div className="receipt-print-area">
          <h3>ZENU CREDITS</h3>
          <p style={{ textAlign: 'center', fontSize: '0.75rem', margin: '0 0 10px 0' }}>COMPROBANTE DE ABONO</p>
          <p style={{ textAlign: 'center', margin: '0' }}>--------------------------------</p>
          <p><strong>Nro Recibo:</strong> #00{receiptData.id}</p>
          <p><strong>Fecha:</strong> {new Date(receiptData.fecha).toLocaleString()}</p>
          <p><strong>Cliente:</strong> {receiptData.clienteNombre}</p>
          <p><strong>Cobrador:</strong> {receiptData.cobrador}</p>
          <p style={{ textAlign: 'center', margin: '0' }}>--------------------------------</p>
          <p><strong>Valor Recibido:</strong> ${receiptData.monto.toLocaleString()} COP</p>
          <p><strong>Método de Pago:</strong> {receiptData.tipo}</p>
          <p><strong>Saldo Pendiente:</strong> ${receiptData.saldoPendiente.toLocaleString()} COP</p>
          <p><strong>Estado Crédito:</strong> {receiptData.estadoCredito}</p>
          <p style={{ textAlign: 'center', margin: '0' }}>--------------------------------</p>
          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.8rem' }}>
            <p>¡Gracias por su pago!</p>
            <p>Conserve este comprobante</p>
          </div>
        </div>
        <div className="receipt-modal-actions">
          <button 
            className="btn btn-primary" 
            onClick={() => window.print()}
            style={{ width: '100%' }}
          >
            🖨️ Imprimir Recibo
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => onShareWhatsApp(receiptData)}
            style={{ width: '100%', borderColor: '#10b981', color: '#10b981' }}
          >
            💬 Compartir por WhatsApp
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            style={{ width: '100%', marginTop: '5px' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
