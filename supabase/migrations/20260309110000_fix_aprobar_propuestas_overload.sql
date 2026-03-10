-- Elimina el overload antiguo de aprobar_propuestas_copa (sin p_propuesta_ids).
-- CREATE OR REPLACE con firma distinta crea un overload en vez de reemplazar,
-- lo que genera ambigüedad al llamar con un solo argumento desde Supabase RPC.
-- El overload nuevo (con p_propuesta_ids UUID[] DEFAULT NULL) ya existe y es
-- backwards-compatible: llamar sin el segundo parámetro equivale a pasar NULL.

DROP FUNCTION IF EXISTS public.aprobar_propuestas_copa(uuid);
