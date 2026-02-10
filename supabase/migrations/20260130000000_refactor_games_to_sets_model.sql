-- ============================================================================
-- MIGRACIÓN: Refactor modelo de resultados (games → sets como fuente de verdad)
-- ============================================================================
-- Cambios:
--   1. Renombrar games_a/games_b → games_totales_a/games_totales_b
--   2. Agregar sets_a/sets_b (sets ganados - derivados)
--   3. Agregar stb_puntos_a/stb_puntos_b (puntos reales del Super Tiebreak)
--   4. Reemplazar trigger para calcular derivados correctamente
--   5. Backfill datos existentes
-- ============================================================================

-- ============================================================================
-- PASO 1: Renombrar columnas games_* → games_totales_*
-- ============================================================================
ALTER TABLE partidos RENAME COLUMN games_a TO games_totales_a;
ALTER TABLE partidos RENAME COLUMN games_b TO games_totales_b;

-- También renombrar las columnas temporales (legacy, por consistencia)
ALTER TABLE partidos RENAME COLUMN resultado_temp_a TO resultado_temp_a_legacy;
ALTER TABLE partidos RENAME COLUMN resultado_temp_b TO resultado_temp_b_legacy;

-- Comentarios actualizados
COMMENT ON COLUMN partidos.games_totales_a IS 'DERIVADO: Suma total de games de pareja A (calculado desde sets)';
COMMENT ON COLUMN partidos.games_totales_b IS 'DERIVADO: Suma total de games de pareja B (calculado desde sets)';

-- ============================================================================
-- PASO 2: Agregar nuevas columnas
-- ============================================================================
-- Sets ganados (derivados)
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS sets_a INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS sets_b INTEGER;

-- Puntos reales del Super Tiebreak (para UX, cuando set3 es STB)
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS stb_puntos_a INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS stb_puntos_b INTEGER;

-- Comentarios
COMMENT ON COLUMN partidos.sets_a IS 'DERIVADO: Cantidad de sets ganados por pareja A';
COMMENT ON COLUMN partidos.sets_b IS 'DERIVADO: Cantidad de sets ganados por pareja B';
COMMENT ON COLUMN partidos.stb_puntos_a IS 'Puntos reales del Super Tiebreak para pareja A (ej: 10 en un 10-8)';
COMMENT ON COLUMN partidos.stb_puntos_b IS 'Puntos reales del Super Tiebreak para pareja B (ej: 8 en un 10-8)';

-- ============================================================================
-- PASO 3: Eliminar trigger viejo y crear función nueva
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_calcular_games_desde_sets ON partidos;
DROP FUNCTION IF EXISTS calcular_games_desde_sets();

-- Nueva función que calcula AMBOS derivados correctamente
CREATE OR REPLACE FUNCTION calcular_derivados_desde_sets()
RETURNS TRIGGER AS $$
DECLARE
  v_sets_a INTEGER := 0;
  v_sets_b INTEGER := 0;
  v_games_totales_a INTEGER := 0;
  v_games_totales_b INTEGER := 0;
  v_tiene_resultado BOOLEAN := FALSE;
