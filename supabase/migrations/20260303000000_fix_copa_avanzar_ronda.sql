-- ============================================================
-- MIGRACIÓN: fix_copa_avanzar_ronda
-- 1. Fix verificar_y_proponer_copas: rama modo 'global' + soporte 8 equipos
--    + fix race condition (requiere TODOS los grupos completos para modo global)
-- 2. Nuevo RPC avanzar_ronda_copa (reemplaza generar_finales_copa)
-- 3. Drop generar_finales_copa
-- ============================================================


-- ============================================================
-- 1A + 1B + 1C. Fix verificar_y_proponer_copas
-- - Rama modo:'global' para seeding por ranking general
-- - Soporte bracket de 8 equipos (QF)
-- - Guard: esquemas con modo 'global' requieren que TODOS
--   los grupos estén completos (previene race condition cuando
--   carga.html dispara el RPC partido por partido)
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
  v_tiene_global    BOOLEAN;
  v_grupos_total    INTEGER;
  v_grupos_completos INTEGER;
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

  -- Pre-calcular: cuantos grupos hay y cuantos estan completos?
  -- Un grupo esta completo si todos sus partidos tienen sets_a (resultado cargado)
  SELECT COUNT(DISTINCT g.id) INTO v_grupos_total
  FROM grupos g
  WHERE g.torneo_id = p_torneo_id;

  SELECT COUNT(DISTINCT sub.grupo_id) INTO v_grupos_completos
  FROM (
    SELECT p.grupo_id
    FROM partidos p
    WHERE p.torneo_id = p_torneo_id
      AND p.copa_id IS NULL
      AND p.grupo_id IS NOT NULL
    GROUP BY p.grupo_id
    HAVING COUNT(*) > 0
       AND COUNT(*) = COUNT(CASE WHEN p.sets_a IS NOT NULL THEN 1 END)
  ) sub;

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

    -- Si el esquema tiene reglas con modo 'global', requerir que
    -- TODOS los grupos esten completos antes de generar propuestas.
    -- Esto previene race conditions cuando carga.html dispara el RPC
    -- partido por partido (un grupo completo antes que otro).
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_esquema.reglas) r
      WHERE (r->>'modo') = 'global'
    ) INTO v_tiene_global;

    IF v_tiene_global AND v_grupos_completos < v_grupos_total THEN
      CONTINUE;  -- No todos los grupos terminaron, esperar
    END IF;

    v_equipos := ARRAY[]::UUID[];

    -- Evaluar cada regla del esquema
    FOR v_regla IN SELECT jsonb_array_elements(v_esquema.reglas)
    LOOP
      v_posicion := (v_regla->>'posicion')::INTEGER;
      v_cantidad := (v_regla->>'cantidad')::INTEGER;   -- NULL = todos
      v_criterio := v_regla->>'criterio';              -- NULL = por grupo

      IF v_criterio IS NULL AND (v_regla->>'modo') IS NULL THEN
        -- Sin ranking cruzado: tomar el N-esimo de cada grupo completo
        SELECT array_agg(s.pareja_id ORDER BY s.grupo_id)
        INTO v_nuevos
        FROM obtener_standings_torneo(p_torneo_id) s
        WHERE s.posicion_en_grupo = v_posicion
          AND s.grupo_completo = TRUE
          AND s.pareja_id <> ALL(v_ya_asignados)
          AND s.pareja_id <> ALL(v_equipos);

      ELSIF v_criterio = 'mejor' THEN
        -- Ranking cruzado: los K mejores N-esimos entre todos los grupos
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
        -- Ranking cruzado: los K peores N-esimos entre todos los grupos
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

      ELSIF (v_regla->>'modo') = 'global' THEN
        -- Seeding por ranking global del torneo (tabla general)
        -- Nota: ya verificamos que todos los grupos estan completos arriba
        SELECT array_agg(ranked.pareja_id)
        INTO v_nuevos
        FROM (
          SELECT s.pareja_id
          FROM obtener_standings_torneo(p_torneo_id) s
          WHERE s.grupo_completo = TRUE
            AND s.pareja_id <> ALL(v_ya_asignados)
            AND s.pareja_id <> ALL(v_equipos)
          ORDER BY s.puntos DESC, s.ds DESC, s.gf DESC
          LIMIT ((v_regla->>'hasta')::INTEGER - (v_regla->>'desde')::INTEGER + 1)
          OFFSET ((v_regla->>'desde')::INTEGER - 1)
        ) ranked;

      END IF;

      IF v_nuevos IS NOT NULL THEN
        v_equipos := v_equipos || v_nuevos;
      END IF;
    END LOOP;

    -- No hay suficientes equipos para este esquema -> esperar
    v_len := COALESCE(array_length(v_equipos, 1), 0);
    IF v_len < 2 THEN
      CONTINUE;
    END IF;

    -- Crear propuestas segun formato y cantidad de equipos
    -- Orden del array: mejor primero (indice 1)
    IF v_esquema.formato = 'direct' OR v_len = 2 THEN
      -- Cruce directo: 1 partido
      INSERT INTO propuestas_copa (esquema_copa_id, ronda, pareja_a_id, pareja_b_id, orden)
      VALUES (v_esquema.id, 'direct', v_equipos[1], v_equipos[2], 1);
      v_propuestas := v_propuestas + 1;

    ELSIF v_len >= 8 THEN
      -- Bracket de 8: cuartos de final con seeding estandar
      INSERT INTO propuestas_copa (esquema_copa_id, ronda, pareja_a_id, pareja_b_id, orden)
      VALUES
        (v_esquema.id, 'QF', v_equipos[1], v_equipos[8], 1),
        (v_esquema.id, 'QF', v_equipos[2], v_equipos[7], 2),
        (v_esquema.id, 'QF', v_equipos[3], v_equipos[6], 3),
        (v_esquema.id, 'QF', v_equipos[4], v_equipos[5], 4);
      v_propuestas := v_propuestas + 4;

    ELSIF v_len >= 4 THEN
      -- Bracket de 4: bombo -> 1o vs 4o y 2o vs 3o
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
-- 2. Nuevo RPC avanzar_ronda_copa
-- Avanza el bracket de una copa: cuando todos los partidos de una
-- ronda estan confirmados, genera los partidos de la siguiente ronda.
-- Generico: funciona para QF->SF, SF->F(+3P), etc.
-- Idempotente: si la siguiente ronda ya tiene partidos, no crea duplicados.
-- Reemplaza a generar_finales_copa.
-- Llamar con: SELECT avanzar_ronda_copa('<copa_id>');
-- ============================================================
CREATE OR REPLACE FUNCTION public.avanzar_ronda_copa(p_copa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copa              RECORD;
  v_ronda_actual      TEXT;
  v_ronda_siguiente   TEXT;
  v_partido           RECORD;
  v_ganadores         UUID[];
  v_perdedores        UUID[];
  v_ganador           UUID;
  v_perdedor          UUID;
  v_total             INTEGER;
  v_confirmados       INTEGER;
  v_partidos_creados  INTEGER := 0;
  v_i                 INTEGER;
BEGIN
  -- Validar copa
  SELECT * INTO v_copa FROM copas WHERE id = p_copa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Copa no encontrada');
  END IF;

  -- Intentar avanzar cada ronda posible: QF -> SF -> F
  -- (iterar en orden, la primera que pueda avanzar se procesa)
  FOREACH v_ronda_actual IN ARRAY ARRAY['QF', 'SF']
  LOOP
    -- Determinar siguiente ronda
    IF v_ronda_actual = 'QF' THEN
      v_ronda_siguiente := 'SF';
    ELSIF v_ronda_actual = 'SF' THEN
      v_ronda_siguiente := 'F';
    END IF;

    -- Contar partidos de esta ronda
    SELECT COUNT(*) INTO v_total
    FROM partidos
    WHERE copa_id = p_copa_id AND ronda_copa = v_ronda_actual;

    -- Si no hay partidos de esta ronda, pasar a la siguiente
    IF v_total = 0 THEN
      CONTINUE;
    END IF;

    -- Contar confirmados con resultado
    SELECT COUNT(*) INTO v_confirmados
    FROM partidos
    WHERE copa_id = p_copa_id
      AND ronda_copa = v_ronda_actual
      AND estado = 'confirmado'
      AND sets_a IS NOT NULL;

    -- Si no estan todos confirmados, no se puede avanzar
    IF v_confirmados < v_total THEN
      CONTINUE;
    END IF;

    -- Verificar idempotencia: si ya hay partidos de la siguiente ronda, skip
    IF EXISTS (
      SELECT 1 FROM partidos
      WHERE copa_id = p_copa_id AND ronda_copa = v_ronda_siguiente
    ) THEN
      CONTINUE;
    END IF;

    -- Recolectar ganadores y perdedores, ordenados por orden_copa
    v_ganadores := ARRAY[]::UUID[];
    v_perdedores := ARRAY[]::UUID[];

    FOR v_partido IN
      SELECT * FROM partidos
      WHERE copa_id = p_copa_id AND ronda_copa = v_ronda_actual
      ORDER BY orden_copa
    LOOP
      IF v_partido.sets_a > v_partido.sets_b THEN
        v_ganador := v_partido.pareja_a_id;
        v_perdedor := v_partido.pareja_b_id;
      ELSE
        v_ganador := v_partido.pareja_b_id;
        v_perdedor := v_partido.pareja_a_id;
      END IF;

      v_ganadores := array_append(v_ganadores, v_ganador);
      v_perdedores := array_append(v_perdedores, v_perdedor);
    END LOOP;

    -- Crear partidos de la siguiente ronda:
    -- Emparejar ganadores: [1] vs [2] -> orden 1, [3] vs [4] -> orden 2, etc.
    v_i := 1;
    WHILE v_i < array_length(v_ganadores, 1) LOOP
      INSERT INTO partidos (torneo_id, copa_id, ronda_copa, orden_copa, pareja_a_id, pareja_b_id, estado)
      VALUES (v_copa.torneo_id, p_copa_id, v_ronda_siguiente, (v_i + 1) / 2,
              v_ganadores[v_i], v_ganadores[v_i + 1], 'pendiente');
      v_partidos_creados := v_partidos_creados + 1;
      v_i := v_i + 2;
    END LOOP;

    -- Crear 3er y 4to puesto SOLO cuando avanzamos a Final (SF -> F)
    -- y hay exactamente 2 perdedores
    IF v_ronda_siguiente = 'F' AND array_length(v_perdedores, 1) = 2 THEN
      -- Solo crear si no existe ya
      IF NOT EXISTS (
        SELECT 1 FROM partidos
        WHERE copa_id = p_copa_id AND ronda_copa = '3P'
      ) THEN
        INSERT INTO partidos (torneo_id, copa_id, ronda_copa, orden_copa, pareja_a_id, pareja_b_id, estado)
        VALUES (v_copa.torneo_id, p_copa_id, '3P', 1,
                v_perdedores[1], v_perdedores[2], 'pendiente');
        v_partidos_creados := v_partidos_creados + 1;
      END IF;
    END IF;

    -- Se proceso una ronda, retornar (una ronda por llamada)
    RETURN jsonb_build_object(
      'ronda_completada', v_ronda_actual,
      'ronda_creada', v_ronda_siguiente,
      'partidos_creados', v_partidos_creados
    );

  END LOOP;

  -- Ninguna ronda pudo avanzar
  RETURN jsonb_build_object('msg', 'Nada que avanzar');
END;
$$;


-- ============================================================
-- 3. Eliminar generar_finales_copa (reemplazada por avanzar_ronda_copa)
-- ============================================================
DROP FUNCTION IF EXISTS public.generar_finales_copa(UUID);
