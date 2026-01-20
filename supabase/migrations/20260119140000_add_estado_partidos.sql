-- Agregar campos de estado para sistema de confirmación doble de resultados

-- 1. Agregar columnas nuevas a tabla partidos
ALTER TABLE public.partidos 
ADD COLUMN estado text DEFAULT 'pendiente',
ADD COLUMN cargado_por_pareja_id uuid REFERENCES public.parejas(id),
ADD COLUMN resultado_temp_a integer,
ADD COLUMN resultado_temp_b integer,
ADD COLUMN notas_revision text;

-- 2. Crear índices para mejorar performance en queries
CREATE INDEX idx_partidos_estado ON public.partidos(estado);
CREATE INDEX idx_partidos_cargado_por ON public.partidos(cargado_por_pareja_id);

-- 3. Agregar constraints para validar estados válidos
ALTER TABLE public.partidos
ADD CONSTRAINT check_estado_valido 
CHECK (estado IN ('pendiente', 'a_confirmar', 'confirmado', 'en_revision'));

-- 4. Comentarios para documentación
COMMENT ON COLUMN public.partidos.estado IS 
'Estado del resultado: pendiente (sin cargar), a_confirmar (cargado por una pareja), confirmado (ambas parejas coinciden), en_revision (hay conflicto)';

COMMENT ON COLUMN public.partidos.cargado_por_pareja_id IS 
'ID de la pareja que cargó primero el resultado (para sistema de confirmación doble)';

COMMENT ON COLUMN public.partidos.resultado_temp_a IS 
'Resultado temporal para pareja A cuando hay conflicto (segunda carga diferente)';

COMMENT ON COLUMN public.partidos.resultado_temp_b IS 
'Resultado temporal para pareja B cuando hay conflicto (segunda carga diferente)';

COMMENT ON COLUMN public.partidos.notas_revision IS 
'Notas opcionales cuando hay conflicto (para comunicación entre parejas o con admin)';

-- 5. Actualizar partidos existentes con games cargados como 'confirmado'
UPDATE public.partidos
SET estado = 'confirmado'
WHERE games_a IS NOT NULL 
  AND games_b IS NOT NULL
  AND estado = 'pendiente';
