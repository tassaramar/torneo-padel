-- Migración: Re-ingeniería del sistema de copas
--
-- Agrega:
--   1. tabla `esquemas_copa`   — el plan de copas definido por el admin
--   2. tabla `propuestas_copa` — cruces propuestos, pendientes de aprobación
--   3. columna `esquema_copa_id` en `copas` — vínculo con el plan
--   4. RLS para ambas tablas nuevas
--   5. función `obtener_standings_torneo`   — helper de standings por grupo
--   6. función `verificar_y_proponer_copas` — motor de propuestas (SECURITY DEFINER)
--   7. función `aprobar_propuestas_copa`    — crea copa + partidos al aprobar
--   8. función `generar_finales_copa`       — genera final + 3P automáticamente
--   9. función `reset_copas_torneo`         — borra todo, vuelve al plan editable


-- ============================================================
-- TABLA: esquemas_copa
-- El "plan de copas" — qué copas se juegan y quiénes participan.
-- ============================================================
CREATE TABLE public.esquemas_copa (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id   uuid    NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  nombre      text    NOT NULL,
  orden       integer NOT NULL DEFAULT 1,
  -- 'bracket' (semi+final) | 'direct' (un solo cruce)
  formato     text    NOT NULL DEFAULT 'bracket',
  -- Array de reglas JSONB. Cada regla: {"posicion": N} o
  -- {"posicion": N, "cantidad": K, "criterio": "mejor"|"peor"}
  reglas      jsonb   NOT NULL DEFAULT '[]',
  created_at  timestamptz DEFAULT now(),
  UNIQUE (torneo_id, orden)
);

ALTER TABLE public.esquemas_copa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esquemas_copa_select"
ON public.esquemas_copa FOR SELECT
TO public
USING (true);

