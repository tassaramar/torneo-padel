-- Agrega relación explícita pareja -> grupo (soporta grupos desparejos, ej: 5+6)
-- NOTA: Se deja NULL permitido para compatibilidad con torneos viejos.

alter table public.parejas
add column if not exists grupo_id uuid;

alter table public.parejas
add constraint parejas_grupo_id_fkey
foreign key (grupo_id) references public.grupos(id) on delete set null;

create index if not exists idx_parejas_grupo_id on public.parejas(grupo_id);

