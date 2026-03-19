ALTER TABLE public.torneos
ADD COLUMN IF NOT EXISTS formato_sets INTEGER DEFAULT 1;

COMMENT ON COLUMN public.torneos.formato_sets
IS 'Formato de sets: 1 = un set por partido, 3 = al mejor de 3 sets';
