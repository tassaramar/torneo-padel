-- Agregar flag para activar/desactivar el sistema de presentismo
-- Si es false, no se muestra el bloque de presentismo y los partidos no se bloquean
-- Los datos de presentes en parejas se mantienen intactos

ALTER TABLE public.torneos 
ADD COLUMN IF NOT EXISTS presentismo_activo BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.torneos.presentismo_activo IS 'Si es false, el sistema de presentismo está desactivado para este torneo';
