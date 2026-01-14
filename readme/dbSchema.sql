create table public.copas (
  id uuid not null default gen_random_uuid (),
  torneo_id uuid not null,
  nombre text null,
  orden integer not null,
  created_at timestamp with time zone null default now(),
  constraint copas_pkey primary key (id)
) TABLESPACE pg_default;

create table public.grupos (
  id uuid not null default gen_random_uuid (),
  torneo_id uuid not null,
  nombre text not null,
  constraint grupos_pkey primary key (id),
  constraint grupos_torneo_id_fkey foreign KEY (torneo_id) references torneos (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_grupos_torneo on public.grupos using btree (torneo_id) TABLESPACE pg_default;

create table public.parejas (
  id uuid not null default gen_random_uuid (),
  torneo_id uuid not null,
  nombre text not null,
  orden integer not null,
  created_at timestamp with time zone null default now(),
  constraint parejas_pkey primary key (id),
  constraint parejas_torneo_id_fkey foreign KEY (torneo_id) references torneos (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_parejas_torneo on public.parejas using btree (torneo_id) TABLESPACE pg_default;

create table public.partidos (
  id uuid not null default gen_random_uuid (),
  torneo_id uuid not null,
  grupo_id uuid not null,
  pareja_a_id uuid not null,
  pareja_b_id uuid not null,
  games_a integer null,
  games_b integer null,
  updated_at timestamp with time zone null default now(),
  copa_id uuid null,
  constraint partidos_pkey primary key (id),
  constraint partidos_grupo_id_fkey foreign KEY (grupo_id) references grupos (id) on delete CASCADE,
  constraint partidos_pareja_a_id_fkey foreign KEY (pareja_a_id) references parejas (id),
  constraint partidos_pareja_b_id_fkey foreign KEY (pareja_b_id) references parejas (id),
  constraint partidos_torneo_id_fkey foreign KEY (torneo_id) references torneos (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_partidos_torneo on public.partidos using btree (torneo_id) TABLESPACE pg_default;

create index IF not exists idx_partidos_grupo on public.partidos using btree (grupo_id) TABLESPACE pg_default;

create table public.posiciones_manual (
  id uuid not null default gen_random_uuid (),
  torneo_id uuid not null,
  grupo_id uuid not null,
  pareja_id uuid not null,
  orden_manual integer null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint posiciones_manual_pkey primary key (id),
  constraint posiciones_manual_torneo_id_grupo_id_pareja_id_key unique (torneo_id, grupo_id, pareja_id),
  constraint posiciones_manual_grupo_id_fkey foreign KEY (grupo_id) references grupos (id) on delete CASCADE,
  constraint posiciones_manual_pareja_id_fkey foreign KEY (pareja_id) references parejas (id) on delete CASCADE,
  constraint posiciones_manual_torneo_id_fkey foreign KEY (torneo_id) references torneos (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger trg_posiciones_manual_updated_at BEFORE
update on posiciones_manual for EACH row
execute FUNCTION set_updated_at ();

create table public.torneos (
  id uuid not null default gen_random_uuid (),
  nombre text not null,
  iniciado boolean not null default false,
  created_at timestamp with time zone null default now(),
  constraint torneos_pkey primary key (id)
) TABLESPACE pg_default;