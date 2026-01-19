-- Agregar campo copa_asignada_id a parejas para pre-asignación flexible
-- Esto permite asignar equipos a copas antes de generar los cruces

ALTER TABLE public.parejas 
ADD COLUMN copa_asignada_id uuid;

-- Foreign key a copas (nullable, porque no todos los equipos están asignados siempre)
ALTER TABLE public.parejas
ADD CONSTRAINT parejas_copa_asignada_id_fkey 
FOREIGN KEY (copa_asignada_id) 
REFERENCES public.copas(id) 
ON DELETE SET NULL;

-- Índice para mejorar performance en queries
CREATE INDEX idx_parejas_copa_asignada ON public.parejas(copa_asignada_id);

-- Comentario descriptivo
COMMENT ON COLUMN public.parejas.copa_asignada_id IS 
'Copa a la que está pre-asignada esta pareja (antes de generar cruces). NULL = no asignada';
