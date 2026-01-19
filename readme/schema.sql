-- Schema (ordenado para ejecución)
-- Origen: export Supabase "context only", reordenado por dependencias.

CREATE TABLE public.torneos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  iniciado boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT torneos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.copas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  torneo_id uuid NOT NULL,
  nombre text,
  orden integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT copas_pkey PRIMARY KEY (id),
  CONSTRAINT copas_torneo_id_fkey FOREIGN KEY (torneo_id) REFERENCES public.torneos(id)
);

CREATE TABLE public.grupos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  torneo_id uuid NOT NULL,
  nombre text NOT NULL,
  CONSTRAINT grupos_pkey PRIMARY KEY (id),
  CONSTRAINT grupos_torneo_id_fkey FOREIGN KEY (torneo_id) REFERENCES public.torneos(id)
);

CREATE TABLE public.parejas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  torneo_id uuid NOT NULL,
  nombre text NOT NULL,
  orden integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  copa_asignada_id uuid,
  CONSTRAINT parejas_pkey PRIMARY KEY (id),
  CONSTRAINT parejas_torneo_id_fkey FOREIGN KEY (torneo_id) REFERENCES public.torneos(id),
  CONSTRAINT parejas_copa_asignada_id_fkey FOREIGN KEY (copa_asignada_id) REFERENCES public.copas(id) ON DELETE SET NULL
);

CREATE TABLE public.partidos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  torneo_id uuid NOT NULL,
  grupo_id uuid,
  pareja_a_id uuid NOT NULL,
  pareja_b_id uuid NOT NULL,
  games_a integer,
  games_b integer,
  updated_at timestamp with time zone DEFAULT now(),
  copa_id uuid,
  ronda_copa text,
  orden_copa integer,
  CONSTRAINT partidos_pkey PRIMARY KEY (id),
  CONSTRAINT partidos_torneo_id_fkey FOREIGN KEY (torneo_id) REFERENCES public.torneos(id),
  CONSTRAINT partidos_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos(id),
  CONSTRAINT partidos_pareja_a_id_fkey FOREIGN KEY (pareja_a_id) REFERENCES public.parejas(id),
  CONSTRAINT partidos_pareja_b_id_fkey FOREIGN KEY (pareja_b_id) REFERENCES public.parejas(id),
  CONSTRAINT partidos_copa_id_fkey FOREIGN KEY (copa_id) REFERENCES public.copas(id)
);

CREATE TABLE public.posiciones_manual (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  torneo_id uuid NOT NULL,
  grupo_id uuid NOT NULL,
  pareja_id uuid NOT NULL,
  orden_manual integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT posiciones_manual_pkey PRIMARY KEY (id),
  CONSTRAINT posiciones_manual_torneo_id_fkey FOREIGN KEY (torneo_id) REFERENCES public.torneos(id),
  CONSTRAINT posiciones_manual_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.grupos(id),
  CONSTRAINT posiciones_manual_pareja_id_fkey FOREIGN KEY (pareja_id) REFERENCES public.parejas(id)
);
