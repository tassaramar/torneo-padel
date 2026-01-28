-- Agregar estado 'terminado' al constraint de estados válidos
-- "Organizador marcó que finalizó, todavía sin resultado"

-- 1. Eliminar constraint existente
ALTER TABLE public.partidos
DROP CONSTRAINT IF EXISTS check_estado_valido;

-- 2. Recrear constraint con 'terminado' incluido
ALTER TABLE public.partidos
ADD CONSTRAINT check_estado_valido
CHECK (estado IN ('pendiente', 'en_juego', 'terminado', 'a_confirmar', 'confirmado', 'en_revision'));

-- 3. Actualizar comentario de la columna
COMMENT ON COLUMN public.partidos.estado IS
'Estado del partido: pendiente, en_juego (en cancha), terminado (finalizó sin resultado aún), a_confirmar, confirmado, en_revision';
