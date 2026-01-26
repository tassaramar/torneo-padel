-- Agregar campos para múltiples sets a la tabla partidos
-- Permite guardar el resultado de cada set individual (para partidos a 2 o 3 sets)

-- Campos para sets individuales
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set1_a INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set1_b INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set2_a INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set2_b INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set3_a INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set3_b INTEGER;

-- Campo para indicar número de sets del partido (2 o 3)
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS num_sets INTEGER DEFAULT 3;

-- Campos temporales para sets (para sistema de confirmación)
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set1_temp_a INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set1_temp_b INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set2_temp_a INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set2_temp_b INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set3_temp_a INTEGER;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS set3_temp_b INTEGER;

-- Comentarios
COMMENT ON COLUMN partidos.set1_a IS 'Games de pareja A en el set 1';
COMMENT ON COLUMN partidos.set1_b IS 'Games de pareja B en el set 1';
COMMENT ON COLUMN partidos.set2_a IS 'Games de pareja A en el set 2';
COMMENT ON COLUMN partidos.set2_b IS 'Games de pareja B en el set 2';
COMMENT ON COLUMN partidos.set3_a IS 'Games de pareja A en el set 3 (si aplica)';
COMMENT ON COLUMN partidos.set3_b IS 'Games de pareja B en el set 3 (si aplica)';
COMMENT ON COLUMN partidos.num_sets IS 'Número de sets del partido: 2 (semifinales) o 3 (estándar)';
COMMENT ON COLUMN partidos.set1_temp_a IS 'Resultado temporal del set 1 para pareja A (cuando hay conflicto)';
COMMENT ON COLUMN partidos.set1_temp_b IS 'Resultado temporal del set 1 para pareja B (cuando hay conflicto)';
COMMENT ON COLUMN partidos.set2_temp_a IS 'Resultado temporal del set 2 para pareja A (cuando hay conflicto)';
COMMENT ON COLUMN partidos.set2_temp_b IS 'Resultado temporal del set 2 para pareja B (cuando hay conflicto)';
COMMENT ON COLUMN partidos.set3_temp_a IS 'Resultado temporal del set 3 para pareja A (cuando hay conflicto)';
COMMENT ON COLUMN partidos.set3_temp_b IS 'Resultado temporal del set 3 para pareja B (cuando hay conflicto)';

-- Función para calcular games_a y games_b desde los sets
CREATE OR REPLACE FUNCTION calcular_games_desde_sets()
RETURNS TRIGGER AS $$
DECLARE
  games_a_calc INTEGER := 0;
  games_b_calc INTEGER := 0;
BEGIN
  -- Calcular games ganados por cada pareja
  -- Un set se gana si se ganan más games en ese set
  
  -- Set 1
  IF NEW.set1_a IS NOT NULL AND NEW.set1_b IS NOT NULL THEN
    IF NEW.set1_a > NEW.set1_b THEN
      games_a_calc := games_a_calc + 1;
    ELSIF NEW.set1_b > NEW.set1_a THEN
      games_b_calc := games_b_calc + 1;
    END IF;
  END IF;
  
  -- Set 2
  IF NEW.set2_a IS NOT NULL AND NEW.set2_b IS NOT NULL THEN
    IF NEW.set2_a > NEW.set2_b THEN
      games_a_calc := games_a_calc + 1;
    ELSIF NEW.set2_b > NEW.set2_a THEN
      games_b_calc := games_b_calc + 1;
    END IF;
  END IF;
  
  -- Set 3 (solo si num_sets = 3)
  IF NEW.num_sets = 3 AND NEW.set3_a IS NOT NULL AND NEW.set3_b IS NOT NULL THEN
    IF NEW.set3_a > NEW.set3_b THEN
      games_a_calc := games_a_calc + 1;
    ELSIF NEW.set3_b > NEW.set3_a THEN
      games_b_calc := games_b_calc + 1;
    END IF;
  END IF;
  
  -- Actualizar games_a y games_b solo si hay al menos un set completo
  IF (NEW.set1_a IS NOT NULL AND NEW.set1_b IS NOT NULL) OR
     (NEW.set2_a IS NOT NULL AND NEW.set2_b IS NOT NULL) OR
     (NEW.set3_a IS NOT NULL AND NEW.set3_b IS NOT NULL) THEN
    NEW.games_a := games_a_calc;
    NEW.games_b := games_b_calc;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular games automáticamente cuando se actualizan los sets
DROP TRIGGER IF EXISTS trigger_calcular_games_desde_sets ON partidos;
CREATE TRIGGER trigger_calcular_games_desde_sets
  BEFORE INSERT OR UPDATE OF set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets ON partidos
  FOR EACH ROW
  EXECUTE FUNCTION calcular_games_desde_sets();
