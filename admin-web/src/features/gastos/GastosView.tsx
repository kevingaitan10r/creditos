import React from 'react';
import { PlusCircle, FileDown, Trash2 } from 'lucide-react';

interface GastosViewProps {
  user: any;
  gastos: any[];
  newGasto: { descripcion: string; monto: string };
  setNewGasto: React.Dispatch<React.SetStateAction<{ descripcion: string; monto: string }>>;
  onAddGasto: (e: React.FormEvent) => void;
  onDeleteGasto: (id: number) => void;
  onExportCSV: (data: any[][], filename: string, headers: string[]) => void;
}

export const GastosView: React.FC<GastosViewProps> = ({
  user,
  gastos,
  newGasto,
  setNewGasto,
  onAddGasto,
  onDeleteGasto,
  onExportCSV
}) => {
  return (
    <div className="section-container layout-crud">
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Nuevo Gasto de Ruta</h2>
        </div>
        <form onSubmit={onAddGasto}>
          <div className="form-group">
            <label htmlFor="gastoDesc">Descripción del Gasto</label>
            <input
              id="gastoDesc"
              type="text"
              className="form-control"
              placeholder="Ej. Gasolina moto Centro"
              value={newGasto.descripcion}
              onChange={(e) => setNewGasto({ ...newGasto, descripcion: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="gastoMonto">Monto Egresado ($)</label>
            <input
              id="gastoMonto"
              type="number"
              className="form-control"
              placeholder="Ej. 15000"
              value={newGasto.monto}
              onChange={(e) => setNewGasto({ ...newGasto, monto: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
            <PlusCircle size={18} /> Registrar Gasto
          </button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Historial de Gastos de Ruta</h2>
          {user?.rol === 'ADMIN' && (
            <button 
              type="button"
              className="btn-export"
              onClick={() => {
                const headers = ["ID Gasto", "Cobrador", "Descripcion", "Monto Gasto", "Fecha"];
                const dataToExport = gastos.map(g => [
                  g.id,
                  g.cobrador,
                  g.descripcion,
                  g.monto,
                  g.fecha
                ]);
                onExportCSV(dataToExport, `Zenu_Gastos_${new Date().toISOString().split('T')[0]}`, headers);
              }}
            >
              <FileDown size={14} /> Exportar a Excel
            </button>
          )}
        </div>
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Cobrador</th>
                <th>Descripción</th>
                <th>Monto</th>
                <th>Fecha</th>
                {user?.rol === 'ADMIN' && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {gastos.map(g => (
                <tr key={g.id}>
                  <td data-label="Cobrador" style={{ fontWeight: 600 }}>{g.cobrador}</td>
                  <td data-label="Descripción">{g.descripcion}</td>
                  <td data-label="Monto" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>-${g.monto.toLocaleString()} COP</td>
                  <td data-label="Fecha">{g.fecha}</td>
                  {user?.rol === 'ADMIN' && (
                    <td data-label="Acciones">
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => onDeleteGasto(g.id)}
                      >
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {gastos.length === 0 && (
                <tr>
                  <td colSpan={user?.rol === 'ADMIN' ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay gastos operativos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