CREATE POLICY "esquemas_copa_write_admin"
ON public.esquemas_copa FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ============================================================
-- TABLA: propuestas_copa
-- Cruces propuestos por el motor, pendientes de revisión admin.
-- ============================================================
CREATE TABLE public.propuestas_copa (
  id                uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  esquema_copa_id   uuid    NOT NULL REFERENCES public.esquemas_copa(id) ON DELETE CASCADE,
  -- 'SF' (semi) | 'F' (final) | '3P' (tercer puesto) | 'direct' (cruce directo)
  ronda             text    NOT NULL,
  pareja_a_id       uuid    REFERENCES public.parejas(id) ON DELETE SET NULL,
  pareja_b_id       uuid    REFERENCES public.parejas(id) ON DELETE SET NULL,
  orden             integer NOT NULL DEFAULT 1,
  -- 'pendiente' | 'aprobado' | 'descartado'
  estado            text    NOT NULL DEFAULT 'pendiente',
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.propuestas_copa ENABLE ROW LEVEL SECURITY;

-- Lectura pública (admin la necesita, jugadores eventualmente)
CREATE POLICY "propuestas_copa_select"
ON public.propuestas_copa FOR SELECT
TO public
USING (true);

-- Escritura: solo admin autenticado
-- Nota: INSERT también lo hacen las funciones SECURITY DEFINER (bypass RLS)
CREATE POLICY "propuestas_copa_write_admin"
ON public.propuestas_copa FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ============================================================
-- ALTER: copas — agregar vínculo con el esquema
-- ============================================================
ALTER TABLE public.copas
  ADD COLUMN IF NOT EXISTS esquema_copa_id uuid
    REFERENCES public.esquemas_copa(id) ON DELETE SET NULL;


-- ============================================================
-- FUNCIÓN HELPER: obtener_standings_torneo
-- Devuelve la tabla de posiciones de todos los grupos del torneo.
-- Solo incluye partidos con resultado cargado (sets_a IS NOT NULL).
-- ============================================================
CREATE OR REPLACE FUNCTION public.obtener_standings_torneo(p_torneo_id UUID)
RETURNS TABLE (
  grupo_id          UUID,
  pareja_id         UUID,
  puntos            INTEGER,
  ds                INTEGER,  -- diferencia de sets
  gf                INTEGER,  -- games a favor
  posicion_en_grupo INTEGER,
  grupo_completo    BOOLEAN   -- todos los partidos del grupo tienen resultado
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH
  -- Partidos de grupo (excluye copas)
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

  -- Grupos donde todos los partidos tienen resultado (sets_a IS NOT NULL)
  gc AS (
    SELECT grupo_id
    FROM pg
    GROUP BY grupo_id
    HAVING COUNT(*) > 0
       AND COUNT(*) = COUNT(CASE WHEN sets_a IS NOT NULL THEN 1 END)
  ),

  -- Resultados desde perspectiva de pareja A
  res_a AS (
    SELECT
      pg.grupo_id,
      pg.pareja_a_id AS pareja_id,
      CASE WHEN pg.sets_a > pg.sets_b THEN 2 ELSE 1 END AS pts,
      pg.sets_a AS sf,
      pg.sets_b AS sc,
      pg.gta    AS gf
    FROM pg
    WHERE pg.sets_a IS NOT NULL
  ),

  -- Resultados desde perspectiva de pareja B
  res_b AS (
    SELECT
      pg.grupo_id,
      pg.pareja_b_id AS pareja_id,
      CASE WHEN pg.sets_b > pg.sets_a THEN 2 ELSE 1 END AS pts,
      pg.sets_b AS sf,
      pg.sets_a AS sc,
      pg.gtb    AS gf
    FROM pg
    WHERE pg.sets_a IS NOT NULL
  ),

  -- Stats agregadas por pareja
  stats AS (
    SELECT
      grupo_id,
      pareja_id,
      SUM(pts)::integer          AS puntos,
      (SUM(sf) - SUM(sc))::integer AS ds,
      SUM(gf)::integer           AS gf
    FROM (SELECT * FROM res_a UNION ALL SELECT * FROM res_b) r
    GROUP BY grupo_id, pareja_id
  ),

  -- Posición dentro del grupo (desempate: puntos → ds → gf → pareja_id estable)
  ranked AS (
    SELECT
      s.*,
      ROW_NUMBER() OVER (
        PARTITION BY s.grupo_id
        ORDER BY s.puntos DESC, s.ds DESC, s.gf DESC, s.pareja_id
      )::integer AS posicion_en_grupo
    FROM stats s
  )

  SELECT
    r.grupo_id,
    r.pareja_id,
    r.puntos,
    r.ds,
    r.gf,
    r.posicion_en_grupo,
    (gc.grupo_id IS NOT NULL) AS grupo_completo
  FROM ranked r
  LEFT JOIN gc ON gc.grupo_id = r.grupo_id;
$$;


-- ============================================================
-- FUNCIÓN PRINCIPAL: verificar_y_proponer_copas
-- Evalúa el plan de copas y genera propuestas cuando los grupos terminan.
-- Idempotente: no duplica propuestas existentes.
-- Llamar con: SELECT * FROM verificar_y_proponer_copas('<torneo_id>');
-- ============================================================
CREATE OR REPLACE FUNCTION public.verificar_y_proponer_copas(p_torneo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_esquema         RECORD;
  v_regla           JSONB;
  v_posicion        INTEGER;
  v_cantidad        INTEGER;
  v_criterio        TEXT;
  v_nuevos          UUID[];
  v_equipos         UUID[];
  v_ya_asignados    UUID[] := ARRAY[]::UUID[];
  v_len             INTEGER;
  v_propuestas      INTEGER := 0;
BEGIN

  -- Cargar parejas ya en propuestas pendientes/aprobadas de este torneo
  -- para no reutilizarlas en otros esquemas
  SELECT array_agg(x.pareja_id)
  INTO v_ya_asignados
  FROM (
    SELECT DISTINCT unnest(ARRAY[pc.pareja_a_id, pc.pareja_b_id]) AS pareja_id
    FROM propuestas_copa pc
    JOIN esquemas_copa ec ON ec.id = pc.esquema_copa_id
    WHERE ec.torneo_id = p_torneo_id
      AND pc.estado IN ('pendiente', 'aprobado')
      AND pc.pareja_a_id IS NOT NULL
  ) x;

  IF v_ya_asignados IS NULL THEN
    v_ya_asignados := ARRAY[]::UUID[];
  END IF;

  -- Para cada esquema del torneo, en orden
  FOR v_esquema IN
    SELECT * FROM esquemas_copa
    WHERE torneo_id = p_torneo_id
    ORDER BY orden
  LOOP

    -- Idempotencia: skip si ya tiene propuestas pendientes/aprobadas
    IF EXISTS (
      SELECT 1 FROM propuestas_copa
      WHERE esquema_copa_id = v_esquema.id
        AND estado IN ('pendiente', 'aprobado')
    ) THEN
      CONTINUE;
    END IF;

    v_equipos := ARRAY[]::UUID[];

    -- Evaluar cada regla del esquema
    FOR v_regla IN SELECT jsonb_array_elements(v_esquema.reglas)
    LOOP
      v_posicion := (v_regla->>'posicion')::INTEGER;
      v_cantidad := (v_regla->>'cantidad')::INTEGER;   -- NULL = todos
      v_criterio := v_regla->>'criterio';              -- NULL = por grupo

      IF v_criterio IS NULL THEN
        -- Sin ranking cruzado: tomar el N-ésimo de cada grupo completo
        SELECT array_agg(s.pareja_id ORDER BY s.grupo_id)
        INTO v_nuevos
        FROM obtener_standings_torneo(p_torneo_id) s
        WHERE s.posicion_en_grupo = v_posicion
          AND s.grupo_completo = TRUE
          AND s.pareja_id <> ALL(v_ya_asignados)
          AND s.pareja_id <> ALL(v_equipos);

      ELSIF v_criterio = 'mejor' THEN
        -- Ranking cruzado: los K mejores N-ésimos entre todos los grupos
        SELECT array_agg(s.pareja_id ORDER BY s.puntos DESC, s.ds DESC, s.gf DESC)
        INTO v_nuevos
        FROM (
          SELECT *
          FROM obtener_standings_torneo(p_torneo_id)
          WHERE posicion_en_grupo = v_posicion
            AND grupo_completo = TRUE
            AND pareja_id <> ALL(v_ya_asignados)
            AND pareja_id <> ALL(v_equipos)
          ORDER BY puntos DESC, ds DESC, gf DESC
          LIMIT COALESCE(v_cantidad, 999)
        ) s;

      ELSIF v_criterio = 'peor' THEN
        -- Ranking cruzado: los K peores N-ésimos entre todos los grupos
        SELECT array_agg(s.pareja_id ORDER BY s.puntos ASC, s.ds ASC, s.gf ASC)
        INTO v_nuevos
        FROM (
          SELECT *
          FROM obtener_standings_torneo(p_torneo_id)
          WHERE posicion_en_grupo = v_posicion
            AND grupo_completo = TRUE
            AND pareja_id <> ALL(v_ya_asignados)
            AND pareja_id <> ALL(v_equipos)
          ORDER BY puntos ASC, ds ASC, gf ASC
          LIMIT COALESCE(v_cantidad, 999)
        ) s;
      END IF;

      IF v_nuevos IS NOT NULL THEN
        v_equipos := v_equipos || v_nuevos;
      END IF;
    END LOOP;

    -- No hay suficientes equipos para este esquema → esperar
    v_len := COALESCE(array_length(v_equipos, 1), 0);
    IF v_len < 2 THEN
      CONTINUE;
    END IF;

    -- Crear propuestas según formato y cantidad de equipos
    -- Orden del array: mejor primero (índice 1)
    IF v_esquema.formato = 'direct' OR v_len = 2 THEN
      -- Cruce directo: 1 partido
      INSERT INTO propuestas_copa (esquema_copa_id, ronda, pareja_a_id, pareja_b_id, orden)
      VALUES (v_esquema.id, 'direct', v_equipos[1], v_equipos[2], 1);
      v_propuestas := v_propuestas + 1;

    ELSIF v_len >= 4 THEN
      -- Bracket de 4: bombo → 1o vs 4o y 2o vs 3o
      INSERT INTO propuestas_copa (esquema_copa_id, ronda, pareja_a_id, pareja_b_id, orden)
      VALUES
        (v_esquema.id, 'SF', v_equipos[1], v_equipos[4], 1),
        (v_esquema.id, 'SF', v_equipos[2], v_equipos[3], 2);
      v_propuestas := v_propuestas + 2;

    ELSIF v_len = 3 THEN
      -- Bracket de 3: bye al mejor (v_equipos[1]), semi entre 2do y 3ro
      INSERT INTO propuestas_copa (esquema_copa_id, ronda, pareja_a_id, pareja_b_id, orden)
      VALUES (v_esquema.id, 'SF', v_equipos[2], v_equipos[3], 1);
      v_propuestas := v_propuestas + 1;
    END IF;

    -- Marcar equipos como asignados para los siguientes esquemas
    v_ya_asignados := v_ya_asignados || v_equipos;

  END LOOP;

  RETURN jsonb_build_object('propuestas_creadas', v_propuestas);
END;
$$;


-- ============================================================
-- FUNCIÓN: aprobar_propuestas_copa
-- Admin aprueba un conjunto de propuestas de un esquema.
-- Crea la copa (si no existe) y los partidos correspondientes.
-- Llamar con: SELECT aprobar_propuestas_copa('<esquema_copa_id>');
-- ============================================================
CREATE OR REPLACE FUNCTION public.aprobar_propuestas_copa(p_esquema_copa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_esquema   RECORD;
  v_copa_id   UUID;
  v_propuesta RECORD;
  v_torneo_id UUID;
  v_partidos  INTEGER := 0;
BEGIN

  -- Cargar esquema
  SELECT ec.*, ec.torneo_id
  INTO v_esquema
  FROM esquemas_copa ec
  WHERE ec.id = p_esquema_copa_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Esquema no encontrado');
  END IF;

  v_torneo_id := v_esquema.torneo_id;

  -- Crear copa si no existe (buscar por esquema_copa_id o por nombre+torneo)
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

  -- Para cada propuesta pendiente del esquema: crear partido
  FOR v_propuesta IN
    SELECT * FROM propuestas_copa
    WHERE esquema_copa_id = p_esquema_copa_id
      AND estado = 'pendiente'
    ORDER BY orden
  LOOP
    -- Crear partido de copa
    INSERT INTO partidos (
      torneo_id, copa_id, ronda_copa, orden_copa,
      pareja_a_id, pareja_b_id, estado
    )
    VALUES (
      v_torneo_id, v_copa_id, v_propuesta.ronda, v_propuesta.orden,
      v_propuesta.pareja_a_id, v_propuesta.pareja_b_id, 'pendiente'
    );

    -- Marcar propuesta como aprobada
    UPDATE propuestas_copa
    SET estado = 'aprobado'
    WHERE id = v_propuesta.id;

    v_partidos := v_partidos + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'copa_id', v_copa_id,
    'partidos_creados', v_partidos
  );
END;
$$;


-- ============================================================
-- FUNCIÓN: generar_finales_copa
-- Genera automáticamente la final + 3er puesto cuando las semis
-- de una copa están confirmadas. Sin propuesta intermedia.
-- Llamar con: SELECT generar_finales_copa('<copa_id>');
-- ============================================================
CREATE OR REPLACE FUNCTION public.generar_finales_copa(p_copa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copa        RECORD;
  v_semis       RECORD[];
  v_semi1       RECORD;
  v_semi2       RECORD;
  v_ganador1    UUID;
  v_perdedor1   UUID;
  v_ganador2    UUID;
  v_perdedor2   UUID;
  v_partidos    INTEGER := 0;
BEGIN

  SELECT * INTO v_copa FROM copas WHERE id = p_copa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Copa no encontrada');
  END IF;

  -- Verificar que no existe ya final
  IF EXISTS (
    SELECT 1 FROM partidos
    WHERE copa_id = p_copa_id AND ronda_copa = 'F'
  ) THEN
    RETURN jsonb_build_object('msg', 'Final ya existe');
  END IF;

  -- Obtener semis confirmadas con resultado
  SELECT * INTO v_semi1
  FROM partidos
  WHERE copa_id = p_copa_id
    AND ronda_copa = 'SF'
    AND estado = 'confirmado'
    AND sets_a IS NOT NULL
    AND orden_copa = 1;

  SELECT * INTO v_semi2
  FROM partidos
  WHERE copa_id = p_copa_id
    AND ronda_copa = 'SF'
    AND estado = 'confirmado'
    AND sets_a IS NOT NULL
    AND orden_copa = 2;

  -- Ambas semis deben estar confirmadas
  IF v_semi1 IS NULL OR v_semi2 IS NULL THEN
    RETURN jsonb_build_object('msg', 'Semis aún no confirmadas');
  END IF;

  -- Determinar ganadores y perdedores
  -- Semi 1
  IF v_semi1.sets_a > v_semi1.sets_b THEN
    v_ganador1  := v_semi1.pareja_a_id;
    v_perdedor1 := v_semi1.pareja_b_id;
  ELSE
    v_ganador1  := v_semi1.pareja_b_id;
    v_perdedor1 := v_semi1.pareja_a_id;
  END IF;

  -- Semi 2
  IF v_semi2.sets_a > v_semi2.sets_b THEN
    v_ganador2  := v_semi2.pareja_a_id;
    v_perdedor2 := v_semi2.pareja_b_id;
  ELSE
    v_ganador2  := v_semi2.pareja_b_id;
    v_perdedor2 := v_semi2.pareja_a_id;
  END IF;

  -- Crear final (ganador1 vs ganador2)
  INSERT INTO partidos (torneo_id, copa_id, ronda_copa, orden_copa, pareja_a_id, pareja_b_id, estado)
  VALUES (v_copa.torneo_id, p_copa_id, 'F', 1, v_ganador1, v_ganador2, 'pendiente');

  -- Crear 3er puesto (perdedor1 vs perdedor2)
  INSERT INTO partidos (torneo_id, copa_id, ronda_copa, orden_copa, pareja_a_id, pareja_b_id, estado)
  VALUES (v_copa.torneo_id, p_copa_id, '3P', 1, v_perdedor1, v_perdedor2, 'pendiente');

  v_partidos := 2;

  RETURN jsonb_build_object('partidos_creados', v_partidos);
END;
$$;


-- ============================================================
-- FUNCIÓN: reset_copas_torneo
-- Borra todas las copas generadas (partidos + copas + propuestas)
-- Conserva el plan (esquemas_copa).
-- Llamar con: SELECT reset_copas_torneo('<torneo_id>');
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_copas_torneo(p_torneo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partidos_borrados INTEGER;
  v_copas_borradas    INTEGER;
  v_propuestas_reset  INTEGER;
BEGIN

  -- Borrar partidos de copa
  DELETE FROM partidos
  WHERE torneo_id = p_torneo_id
    AND copa_id IS NOT NULL;
  GET DIAGNOSTICS v_partidos_borrados = ROW_COUNT;

  -- Borrar copas
  DELETE FROM copas
  WHERE torneo_id = p_torneo_id;
  GET DIAGNOSTICS v_copas_borradas = ROW_COUNT;

  -- Resetear propuestas a descartado (conservar historial)
  UPDATE propuestas_copa pc
  SET estado = 'descartado'
  FROM esquemas_copa ec
  WHERE ec.id = pc.esquema_copa_id
    AND ec.torneo_id = p_torneo_id
    AND pc.estado IN ('pendiente', 'aprobado');
  GET DIAGNOSTICS v_propuestas_reset = ROW_COUNT;

  RETURN jsonb_build_object(
    'partidos_borrados', v_partidos_borrados,
    'copas_borradas', v_copas_borradas,
    'propuestas_reset', v_propuestas_reset
  );
END;
$$;
