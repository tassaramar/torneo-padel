-- Eliminar columna es_default de presets_copa.
-- La distinción default/custom ya no existe — todas las plantillas son iguales.
-- Migración requerida por spec-admin-copas-wizard-ux-etapa1.

ALTER TABLE presets_copa DROP COLUMN es_default;
