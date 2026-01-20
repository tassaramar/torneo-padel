-- Agregar columna ronda a la tabla partidos
-- Esta columna almacena el número de ronda calculado con Circle Method

ALTER TABLE partidos ADD COLUMN IF NOT EXISTS ronda INTEGER;

-- Crear índice para mejorar performance en queries por ronda
CREATE INDEX IF NOT EXISTS idx_partidos_ronda ON partidos(ronda);

-- Comentario explicativo
COMMENT ON COLUMN partidos.ronda IS 'Número de ronda calculado con Circle Method (Berger Tables). NULL para partidos de copas que usan ronda_copa.';
