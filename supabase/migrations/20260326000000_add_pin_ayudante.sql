-- Agrega PIN de ayudante al torneo + RPC para verificar sin exponer el PIN

ALTER TABLE torneos ADD COLUMN IF NOT EXISTS pin_ayudante TEXT;

-- RPC que verifica el PIN sin enviarlo al cliente
CREATE OR REPLACE FUNCTION verificar_pin_ayudante(p_torneo_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM torneos
    WHERE id = p_torneo_id
      AND pin_ayudante IS NOT NULL
      AND pin_ayudante = p_pin
  )
$$;
