-- ============================================================
-- MIGRACIÓN: propuestas_progresivas
-- 1. verificar_y_proponer_copas:
--    - Recálculo de pendientes (borra pendientes y recalcula cuando hay aprobadas)
--    - Propuestas parciales con NULL para seeding por posición de grupo
-- 2. aprobar_propuestas_copa:
--    - Nuevo parámetro p_propuesta_ids para aprobación individual
-- ============================================================


-- ============================================================
-- 1. MODIFICAR verificar_y_proponer_copas
--    Cambios respecto a la versión en 20260303000000_fix_copa_avanzar_ronda.sql:
--    a) v_ya_asignados: solo propuestas aprobadas (no pendientes)
--    b) Guard por esquema: borra pendientes y recalcula en vez de CONTINUE
--    c) Para seeding por posición: rellena con NULL hasta el total esperado
--    d) Mínimo de 2 equipos reales (no NULL) para generar propuestas
-- ============================================================
CREATE OR REPLACE FUNCTION public.verificar_y_proponer_copas(p_torneo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_esquema          RECORD;
  v_regla            JSONB;
  v_posicion         INTEGER;
  v_cantidad         INTEGER;
  v_criterio         TEXT;
  v_nuevos           UUID[];
  v_equipos          UUID[];
  v_ya_asignados     UUID[] := ARRAY[]::UUID[];
  v_len              INTEGER;
  v_real_count       INTEGER;
  v_expected         INTEGER;
  v_propuestas       INTEGER := 0;
  v_tiene_global     BOOLEAN;
  v_grupos_total     INTEGER;
  v_grupos_completos INTEGER;
  v_i                INTEGER;
BEGIN

  -- Solo incluir equipos de propuestas APROBADAS (no pendientes).
  -- Las pendientes se van a recalcular, así que no deben bloquear la re-asignación.
  SELECT array_agg(x.pareja_id)
  INTO v_ya_asignados
  FROM (
    SELECT DISTINCT unnest(ARRAY[pc.pareja_a_id, pc.pareja_b_id]) AS pareja_id
    FROM propuestas_copa pc
    JOIN esquemas_copa ec ON ec.id = pc.esquema_copa_id
    WHERE ec.torneo_id = p_torneo_id
      AND pc.estado = 'aprobado'          -- CAMBIO: antes era IN ('pendiente', 'aprobado')
      AND pc.pareja_a_id IS NOT NULL
  ) x;

  IF v_ya_asignados IS NULL THEN
    v_ya_asignados := ARRAY[]::UUID[];
  END IF;

  -- Cantidad total de grupos del torneo
  SELECT COUNT(DISTINCT g.id) INTO v_grupos_total
  FROM grupos g
  WHERE g.torneo_id = p_torneo_id;

  -- Grupos con todos sus partidos con resultado (sets_a NOT NULL)
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

    -- -------------------------------------------------------
    -- Gestión de propuestas existentes para este esquema
    -- - Si hay aprobadas: borrar solo las pendientes y recalcular
    --   (los equipos aprobados ya están en v_ya_asignados y se excluyen)
    -- - Si solo hay pendientes (sin aprobadas): borrar todas y recalcular
    -- - Si no hay nada: generar desde cero
    -- -------------------------------------------------------
    IF EXISTS (
      SELECT 1 FROM propuestas_copa
      WHERE esquema_copa_id = v_esquema.id AND estado = 'aprobado'
    ) THEN
      -- Hay aprobadas → borrar solo pendientes y recalcular slots restantes
      DELETE FROM propuestas_copa
      WHERE esquema_copa_id = v_esquema.id AND estado = 'pendiente';
      -- Continuar con la generación de los slots que faltan

    ELSIF EXISTS (
      SELECT 1 FROM propuestas_copa
      WHERE esquema_copa_id = v_esquema.id AND estado = 'pendiente'
    ) THEN
      -- Solo hay pendientes → borrar todas y recalcular con info más actualizada
      DELETE FROM propuestas_copa
      WHERE esquema_copa_id = v_esquema.id AND estado = 'pendiente';
      -- Continuar con la generación

    END IF;
    -- Si no había nada: también continúa con la generación (fall-through)

    -- -------------------------------------------------------
    -- Guard modo global: requiere TODOS los grupos completos
    -- -------------------------------------------------------
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_esquema.reglas) r
      WHERE (r->>'modo') = 'global'
    ) INTO v_tiene_global;

    IF v_tiene_global AND v_grupos_completos < v_grupos_total THEN
      CONTINUE;  -- No todos los grupos terminaron
    END IF;

    v_equipos := ARRAY[]::UUID[];

    -- -------------------------------------------------------
    -- Recolectar equipos disponibles según las reglas del esquema
    -- -------------------------------------------------------
    FOR v_regla IN SELECT jsonb_array_elements(v_esquema.reglas)
    LOOP
      v_posicion := (v_regla->>'posicion')::INTEGER;
      v_cantidad := (v_regla->>'cantidad')::INTEGER;
      v_criterio := v_regla->>'criterio';

      IF v_criterio IS NULL AND (v_regla->>'modo') IS NULL THEN
        -- Sin ranking cruzado: el N-ésimo de cada grupo completo
        SELECT array_agg(s.pareja_id ORDER BY s.grupo_id)
        INTO v_nuevos
        FROM obtener_standings_torneo(p_torneo_id) s
        WHERE s.posicion_en_grupo = v_posicion
          AND s.grupo_completo = TRUE
          AND s.pareja_id <> ALL(v_ya_asignados)
          AND s.pareja_id <> ALL(v_equipos);

      ELSIF v_criterio = 'mejor' THEN
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

    -- -------------------------------------------------------
    -- Para seeding por posición (no global): rellenar con NULLs
    -- hasta el total esperado para generar propuestas parciales.
    -- Esto permite mostrar "Semi 2: B vs C [Aprobar]" aunque
    -- todavía no se sepa quién juega la Semi 1.
    -- -------------------------------------------------------
    IF NOT v_tiene_global THEN
      -- Calcular cuántos equipos se esperan en total para este esquema
      v_expected := 0;
      FOR v_regla IN SELECT jsonb_array_elements(v_esquema.reglas)
      LOOP
        IF (v_regla->>'modo') = 'global' THEN
          NULL; -- no debería llegar aquí (v_tiene_global = false)
        ELSIF (v_regla->>'criterio') IS NOT NULL THEN
          v_expected := v_expected + COALESCE((v_regla->>'cantidad')::INTEGER, v_grupos_total);
        ELSE
          -- posición sin criterio: uno por grupo
          v_expected := v_expected + v_grupos_total;
        END IF;
      END LOOP;

      -- Rellenar con NULLs hasta alcanzar el total esperado
      v_len := COALESCE(array_length(v_equipos, 1), 0);
      IF v_len > 0 AND v_len < v_expected THEN
        v_i := v_len + 1;
        WHILE v_i <= v_expected LOOP
          v_equipos := v_equipos || ARRAY[NULL::UUID];
          v_i := v_i + 1;
        END LOOP;
      END IF;
    END IF;

    -- Contar equipos reales (no NULL) — necesitamos al menos 2 para generar
    SELECT COUNT(*) INTO v_real_count
    FROM (SELECT unnest(v_equipos) AS t) sub
    WHERE sub.t IS NOT NULL;

    IF v_real_count < 2 THEN
      CONTINUE;
    END IF;

    -- v_len final (incluye NULLs si se añadieron)
    v_len := COALESCE(array_length(v_equipos, 1), 0);

    -- -------------------------------------------------------
    -- Crear propuestas según formato y cantidad de equipos
    -- (v_equipos puede contener NULLs para slots pendientes)
    -- -------------------------------------------------------
    IF v_esquema.formato = 'direct' OR v_len = 2 THEN
      -- Cruce directo: solo si ambos son reales
      IF v_real_count >= 2 THEN
        INSERT INTO propuestas_copa (esquema_copa_id, ronda, pareja_a_id, pareja_b_id, orden)
        VALUES (v_esquema.id, 'direct', v_equipos[1], v_equipos[2], 1);
        v_propuestas := v_propuestas + 1;
      END IF;

    ELSIF v_len >= 8 THEN
      INSERT INTO propuestas_copa (esquema_copa_id, ronda, pareja_a_id, pareja_b_id, orden)
      VALUES
        (v_esquema.id, 'QF', v_equipos[1], v_equipos[8], 1),
        (v_esquema.id, 'QF', v_equipos[2], v_equipos[7], 2),
        (v_esquema.id, 'QF', v_equipos[3], v_equipos[6], 3),
        (v_esquema.id, 'QF', v_equipos[4], v_equipos[5], 4);
      v_propuestas := v_propuestas + 4;

    ELSIF v_len >= 4 THEN
      INSERT INTO propuestas_copa (esquema_copa_id, ronda, pareja_a_id, pareja_b_id, orden)
      VALUES
        (v_esquema.id, 'SF', v_equipos[1], v_equipos[4], 1),
        (v_esquema.id, 'SF', v_equipos[2], v_equipos[3], 2);
      v_propuestas := v_propuestas + 2;

    ELSIF v_len = 3 THEN
      -- Bye al mejor (v_equipos[1]), semi entre 2do y 3ro
      INSERT INTO propuestas_copa (esquema_copa_id, ronda, pareja_a_id, pareja_b_id, orden)
      VALUES (v_esquema.id, 'SF', v_equipos[2], v_equipos[3], 1);
      v_propuestas := v_propuestas + 1;
    END IF;

    -- Agregar equipos REALES (no NULL) a ya_asignados para los siguientes esquemas
    SELECT array_agg(t) INTO v_nuevos
    FROM (SELECT unnest(v_equipos) AS t) sub
    WHERE sub.t IS NOT NULL;

    IF v_nuevos IS NOT NULL THEN
      v_ya_asignados := v_ya_asignados || v_nuevos;
    END IF;

  END LOOP;

  RETURN jsonb_build_object('propuestas_creadas', v_propuestas);
