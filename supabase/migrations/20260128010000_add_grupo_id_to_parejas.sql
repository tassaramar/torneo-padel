-- Agrega relación explícita pareja -> grupo (soporta grupos desparejos, ej: 5+6)
-- NOTA: Se deja NULL permitido para compatibilidad con torneos viejos.

alter table public.parejas
add column if not exists grupo_id uuid;

-- Agregar constraint solo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parejas_grupo_id_fkey'
  ) THEN
    ALTER TABLE public.parejas
    ADD CONSTRAINT parejas_grupo_id_fkey
    FOREIGN KEY (grupo_id) REFERENCES public.grupos(id) ON DELETE SET NULL;
  END IF;
END $$;

create index if not exists idx_parejas_grupo_id on public.parejas(grupo_id);
