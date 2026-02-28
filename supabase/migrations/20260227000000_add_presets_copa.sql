-- Migración: Presets de copas + soporte modo:global en el motor
--
-- 1. Tabla `presets_copa`  — presets reutilizables (defaults hardcodeados + custom del admin)
-- 2. RLS para presets_copa
-- 3. INSERT de presets por defecto (migrados desde presets.js)
-- 4. UPDATE de `verificar_y_proponer_copas` — soporte para reglas {modo:'global', desde:D, hasta:H}


-- ============================================================
-- TABLA: presets_copa
-- Catálogo de presets de copas. Los defaults (es_default=true)
-- se cargan desde este script. Los custom los crea el admin.
-- ============================================================
CREATE TABLE public.presets_copa (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text    NOT NULL,
  clave       text    NOT NULL,   -- ej: "2x4", "2x4-dos-brackets", "4x3-custom"
  descripcion text,
  esquemas    jsonb   NOT NULL DEFAULT '[]',
  es_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.presets_copa ENABLE ROW LEVEL SECURITY;

-- Lectura pública
CREATE POLICY "presets_copa_select"
ON public.presets_copa FOR SELECT
TO public
USING (true);

-- Escritura: solo admin autenticado (INSERT/UPDATE/DELETE)
-- Los defaults se insertan en esta migración (bypass via superuser).
CREATE POLICY "presets_copa_write_admin"
ON public.presets_copa FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ============================================================
-- SEED: Presets por defecto
-- Migrados desde src/admin/copas/presets.js
-- ============================================================

-- 2 grupos × 3 parejas
INSERT INTO public.presets_copa (nombre, clave, descripcion, esquemas, es_default) VALUES
(
  '2x3 — Cruces directos', '2x3',
  '3 copas de 1 partido: 1°vs1°, 2°vs2°, 3°vs3°',
  '[
    {"nombre":"Copa Oro",    "orden":1,"formato":"direct","reglas":[{"posicion":1}]},
    {"nombre":"Copa Plata",  "orden":2,"formato":"direct","reglas":[{"posicion":2}]},
    {"nombre":"Copa Bronce", "orden":3,"formato":"direct","reglas":[{"posicion":3}]}
  ]'::jsonb,
  true
);

-- 2 grupos × 4 parejas (cruces directos)
INSERT INTO public.presets_copa (nombre, clave, descripcion, esquemas, es_default) VALUES
(
  '2x4 — Cruces directos', '2x4',
  '4 copas de 1 partido: 1°vs1°, 2°vs2°, 3°vs3°, 4°vs4°',
  '[
    {"nombre":"Copa Oro",    "orden":1,"formato":"direct","reglas":[{"posicion":1}]},
    {"nombre":"Copa Plata",  "orden":2,"formato":"direct","reglas":[{"posicion":2}]},
    {"nombre":"Copa Bronce", "orden":3,"formato":"direct","reglas":[{"posicion":3}]},
    {"nombre":"Copa Madera", "orden":4,"formato":"direct","reglas":[{"posicion":4}]}
  ]'::jsonb,
  true
);

-- 2 grupos × 4 parejas (dos brackets de 4)
INSERT INTO public.presets_copa (nombre, clave, descripcion, esquemas, es_default) VALUES
(
  '2x4 — Dos brackets de 4', '2x4-dos-brackets',
  '2 copas semi+final: Oro con 1°+2° de cada grupo, Plata con 3°+4°',
  '[
    {"nombre":"Copa Oro",  "orden":1,"formato":"bracket","reglas":[{"posicion":1},{"posicion":2}]},
    {"nombre":"Copa Plata","orden":2,"formato":"bracket","reglas":[{"posicion":3},{"posicion":4}]}
  ]'::jsonb,
  true
);