END;
$$;


-- ============================================================
-- 2. MODIFICAR aprobar_propuestas_copa
--    Nuevo parámetro p_propuesta_ids UUID[] DEFAULT NULL:
--    - NULL = aprobar todas las pendientes (comportamiento actual)
--    - Array de IDs = aprobar solo esas propuestas específicas
--    También: solo aprueba propuestas con ambos equipos definidos (no NULLs)
-- ============================================================
CREATE OR REPLACE FUNCTION public.aprobar_propuestas_copa(
  p_esquema_copa_id UUID,
  p_propuesta_ids   UUID[] DEFAULT NULL  -- NULL = todas (backwards compatible)
)
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

  SELECT ec.*, ec.torneo_id
  INTO v_esquema
  FROM esquemas_copa ec
  WHERE ec.id = p_esquema_copa_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Esquema no encontrado');
  END IF;

  v_torneo_id := v_esquema.torneo_id;

  -- Crear copa si no existe (se reutiliza en aprobaciones progresivas)
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

  -- Aprobar propuestas pendientes (filtradas por IDs si se especifican)
  -- Solo aprobar propuestas con AMBOS equipos definidos (no slots pendientes NULL)
  FOR v_propuesta IN
    SELECT * FROM propuestas_copa
    WHERE esquema_copa_id = p_esquema_copa_id
      AND estado = 'pendiente'
      AND pareja_a_id IS NOT NULL       -- no aprobar slots pendientes
      AND pareja_b_id IS NOT NULL
      AND (p_propuesta_ids IS NULL OR id = ANY(p_propuesta_ids))
    ORDER BY orden
  LOOP
    INSERT INTO partidos (
      torneo_id, copa_id, ronda_copa, orden_copa,
      pareja_a_id, pareja_b_id, estado
    )
    VALUES (
      v_torneo_id, v_copa_id, v_propuesta.ronda, v_propuesta.orden,
      v_propuesta.pareja_a_id, v_propuesta.pareja_b_id, 'pendiente'
    );

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
