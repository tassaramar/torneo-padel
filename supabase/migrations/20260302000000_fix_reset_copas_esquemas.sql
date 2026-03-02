-- ============================================================
-- Fix: reset_copas_torneo ahora también borra esquemas_copa
--
-- Problema: el RPC original conservaba esquemas_copa después del
-- reset, causando que determinarPaso() mostrara "Esperar Grupos"
-- (paso 2) en vez de "Definir Plan" (paso 1).
--
-- Fix: borrar esquemas_copa antes que partidos/copas. El CASCADE
-- en propuestas_copa limpia las propuestas automáticamente.
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
  v_esquemas_borrados INTEGER;
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

  -- Borrar esquemas_copa (CASCADE borra propuestas_copa automáticamente)
  DELETE FROM esquemas_copa
  WHERE torneo_id = p_torneo_id;
  GET DIAGNOSTICS v_esquemas_borrados = ROW_COUNT;

  RETURN jsonb_build_object(
    'partidos_borrados', v_partidos_borrados,
    'copas_borradas',    v_copas_borradas,
    'esquemas_borrados', v_esquemas_borrados
  );
END;
$$;