-- 2 grupos × 5 parejas
INSERT INTO public.presets_copa (nombre, clave, descripcion, esquemas, es_default) VALUES
(
  '2x5 — Cruces directos', '2x5',
  '5 copas de 1 partido cada una',
  '[
    {"nombre":"Copa Oro",    "orden":1,"formato":"direct","reglas":[{"posicion":1}]},
    {"nombre":"Copa Plata",  "orden":2,"formato":"direct","reglas":[{"posicion":2}]},
    {"nombre":"Copa Bronce", "orden":3,"formato":"direct","reglas":[{"posicion":3}]},
    {"nombre":"Copa Cartón", "orden":4,"formato":"direct","reglas":[{"posicion":4}]},
    {"nombre":"Copa Papel",  "orden":5,"formato":"direct","reglas":[{"posicion":5}]}
  ]'::jsonb,
  true
);

-- 2 grupos × 6 parejas
INSERT INTO public.presets_copa (nombre, clave, descripcion, esquemas, es_default) VALUES
(
  '2x6 — Cruces directos', '2x6',
  '6 copas de 1 partido cada una',
  '[
    {"nombre":"Copa Oro",    "orden":1,"formato":"direct","reglas":[{"posicion":1}]},
    {"nombre":"Copa Plata",  "orden":2,"formato":"direct","reglas":[{"posicion":2}]},
    {"nombre":"Copa Bronce", "orden":3,"formato":"direct","reglas":[{"posicion":3}]},
    {"nombre":"Copa Madera", "orden":4,"formato":"direct","reglas":[{"posicion":4}]},
    {"nombre":"Copa Cartón", "orden":5,"formato":"direct","reglas":[{"posicion":5}]},
    {"nombre":"Copa Papel",  "orden":6,"formato":"direct","reglas":[{"posicion":6}]}
  ]'::jsonb,
  true
);

-- 3 grupos × 3 parejas (brackets de 3, bye al mejor 1°)
INSERT INTO public.presets_copa (nombre, clave, descripcion, esquemas, es_default) VALUES
(
  '3x3 — Brackets de 3', '3x3',
  '3 copas en bracket de 3 equipos (bye al mejor 1°)',
  '[
    {"nombre":"Copa Oro",    "orden":1,"formato":"bracket","reglas":[{"posicion":1}]},
    {"nombre":"Copa Plata",  "orden":2,"formato":"bracket","reglas":[{"posicion":2}]},
    {"nombre":"Copa Bronce", "orden":3,"formato":"bracket","reglas":[{"posicion":3}]}
  ]'::jsonb,
  true
);

-- 3 grupos × 4 parejas (ranking cruzado para completar brackets de 4)
INSERT INTO public.presets_copa (nombre, clave, descripcion, esquemas, es_default) VALUES
(
  '3x4 — Ranking cruzado', '3x4',
  '3 copas de 4 equipos con mejor/peor 2° y 3°',
  '[
    {
      "nombre":"Copa Oro",    "orden":1,"formato":"bracket",
      "reglas":[{"posicion":1},{"posicion":2,"cantidad":1,"criterio":"mejor"}]
    },
    {
      "nombre":"Copa Plata",  "orden":2,"formato":"bracket",
      "reglas":[{"posicion":2,"cantidad":2,"criterio":"peor"},{"posicion":3,"cantidad":2,"criterio":"mejor"}]
    },
    {
      "nombre":"Copa Bronce", "orden":3,"formato":"bracket",
      "reglas":[{"posicion":3,"cantidad":1,"criterio":"peor"},{"posicion":4}]
    }
  ]'::jsonb,
  true
);

-- 4 grupos × 3 parejas (brackets de 4 limpios)
INSERT INTO public.presets_copa (nombre, clave, descripcion, esquemas, es_default) VALUES
(
  '4x3 — Brackets de 4', '4x3',
  '3 copas en bracket de 4 equipos cada una',
  '[
    {"nombre":"Copa Oro",    "orden":1,"formato":"bracket","reglas":[{"posicion":1}]},
    {"nombre":"Copa Plata",  "orden":2,"formato":"bracket","reglas":[{"posicion":2}]},
    {"nombre":"Copa Bronce", "orden":3,"formato":"bracket","reglas":[{"posicion":3}]}
  ]'::jsonb,
  true
);