BEGIN
  -- ========================================
  -- Calcular sets ganados y games totales
  -- ========================================
  
  -- Set 1
  IF NEW.set1_a IS NOT NULL AND NEW.set1_b IS NOT NULL THEN
    v_tiene_resultado := TRUE;
    v_games_totales_a := v_games_totales_a + NEW.set1_a;
    v_games_totales_b := v_games_totales_b + NEW.set1_b;
    IF NEW.set1_a > NEW.set1_b THEN
      v_sets_a := v_sets_a + 1;
    ELSIF NEW.set1_b > NEW.set1_a THEN
      v_sets_b := v_sets_b + 1;
    END IF;
  END IF;
  
  -- Set 2
  IF NEW.set2_a IS NOT NULL AND NEW.set2_b IS NOT NULL THEN
    v_tiene_resultado := TRUE;
    v_games_totales_a := v_games_totales_a + NEW.set2_a;
    v_games_totales_b := v_games_totales_b + NEW.set2_b;
    IF NEW.set2_a > NEW.set2_b THEN
      v_sets_a := v_sets_a + 1;
    ELSIF NEW.set2_b > NEW.set2_a THEN
      v_sets_b := v_sets_b + 1;
    END IF;
  END IF;
  
  -- Set 3 (puede ser STB normalizado a 1-0 o set completo)
  -- Nota: cuando es STB, la app guarda 1/0 en set3_* y puntos reales en stb_puntos_*
  IF NEW.set3_a IS NOT NULL AND NEW.set3_b IS NOT NULL THEN
    v_tiene_resultado := TRUE;
    v_games_totales_a := v_games_totales_a + NEW.set3_a;
    v_games_totales_b := v_games_totales_b + NEW.set3_b;
    IF NEW.set3_a > NEW.set3_b THEN
      v_sets_a := v_sets_a + 1;
    ELSIF NEW.set3_b > NEW.set3_a THEN
      v_sets_b := v_sets_b + 1;
    END IF;
  END IF;
  
  -- ========================================
  -- Asignar valores derivados
  -- ========================================
  IF v_tiene_resultado THEN
    NEW.sets_a := v_sets_a;
    NEW.sets_b := v_sets_b;
    NEW.games_totales_a := v_games_totales_a;
    NEW.games_totales_b := v_games_totales_b;
  ELSE
    -- Sin resultado: dejar en NULL
    NEW.sets_a := NULL;
    NEW.sets_b := NULL;
    NEW.games_totales_a := NULL;
    NEW.games_totales_b := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger nuevo
CREATE TRIGGER trigger_calcular_derivados_desde_sets
  BEFORE INSERT OR UPDATE OF set1_a, set1_b, set2_a, set2_b, set3_a, set3_b ON partidos
  FOR EACH ROW
  EXECUTE FUNCTION calcular_derivados_desde_sets();

-- ============================================================================
-- PASO 4: Backfill - Recalcular derivados para filas existentes con sets
-- ============================================================================
-- Actualizar todas las filas que tienen al menos un set cargado
-- El UPDATE dispara el trigger que recalcula los derivados

UPDATE partidos
SET updated_at = updated_at  -- Forzar el trigger sin cambiar datos reales
WHERE (set1_a IS NOT NULL AND set1_b IS NOT NULL)
   OR (set2_a IS NOT NULL AND set2_b IS NOT NULL)
   OR (set3_a IS NOT NULL AND set3_b IS NOT NULL);

-- ============================================================================
-- PASO 5: Índices para consultas frecuentes
-- ============================================================================
-- Índice para filtrar partidos "jugados" (con resultado)
CREATE INDEX IF NOT EXISTS idx_partidos_tiene_resultado 
ON partidos (torneo_id) 
WHERE sets_a IS NOT NULL;

-- ============================================================================
-- NOTAS IMPORTANTES PARA EL EQUIPO:
-- ============================================================================
-- 1. La app NUNCA debe escribir directamente a:
--    - games_totales_a / games_totales_b
--    - sets_a / sets_b
--    Estos campos son calculados automáticamente por el trigger.
--
-- 2. Para determinar si un partido tiene resultado, usar:
--    WHERE sets_a IS NOT NULL (o sets_b IS NOT NULL)
--    NO usar: WHERE games_totales_a IS NOT NULL
--
-- 3. Para mostrar resultados, usar set1_*, set2_*, set3_* + stb_puntos_*
--
-- 4. El Super Tiebreak se guarda así:
--    - set3_a/set3_b = 1/0 o 0/1 (normalizado para ranking, solo 1 game al ganador)
--    - stb_puntos_a/stb_puntos_b = puntos reales (ej: 10/8 para UX)
-- ============================================================================
