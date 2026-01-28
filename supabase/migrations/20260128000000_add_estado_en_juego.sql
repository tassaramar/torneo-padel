-- Agregar estado 'en_juego' al constraint de estados válidos

-- 1. Eliminar constraint existente
ALTER TABLE public.partidos
DROP CONSTRAINT IF EXISTS check_estado_valido;

-- 2. Recrear constraint con 'en_juego' incluido
ALTER TABLE public.partidos
ADD CONSTRAINT check_estado_valido 
CHECK (estado IN ('pendiente', 'en_juego', 'a_confirmar', 'confirmado', 'en_revision'));

-- 3. Actualizar comentario de la columna
COMMENT ON COLUMN public.partidos.estado IS 
'Estado del partido: pendiente (sin jugar), en_juego (marcado como en cancha), a_confirmar (cargado por una pareja), confirmado (ambas parejas coinciden), en_revision (hay conflicto)';