-- 4 grupos × 4 parejas (brackets de 4 limpios)
INSERT INTO public.presets_copa (nombre, clave, descripcion, esquemas, es_default) VALUES
(
  '4x4 — Brackets de 4', '4x4',
  '4 copas en bracket de 4 equipos cada una',
  '[
    {"nombre":"Copa Oro",    "orden":1,"formato":"bracket","reglas":[{"posicion":1}]},
    {"nombre":"Copa Plata",  "orden":2,"formato":"bracket","reglas":[{"posicion":2}]},
    {"nombre":"Copa Bronce", "orden":3,"formato":"bracket","reglas":[{"posicion":3}]},
    {"nombre":"Copa Madera", "orden":4,"formato":"bracket","reglas":[{"posicion":4}]}
  ]'::jsonb,
  true
);


-- ============================================================
-- UPDATE: verificar_y_proponer_copas
-- Agrega soporte para reglas con modo:'global' (tabla general del torneo).
-- Requiere que TODOS los grupos del torneo estén completos.
-- Toma los puestos desde..hasta del ranking global.
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
  v_modo            TEXT;
  v_desde           INTEGER;
  v_hasta           INTEGER;
  v_nuevos          UUID[];
  v_equipos         UUID[];
  v_ya_asignados    UUID[] := ARRAY[]::UUID[];
  v_len             INTEGER;
  v_propuestas      INTEGER := 0;
  v_todos_completos BOOLEAN;
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
    <<reglas_loop>>
    FOR v_regla IN SELECT jsonb_array_elements(v_esquema.reglas)
    LOOP
      v_modo     := v_regla->>'modo';
      v_posicion := (v_regla->>'posicion')::INTEGER;
      v_cantidad := (v_regla->>'cantidad')::INTEGER;   -- NULL = todos
      v_criterio := v_regla->>'criterio';              -- NULL = por grupo

      IF v_modo = 'global' THEN
        -- ── Modo tabla general ──────────────────────────────────────────────────
        -- Verificar que TODOS los grupos del torneo están completos.
        -- Si alguno falta, saltar este esquema (será re-evaluado la próxima vez).
        SELECT bool_and(t.grupo_completo)
        INTO v_todos_completos
        FROM (
          SELECT DISTINCT grupo_id, grupo_completo
          FROM obtener_standings_torneo(p_torneo_id)
        ) t;

        IF v_todos_completos IS NOT TRUE THEN
          -- No todos completos → limpiar equipos y salir del loop de reglas
          v_equipos := ARRAY[]::UUID[];
          EXIT reglas_loop;
        END IF;

        v_desde := COALESCE((v_regla->>'desde')::INTEGER, 1);
        v_hasta := COALESCE((v_regla->>'hasta')::INTEGER, v_desde + 3);

        -- Ranking global: posiciones v_desde..v_hasta (excluyendo ya asignados)
        SELECT array_agg(s.pareja_id ORDER BY s.rank_global)
        INTO v_nuevos
        FROM (
          SELECT
            pareja_id,
            ROW_NUMBER() OVER (
              ORDER BY puntos DESC, ds DESC, gf DESC, pareja_id
            ) AS rank_global
          FROM obtener_standings_torneo(p_torneo_id)
          WHERE grupo_completo = TRUE
            AND pareja_id <> ALL(v_ya_asignados)
            AND pareja_id <> ALL(v_equipos)
        ) s
        WHERE s.rank_global BETWEEN v_desde AND v_hasta;

      ELSIF v_criterio IS NULL THEN
        -- ── Sin ranking cruzado: N-ésimo de cada grupo completo ─────────────────
        SELECT array_agg(s.pareja_id ORDER BY s.grupo_id)
        INTO v_nuevos
        FROM obtener_standings_torneo(p_torneo_id) s
        WHERE s.posicion_en_grupo = v_posicion
          AND s.grupo_completo = TRUE
          AND s.pareja_id <> ALL(v_ya_asignados)
          AND s.pareja_id <> ALL(v_equipos);

      ELSIF v_criterio = 'mejor' THEN
        -- ── Ranking cruzado: los K mejores N-ésimos ─────────────────────────────
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
        -- ── Ranking cruzado: los K peores N-ésimos ──────────────────────────────
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
    END LOOP reglas_loop;

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
