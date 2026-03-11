-- Etapa 1: Copa Approval v2 — SQL Foundation
-- Cambios:
-- 1. Tabla sorteos para desempate intra_grupo e inter_grupo
-- 2. Fix obtener_standings_torneo (+ gc, dg, sorteo_orden)
-- 3. Nueva RPC crear_partidos_copa

-- ============================================================================
-- CAMBIO 1: Tabla sorteos
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sorteos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id     UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  grupo_id      UUID REFERENCES public.grupos(id) ON DELETE CASCADE,  -- NULL para inter_grupo
  pareja_id     UUID NOT NULL REFERENCES public.parejas(id) ON DELETE CASCADE,
  orden_sorteo  INTEGER NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('intra_grupo', 'inter_grupo')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (torneo_id, pareja_id)
);

-- RLS
ALTER TABLE public.sorteos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden leer sorteos"
  ON public.sorteos FOR SELECT
  USING (true);

CREATE POLICY "Admin puede insertar sorteos"
  ON public.sorteos FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin puede actualizar sorteos"
  ON public.sorteos FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admin puede borrar sorteos"
  ON public.sorteos FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- CAMBIO 2: Fix obtener_standings_torneo
-- ============================================================================

DROP FUNCTION IF EXISTS public.obtener_standings_torneo(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.obtener_standings_torneo(p_torneo_id UUID)
RETURNS TABLE (
  grupo_id          UUID,
  pareja_id         UUID,
  puntos            INTEGER,
  ds                INTEGER,
  gf                INTEGER,
  gc                INTEGER,           -- NUEVO: games contra
  dg                INTEGER,           -- NUEVO: diferencia de games (gf - gc)
  posicion_en_grupo INTEGER,
  grupo_completo    BOOLEAN,
  sorteo_orden      INTEGER            -- NUEVO: orden del sorteo (NULL si no hay)
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH
  pg AS (
    SELECT
      pt.grupo_id,
      pt.pareja_a_id,
      pt.pareja_b_id,
      pt.estado,
      pt.sets_a,
      pt.sets_b,
      COALESCE(pt.games_totales_a, 0) AS gta,
      COALESCE(pt.games_totales_b, 0) AS gtb
    FROM partidos pt
    WHERE pt.torneo_id   = p_torneo_id
      AND pt.copa_id     IS NULL
      AND pt.grupo_id    IS NOT NULL
  ),

  gcomp AS (
    SELECT grupo_id
    FROM pg
    GROUP BY grupo_id
    HAVING COUNT(*) > 0
       AND COUNT(*) = COUNT(CASE WHEN sets_a IS NOT NULL THEN 1 END)
  ),

  res_a AS (
    SELECT
      pg.grupo_id,
      pg.pareja_a_id AS pareja_id,
      CASE WHEN pg.sets_a > pg.sets_b THEN 2 ELSE 1 END AS pts,
      pg.sets_a AS sf,
      pg.sets_b AS sc,
      pg.gta    AS gf,
      pg.gtb    AS gc          -- NUEVO: games contra desde perspectiva A
    FROM pg
    WHERE pg.sets_a IS NOT NULL
  ),

  res_b AS (
    SELECT
      pg.grupo_id,
      pg.pareja_b_id AS pareja_id,
      CASE WHEN pg.sets_b > pg.sets_a THEN 2 ELSE 1 END AS pts,
      pg.sets_b AS sf,
      pg.sets_a AS sc,
      pg.gtb    AS gf,
      pg.gta    AS gc          -- NUEVO: games contra desde perspectiva B
    FROM pg
    WHERE pg.sets_a IS NOT NULL
  ),

  stats AS (
    SELECT
      grupo_id,
      pareja_id,
      SUM(pts)::integer            AS puntos,
      (SUM(sf) - SUM(sc))::integer AS ds,
      SUM(gf)::integer             AS gf,
      SUM(gc)::integer             AS gc,                        -- NUEVO
      (SUM(gf) - SUM(gc))::integer AS dg                        -- NUEVO
    FROM (SELECT * FROM res_a UNION ALL SELECT * FROM res_b) r
    GROUP BY grupo_id, pareja_id
  ),

  ranked AS (
    SELECT
      s.*,
      ROW_NUMBER() OVER (
        PARTITION BY s.grupo_id
        ORDER BY
          s.puntos DESC,
          s.ds     DESC,
          s.dg     DESC,                                         -- NUEVO
          s.gf     DESC,
          COALESCE(so.orden_sorteo, 999999) ASC,                 -- NUEVO
          s.pareja_id
      )::integer AS posicion_en_grupo
    FROM stats s
    LEFT JOIN sorteos so                                          -- NUEVO
      ON so.torneo_id = p_torneo_id
      AND so.pareja_id = s.pareja_id
  )

  SELECT
    r.grupo_id,
    r.pareja_id,
    r.puntos,
    r.ds,
    r.gf,
    r.gc,                                                         -- NUEVO
    r.dg,                                                         -- NUEVO
    r.posicion_en_grupo,
    (gcomp.grupo_id IS NOT NULL) AS grupo_completo,
    so.orden_sorteo AS sorteo_orden                               -- NUEVO
  FROM ranked r
  LEFT JOIN gcomp ON gcomp.grupo_id = r.grupo_id
  LEFT JOIN sorteos so                                            -- NUEVO
    ON so.torneo_id = p_torneo_id
    AND so.pareja_id = r.pareja_id;
$$;

-- ============================================================================
-- CAMBIO 3: Nueva RPC crear_partidos_copa
-- ============================================================================

CREATE OR REPLACE FUNCTION public.crear_partidos_copa(
  p_esquema_copa_id UUID,
  p_cruces          JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_esquema   RECORD;
  v_copa_id   UUID;
  v_torneo_id UUID;
  v_cruce     JSONB;
  v_partidos  INTEGER := 0;
BEGIN
  -- Cargar esquema
  SELECT ec.id, ec.torneo_id, ec.nombre, ec.orden
  INTO v_esquema
  FROM esquemas_copa ec
  WHERE ec.id = p_esquema_copa_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Esquema no encontrado');
  END IF;

  v_torneo_id := v_esquema.torneo_id;

  -- Crear copa si no existe (reutilizar en aprobaciones progresivas/parciales)
  SELECT id INTO v_copa_id
  FROM copas
  WHERE torneo_id = v_torneo_id
    AND esquema_copa_id = p_esquema_copa_id
  LIMIT 1;

  IF v_copa_id IS NULL THEN
    INSERT INTO copas (torneo_id, nombre, orden, esquema_copa_id)
    VALUES (v_torneo_id, v_esquema.nombre, v_esquema.orden, p_esquema_copa_id)
    RETURNING id INTO v_copa_id;
  END IF;

  -- Crear partidos desde cruces JSONB
  FOR v_cruce IN SELECT * FROM jsonb_array_elements(p_cruces)
  LOOP
    -- Validar que ambas parejas estén definidas
    IF (v_cruce->>'pareja_a_id') IS NULL OR (v_cruce->>'pareja_b_id') IS NULL THEN
      CONTINUE;  -- Saltar cruces incompletos (slots pendientes)
    END IF;

    -- Evitar duplicados: no crear si ya existe partido con mismas parejas en misma copa+ronda
    IF EXISTS (
      SELECT 1 FROM partidos
      WHERE copa_id = v_copa_id
        AND ronda_copa = v_cruce->>'ronda'
        AND orden_copa = (v_cruce->>'orden')::integer
    ) THEN
      CONTINUE;  -- Ya existe, saltar
    END IF;

    INSERT INTO partidos (
      torneo_id, copa_id, ronda_copa, orden_copa,
      pareja_a_id, pareja_b_id, estado
    )
    VALUES (
      v_torneo_id,
      v_copa_id,
      v_cruce->>'ronda',
      (v_cruce->>'orden')::integer,
      (v_cruce->>'pareja_a_id')::uuid,
      (v_cruce->>'pareja_b_id')::uuid,
      'pendiente'
    );

    v_partidos := v_partidos + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'copa_id', v_copa_id,
    'partidos_creados', v_partidos
  );
END;
$$;
