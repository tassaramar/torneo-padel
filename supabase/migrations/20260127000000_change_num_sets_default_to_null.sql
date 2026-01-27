-- Cambiar default de num_sets de 3 a NULL
-- Esto permite que partidos nuevos no tengan un valor por defecto
-- y la lógica del frontend puede decidir qué mostrar

-- 1. Eliminar el default actual
ALTER TABLE partidos ALTER COLUMN num_sets DROP DEFAULT;

-- 2. Actualizar partidos existentes que tienen num_sets = 3 pero no tienen sets cargados
-- Ponerlos en NULL para que la lógica del frontend decida
UPDATE partidos
SET num_sets = NULL
WHERE num_sets = 3
  AND set1_a IS NULL
  AND set1_b IS NULL
  AND set2_a IS NULL
  AND set2_b IS NULL
  AND set3_a IS NULL
  AND set3_b IS NULL
  AND copa_id IS NULL;

-- 3. Comentario actualizado
COMMENT ON COLUMN partidos.num_sets IS 'Número de sets del partido: 2 (semifinales) o 3 (estándar). NULL si no está definido (el frontend decide qué mostrar)';
