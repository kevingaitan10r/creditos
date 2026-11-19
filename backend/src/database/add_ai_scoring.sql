-- Migración para módulo de Inteligencia Artificial (Scoring Crediticio)
-- Ejecuta este script en el SQL Editor de Supabase

ALTER TABLE creditos 
ADD COLUMN IF NOT EXISTS score_ia INT,
ADD COLUMN IF NOT EXISTS nivel_riesgo VARCHAR(20),
ADD COLUMN IF NOT EXISTS analisis_ia JSONB;
