-- Schema actualizado de la base de datos Torneo Padel
-- Generado: 2026-01-21
-- Proyecto: torneo-padel (mwrruwgviwsngdwwraql)

-- ====================
-- TABLAS PRINCIPALES
-- ====================

-- Tabla: torneos
-- Almacena información de los torneos
CREATE TABLE IF NOT EXISTS torneos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    iniciado BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: copas
-- Almacena las diferentes copas dentro de un torneo
CREATE TABLE IF NOT EXISTS copas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    nombre TEXT,
    orden INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: grupos
-- Almacena los grupos dentro de un torneo
CREATE TABLE IF NOT EXISTS grupos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL
);

-- Tabla: parejas
-- Almacena las parejas participantes en el torneo
CREATE TABLE IF NOT EXISTS parejas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    copa_asignada_id UUID REFERENCES copas(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: partidos
-- Almacena los partidos del torneo
CREATE TABLE IF NOT EXISTS partidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    pareja_a_id UUID NOT NULL REFERENCES parejas(id) ON DELETE CASCADE,
    pareja_b_id UUID NOT NULL REFERENCES parejas(id) ON DELETE CASCADE,
    grupo_id UUID REFERENCES grupos(id) ON DELETE SET NULL,
    copa_id UUID REFERENCES copas(id) ON DELETE SET NULL,
    ronda INTEGER,
    ronda_copa TEXT,
    orden_copa INTEGER,
    games_a INTEGER,
    games_b INTEGER,
    resultado_temp_a INTEGER,
    resultado_temp_b INTEGER,
    estado TEXT,
    cargado_por_pareja_id UUID REFERENCES parejas(id) ON DELETE SET NULL,
    notas_revision TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: posiciones_manual
-- Almacena el orden manual de las posiciones en los grupos
CREATE TABLE IF NOT EXISTS posiciones_manual (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    grupo_id UUID NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    pareja_id UUID NOT NULL REFERENCES parejas(id) ON DELETE CASCADE,
    orden_manual INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: tracking_eventos
-- Almacena eventos de tracking para auditoría y analytics
CREATE TABLE IF NOT EXISTS tracking_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    pareja_id UUID NOT NULL REFERENCES parejas(id) ON DELETE CASCADE,
    jugador_nombre TEXT NOT NULL,
    tipo_evento TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================
-- ÍNDICES
-- ====================

-- Índices para mejorar el rendimiento de las consultas más comunes
CREATE INDEX IF NOT EXISTS idx_copas_torneo_id ON copas(torneo_id);
CREATE INDEX IF NOT EXISTS idx_copas_orden ON copas(torneo_id, orden);

CREATE INDEX IF NOT EXISTS idx_grupos_torneo_id ON grupos(torneo_id);

CREATE INDEX IF NOT EXISTS idx_parejas_torneo_id ON parejas(torneo_id);
CREATE INDEX IF NOT EXISTS idx_parejas_copa_asignada ON parejas(copa_asignada_id);
CREATE INDEX IF NOT EXISTS idx_parejas_orden ON parejas(torneo_id, orden);

CREATE INDEX IF NOT EXISTS idx_partidos_torneo_id ON partidos(torneo_id);
CREATE INDEX IF NOT EXISTS idx_partidos_grupo_id ON partidos(grupo_id);
CREATE INDEX IF NOT EXISTS idx_partidos_copa_id ON partidos(copa_id);
CREATE INDEX IF NOT EXISTS idx_partidos_ronda ON partidos(torneo_id, ronda);
CREATE INDEX IF NOT EXISTS idx_partidos_pareja_a ON partidos(pareja_a_id);
CREATE INDEX IF NOT EXISTS idx_partidos_pareja_b ON partidos(pareja_b_id);
CREATE INDEX IF NOT EXISTS idx_partidos_estado ON partidos(estado);

CREATE INDEX IF NOT EXISTS idx_posiciones_torneo_grupo ON posiciones_manual(torneo_id, grupo_id);
CREATE INDEX IF NOT EXISTS idx_posiciones_pareja ON posiciones_manual(pareja_id);

CREATE INDEX IF NOT EXISTS idx_tracking_torneo_id ON tracking_eventos(torneo_id);
CREATE INDEX IF NOT EXISTS idx_tracking_pareja_id ON tracking_eventos(pareja_id);
CREATE INDEX IF NOT EXISTS idx_tracking_tipo_evento ON tracking_eventos(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_tracking_created_at ON tracking_eventos(created_at DESC);

-- ====================
-- COMENTARIOS
-- ====================

COMMENT ON TABLE torneos IS 'Almacena la información principal de cada torneo';
COMMENT ON TABLE copas IS 'Define las diferentes copas o categorías dentro de un torneo';
COMMENT ON TABLE grupos IS 'Define los grupos de la fase inicial del torneo';
COMMENT ON TABLE parejas IS 'Registro de parejas participantes';
COMMENT ON TABLE partidos IS 'Registro de todos los partidos (fase de grupos y copas)';
COMMENT ON TABLE posiciones_manual IS 'Orden manual de posiciones para desempates';
COMMENT ON TABLE tracking_eventos IS 'Registro de eventos para auditoría y analytics';

COMMENT ON COLUMN partidos.estado IS 'Estados posibles: pendiente, confirmado, revision, completo';
COMMENT ON COLUMN partidos.ronda IS 'Número de ronda en fase de grupos (1-based)';
COMMENT ON COLUMN partidos.ronda_copa IS 'Identificador de ronda en fase de copas (ej: final, semi, cuartos)';
COMMENT ON COLUMN tracking_eventos.tipo_evento IS 'Tipo de evento: sesion_iniciada, partido_cargado, partido_confirmado, etc.';
