import React from 'react';

interface AprobacionesViewProps {
  creditos: any[];
  onApproveCredit: (id: number) => void;
  onRejectCredit: (id: number) => void;
}

export const isPendingApproval = (st?: string) => {
  if (!st) return false;
  const s = String(st).toUpperCase().trim();
  return s === 'PENDIENTE_APROBACION' || s === 'PENDIENTE' || s.includes('PENDIENTE');
};

export const AprobacionesView: React.FC<AprobacionesViewProps> = ({
  creditos,
  onApproveCredit,
  onRejectCredit
}) => {
  const pendientes = creditos.filter(c => isPendingApproval(c.estado));

  return (
    <div className="section-container" style={{ flexDirection: 'column', gap: '20px' }}>
      <div className="panel" style={{ background: 'var(--bg-card)', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2 className="panel-title" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>rule</span>
            Solicitudes de Préstamo Pendientes de Aprobación ({pendientes.length})
          </h2>
          <span className="badge badge-warning" style={{ fontWeight: 700, padding: '6px 12px' }}>
            Módulo de Aprobaciones ADMIN
          </span>
        </div>

        {pendientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '56px', color: '#10b981', display: 'block', marginBottom: '12px' }}>verified</span>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', marginBottom: '6px', fontWeight: 700 }}>¡Todo al día!</h3>
            <p style={{ fontSize: '0.95rem' }}>No tienes solicitudes de préstamo pendientes por revisar en este momento.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px', marginTop: '20px' }}>
            {pendientes.map(c => (
              <div key={c.id} style={{
                background: 'var(--bg-card-hover)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '20px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                boxShadow: 'var(--shadow-premium)'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#f59e0b', fontWeight: 700, letterSpacing: '0.5px' }}>Solicitud #{c.id}</span>
                      <h4 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800, margin: '2px 0 0 0' }}>{c.clienteNombre}</h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Documento: {c.documento || 'No especificado'}</span>
                    </div>
                    <span className="badge badge-warning" style={{ fontWeight: 700, fontSize: '0.75rem' }}>
                      PENDIENTE
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', background: 'var(--bg-input)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Monto Solicitado:</span>
                      <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>${c.monto.toLocaleString()} COP</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tasa Interés:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{c.interes}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total a Pagar:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>${c.totalAPagar.toLocaleString()} COP</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Cuota ({c.frecuencia}):</span>
                      <strong style={{ color: '#f59e0b' }}>${c.valorCuota.toLocaleString()} COP</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Fecha Solicitud:</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{c.fecha}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <button
                    onClick={() => onApproveCredit(c.id)}
                    className="btn btn-primary"
                    style={{ flex: 1, background: '#10b981', borderColor: '#10b981', color: 'white', fontWeight: 800, padding: '10px', justifyContent: 'center', fontSize: '0.9rem' }}
                  >
                    ✅ Aprobar Préstamo
                  </button>
                  <button
                    onClick={() => onRejectCredit(c.id)}
                    className="btn btn-danger"
                    style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444', color: 'white', fontWeight: 800, padding: '10px', justifyContent: 'center', fontSize: '0.9rem' }}
                  >
                    ❌ Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
