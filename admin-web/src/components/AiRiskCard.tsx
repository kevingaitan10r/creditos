import React from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert, AlertCircle } from 'lucide-react';

export interface AiEvaluation {
  score: number;
  nivelRiesgo: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  decisionSugerida: 'APROBAR' | 'CONDICIONAR' | 'RECHAZAR';
  montoMaximoSugerido?: number;
  factoresPositivos?: string[];
  factoresRiesgo?: string[];
  resumen?: string;
  recomendaciones?: string;
  origenAnalisis?: string;
}

interface AiRiskCardProps {
  evaluation: AiEvaluation;
  onRefresh?: () => void;
  loading?: boolean;
}

export const AiRiskCard: React.FC<AiRiskCardProps> = ({
  evaluation,
  onRefresh,
  loading = false
}) => {
  const { score, nivelRiesgo, decisionSugerida, montoMaximoSugerido, factoresPositivos = [], factoresRiesgo = [], resumen, recomendaciones } = evaluation;

  const getScoreColor = (sc: number) => {
    if (sc >= 75) return '#10b981'; // Verde
    if (sc >= 50) return '#f59e0b'; // Amarillo/Ámbar
    return '#ef4444'; // Rojo
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'BAJO':
        return { label: 'Bajo Riesgo', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', color: '#10b981', icon: ShieldCheck };
      case 'MEDIO':
        return { label: 'Riesgo Medio', bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', color: '#f59e0b', icon: AlertTriangle };
      case 'ALTO':
        return { label: 'Alto Riesgo', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', color: '#ef4444', icon: ShieldAlert };
      case 'CRITICO':
      default:
        return { label: 'Riesgo Crítico', bg: 'rgba(220, 38, 38, 0.2)', border: '#dc2626', color: '#dc2626', icon: AlertCircle };
    }
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'APROBAR':
        return { label: 'Aprobación Sugerida', color: '#10b981' };
      case 'CONDICIONAR':
        return { label: 'Sujeto a Condiciones', color: '#f59e0b' };
      case 'RECHAZAR':
      default:
        return { label: 'Rechazo Sugerido', color: '#ef4444' };
    }
  };

  const riskInfo = getRiskBadge(nivelRiesgo);
  const decisionInfo = getDecisionBadge(decisionSugerida);
  const IconComponent = riskInfo.icon;
  const scoreColor = getScoreColor(score);

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(20, 24, 38, 0.95), rgba(15, 18, 30, 0.98))',
      border: `1px solid ${riskInfo.border}55`,
      borderRadius: '16px',
      padding: '16px',
      marginTop: '12px',
      marginBottom: '12px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Sparkles size={16} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f3f4f6', letterSpacing: '0.3px' }}>
            Dictamen de Riesgo IA (Gemini)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            background: riskInfo.bg,
            border: `1px solid ${riskInfo.border}`,
            color: riskInfo.color,
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <IconComponent size={14} />
            {riskInfo.label}
          </span>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#9ca3af',
                cursor: 'pointer',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.75rem'
              }}
              title="Volver a evaluar"
            >
              {loading ? '...' : '↺'}
            </button>
          )}
        </div>
      </div>

      {/* Métricas Principales */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '10px',
        background: 'rgba(255, 255, 255, 0.03)',
        padding: '12px',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        {/* Score */}
        <div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Score Crediticio</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 900, color: scoreColor }}>{score}</span>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>/ 100</span>
          </div>
          <div style={{
            height: '4px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
            marginTop: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${Math.max(5, Math.min(100, score))}%`,
              height: '100%',
              background: scoreColor,
              borderRadius: '2px',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        {/* Decisión sugerida */}
        <div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Decisión Sugerida</span>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: decisionInfo.color, marginTop: '2px' }}>
            {decisionInfo.label}
          </div>
          {montoMaximoSugerido !== undefined && montoMaximoSugerido > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
              Máx: <strong style={{ color: '#e5e7eb' }}>${montoMaximoSugerido.toLocaleString()}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Resumen */}
      {resumen && (
        <p style={{
          fontSize: '0.82rem',
          color: '#d1d5db',
          margin: '10px 0 6px 0',
          lineHeight: '1.35',
          fontStyle: 'italic'
        }}>
          "{resumen}"
        </p>
      )}

      {/* Factores */}
      {(factoresPositivos.length > 0 || factoresRiesgo.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginTop: '8px' }}>
          {factoresPositivos.length > 0 && (
            <div style={{ fontSize: '0.75rem' }}>
              <span style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <CheckCircle2 size={12} /> Factores Favorables:
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', color: '#9ca3af' }}>
                {factoresPositivos.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {factoresRiesgo.length > 0 && (
            <div style={{ fontSize: '0.75rem' }}>
              <span style={{ color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <AlertTriangle size={12} /> Factores de Alerta:
              </span>
              <ul style={{ margin: 0, paddingLeft: '16px', color: '#9ca3af' }}>
                {factoresRiesgo.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recomendación */}
      {recomendaciones && (
        <div style={{
          marginTop: '8px',
          padding: '6px 10px',
          background: 'rgba(99, 102, 241, 0.1)',
          borderLeft: '3px solid #6366f1',
          borderRadius: '4px',
          fontSize: '0.76rem',
          color: '#c7d2fe'
        }}>
          <strong>Recomendación:</strong> {recomendaciones}
        </div>
      )}
    </div>
  );
};
