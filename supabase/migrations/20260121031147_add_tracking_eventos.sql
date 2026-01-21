-- Tabla principal de tracking de uso por jugador
CREATE TABLE public.tracking_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id uuid NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  pareja_id uuid NOT NULL REFERENCES public.parejas(id) ON DELETE CASCADE,
  jugador_nombre text NOT NULL,
  tipo_evento text NOT NULL CHECK (tipo_evento IN ('visita', 'carga_resultado')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para optimizar consultas
CREATE INDEX idx_tracking_eventos_torneo_fecha 
  ON public.tracking_eventos(torneo_id, created_at DESC);

CREATE INDEX idx_tracking_eventos_pareja_tipo 
  ON public.tracking_eventos(pareja_id, tipo_evento);

CREATE INDEX idx_tracking_eventos_jugador 
  ON public.tracking_eventos(jugador_nombre);

-- Habilitar RLS
ALTER TABLE public.tracking_eventos ENABLE ROW LEVEL SECURITY;

-- Policies: acceso público total (consistente con otras tablas del sistema)
CREATE POLICY "public_access_tracking" 
  ON public.tracking_eventos 
  FOR ALL 
  TO public 
  USING (true) 
  WITH CHECK (true);

-- Comentarios para documentación
COMMENT ON TABLE public.tracking_eventos IS 'Registro de actividad de uso por jugador individual';
COMMENT ON COLUMN public.tracking_eventos.tipo_evento IS 'Tipo de evento: visita o carga_resultado';
COMMENT ON COLUMN public.tracking_eventos.metadata IS 'Datos adicionales del evento en formato JSON';
