import React from 'react';

interface RutasViewProps {
  rutas: any[];
  cobradoresList: any[];
  newRoute: { nombre_ruta: string; id_cobrador: string };
  setNewRoute: React.Dispatch<React.SetStateAction<{ nombre_ruta: string; id_cobrador: string }>>;
  editingRoute: { id: number; nombre_ruta: string; id_cobrador: string | number | null } | null;
  setEditingRoute: React.Dispatch<React.SetStateAction<{ id: number; nombre_ruta: string; id_cobrador: string | number | null } | null>>;
  onCreateRoute: (e: React.FormEvent) => void;
  onUpdateRoute: (e: React.FormEvent) => void;
  onDeleteRoute: (id: number) => void;
  onBackToSettings: () => void;
}

export const RutasView: React.FC<RutasViewProps> = ({
  rutas,
  cobradoresList,
  newRoute,
  setNewRoute,
  editingRoute,
  setEditingRoute,
  onCreateRoute,
  onUpdateRoute,
  onDeleteRoute,
  onBackToSettings
}) => {
  return (
    <>
      <button 
        type="button" 
        className="btn btn-secondary btn-sm mobile-only" 
        onClick={onBackToSettings}
        style={{ marginBottom: '15px' }}
      >
        ← Volver a Ajustes
      </button>
      <div className="section-container layout-crud">
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              {editingRoute ? 'Editar Ruta' : 'Nueva Ruta'}
            </h2>
            {editingRoute && (
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={() => setEditingRoute(null)}
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Cancelar
              </button>
            )}
          </div>
          <form onSubmit={editingRoute ? onUpdateRoute : onCreateRoute}>
            <div className="form-group">
              <label htmlFor="routeNameInput">Nombre de la Ruta</label>
              <input
                id="routeNameInput"
                type="text"
                className="form-control"
                placeholder="Ej. Ruta Sur - El Recreo"
                value={editingRoute ? editingRoute.nombre_ruta : newRoute.nombre_ruta}
                onChange={(e) => {
                  if (editingRoute) {
                    setEditingRoute({ ...editingRoute, nombre_ruta: e.target.value });
                  } else {
                    setNewRoute({ ...newRoute, nombre_ruta: e.target.value });
                  }
                }}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="routeCobradorSelect">Cobrador Asignado</label>
              <select
                id="routeCobradorSelect"
                className="form-control"
                value={editingRoute ? (editingRoute.id_cobrador || '') : newRoute.id_cobrador}
                onChange={(e) => {
                  if (editingRoute) {
                    setEditingRoute({ ...editingRoute, id_cobrador: e.target.value ? Number(e.target.value) : null });
                  } else {
                    setNewRoute({ ...newRoute, id_cobrador: e.target.value });
                  }
                }}
              >
                <option value="">Sin Asignar</option>
                {cobradoresList.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
              {editingRoute ? 'Guardar Cambios' : 'Crear Ruta'}
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Rutas Registradas</h2>
          </div>
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Ruta</th>
                  <th>Cobrador</th>
                  <th>Recaudado</th>
                  <th>Esperado</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rutas.map(r => (
                  <tr key={r.id}>
                    <td data-label="Ruta" style={{ fontWeight: 600 }}>{r.nombre_ruta}</td>
                    <td data-label="Cobrador">{r.cobrador}</td>
                    <td data-label="Recaudado Hoy" style={{ color: 'var(--color-success)' }}>${r.recaudado.toLocaleString()}</td>
                    <td data-label="Esperado Diario">${r.totalEsperado.toLocaleString()}</td>
                    <td data-label="Estado">
                      <span className={`badge ${r.cobradorId ? 'badge-success' : 'badge-warning'}`}>
                        {r.cobradorId ? 'Activa' : 'Sin Cobrador'}
                      </span>
                    </td>
                    <td data-label="Acciones" style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600 }}
                        onClick={() => setEditingRoute({ id: r.id, nombre_ruta: r.nombre_ruta, id_cobrador: r.cobradorId })}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', fontWeight: 600 }}
                        onClick={() => onDeleteRoute(r.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {rutas.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No hay rutas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};
