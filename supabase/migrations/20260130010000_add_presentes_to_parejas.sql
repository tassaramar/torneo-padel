-- Agregar campo presentes a parejas para tracking de asistencia
-- El campo es un array de nombres de jugadores que confirmaron presencia
-- Se resetea automáticamente al importar nuevas parejas

ALTER TABLE public.parejas 
ADD COLUMN IF NOT EXISTS presentes TEXT[] DEFAULT '{}';

-- Comentario para documentar el campo
COMMENT ON COLUMN public.parejas.presentes IS 'Array de nombres de jugadores presentes. Ej: ["Tincho", "Max"]';
