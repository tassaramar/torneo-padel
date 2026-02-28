/**
 * Catálogo de presets de copas por formato de torneo.
 * Cada preset es un array de esquemas listos para insertar en esquemas_copa.
 *
 * Formato de reglas (JSONB):
 *   [{"posicion": N}]                                     → N-ésimo de cada grupo
 *   [{"posicion": N, "cantidad": K, "criterio": "mejor"}] → K mejores N-ésimos (ranking cruzado)
 *   [{"posicion": N, "cantidad": K, "criterio": "peor"}]  → K peores N-ésimos (ranking cruzado)
 *   [{"modo": "global", "desde": D, "hasta": H}]          → puestos D-H del ranking del torneo
 */

/**
 * Metadatos de presets (nombre legible, descripción, badge de recomendado).
 */
const PRESETS_META = {
  '2x3':              { nombre: '2x3 — Cruces directos',    descripcion: '3 copas de 1 partido: 1°vs1°, 2°vs2°, 3°vs3°' },
  '2x4':              { nombre: '2x4 — Cruces directos',    descripcion: '4 copas de 1 partido: 1°vs1°, 2°vs2°, 3°vs3°, 4°vs4°' },
  '2x4-dos-brackets': { nombre: '2x4 — Dos brackets de 4', descripcion: '2 copas semi+final: Oro con 1°+2° de cada grupo, Plata con 3°+4°', recomendado: true },
  '2x5':              { nombre: '2x5 — Cruces directos',    descripcion: '5 copas de 1 partido cada una' },
  '2x6':              { nombre: '2x6 — Cruces directos',    descripcion: '6 copas de 1 partido cada una' },
  '3x3':              { nombre: '3x3 — Brackets de 3',      descripcion: '3 copas en bracket de 3 equipos (bye al mejor 1°)' },
  '3x4':              { nombre: '3x4 — Ranking cruzado',    descripcion: '3 copas de 4 equipos con mejor/peor 2° y 3°' },
  '4x3':              { nombre: '4x3 — Brackets de 4',      descripcion: '3 copas en bracket de 4 equipos cada una' },
  '4x4':              { nombre: '4x4 — Brackets de 4',      descripcion: '4 copas en bracket de 4 equipos cada una' },
};

/**
 * Presets para torneos de 2 grupos.
 */
const PRESETS_2_GRUPOS = {
  '2x3': [
    { nombre: 'Copa Oro',    orden: 1, formato: 'direct', reglas: [{ posicion: 1 }] },
    { nombre: 'Copa Plata',  orden: 2, formato: 'direct', reglas: [{ posicion: 2 }] },
    { nombre: 'Copa Bronce', orden: 3, formato: 'direct', reglas: [{ posicion: 3 }] }
  ],
  '2x4': [
    { nombre: 'Copa Oro',    orden: 1, formato: 'direct', reglas: [{ posicion: 1 }] },
    { nombre: 'Copa Plata',  orden: 2, formato: 'direct', reglas: [{ posicion: 2 }] },
    { nombre: 'Copa Bronce', orden: 3, formato: 'direct', reglas: [{ posicion: 3 }] },
    { nombre: 'Copa Madera', orden: 4, formato: 'direct', reglas: [{ posicion: 4 }] }
  ],
  '2x4-dos-brackets': [
    { nombre: 'Copa Oro',   orden: 1, formato: 'bracket', reglas: [{ posicion: 1 }, { posicion: 2 }] },
    { nombre: 'Copa Plata', orden: 2, formato: 'bracket', reglas: [{ posicion: 3 }, { posicion: 4 }] }
  ],
  '2x5': [
    { nombre: 'Copa Oro',    orden: 1, formato: 'direct', reglas: [{ posicion: 1 }] },
    { nombre: 'Copa Plata',  orden: 2, formato: 'direct', reglas: [{ posicion: 2 }] },
    { nombre: 'Copa Bronce', orden: 3, formato: 'direct', reglas: [{ posicion: 3 }] },
    { nombre: 'Copa Cartón', orden: 4, formato: 'direct', reglas: [{ posicion: 4 }] },
    { nombre: 'Copa Papel',  orden: 5, formato: 'direct', reglas: [{ posicion: 5 }] }
  ],
  '2x6': [
    { nombre: 'Copa Oro',    orden: 1, formato: 'direct', reglas: [{ posicion: 1 }] },
    { nombre: 'Copa Plata',  orden: 2, formato: 'direct', reglas: [{ posicion: 2 }] },
    { nombre: 'Copa Bronce', orden: 3, formato: 'direct', reglas: [{ posicion: 3 }] },
    { nombre: 'Copa Madera', orden: 4, formato: 'direct', reglas: [{ posicion: 4 }] },
    { nombre: 'Copa Cartón', orden: 5, formato: 'direct', reglas: [{ posicion: 5 }] },
    { nombre: 'Copa Papel',  orden: 6, formato: 'direct', reglas: [{ posicion: 6 }] }
  ]
};

/**
 * Presets para torneos de 3 grupos.
 * Usa ranking cruzado: el "mejor 2do" de los 3 grupos va a Copa Oro.
 */
const PRESETS_3_GRUPOS = {
  '3x3': [
    // Bracket de 3: bye al mejor 1°, semi entre los otros 2
    { nombre: 'Copa Oro',    orden: 1, formato: 'bracket', reglas: [{ posicion: 1 }] },
    { nombre: 'Copa Plata',  orden: 2, formato: 'bracket', reglas: [{ posicion: 2 }] },
    { nombre: 'Copa Bronce', orden: 3, formato: 'bracket', reglas: [{ posicion: 3 }] }
  ],
  '3x4': [
    // Copa Oro: 3 primeros + mejor 2do = 4 equipos, bracket
    {
      nombre: 'Copa Oro', orden: 1, formato: 'bracket',
      reglas: [
        { posicion: 1 },
        { posicion: 2, cantidad: 1, criterio: 'mejor' }
      ]
    },
    // Copa Plata: 2 segundos restantes + 2 mejores terceros = 4 equipos, bracket
    {
      nombre: 'Copa Plata', orden: 2, formato: 'bracket',
      reglas: [
        { posicion: 2, cantidad: 2, criterio: 'peor' },
        { posicion: 3, cantidad: 2, criterio: 'mejor' }
      ]
    },
    // Copa Bronce: peor tercero + 3 cuartos = 4 equipos, bracket
    {
      nombre: 'Copa Bronce', orden: 3, formato: 'bracket',
      reglas: [
        { posicion: 3, cantidad: 1, criterio: 'peor' },
        { posicion: 4 }
      ]
    }
  ]
};

/**
 * Presets para torneos de 4 grupos — el caso más limpio.
 * 4 N-ésimos por copa → siempre bracket de 4 semis
 */
const PRESETS_4_GRUPOS = {
  '4x3': [
    { nombre: 'Copa Oro',    orden: 1, formato: 'bracket', reglas: [{ posicion: 1 }] },
    { nombre: 'Copa Plata',  orden: 2, formato: 'bracket', reglas: [{ posicion: 2 }] },
    { nombre: 'Copa Bronce', orden: 3, formato: 'bracket', reglas: [{ posicion: 3 }] }
  ],
  '4x4': [
    { nombre: 'Copa Oro',    orden: 1, formato: 'bracket', reglas: [{ posicion: 1 }] },
    { nombre: 'Copa Plata',  orden: 2, formato: 'bracket', reglas: [{ posicion: 2 }] },
    { nombre: 'Copa Bronce', orden: 3, formato: 'bracket', reglas: [{ posicion: 3 }] },
    { nombre: 'Copa Madera', orden: 4, formato: 'bracket', reglas: [{ posicion: 4 }] }
  ]
};

/**
 * Todos los presets disponibles indexados por clave de formato.
 */
export const PRESETS = {
  ...PRESETS_2_GRUPOS,
  ...PRESETS_3_GRUPOS,
  ...PRESETS_4_GRUPOS
};

/**
 * Sugiere un preset basado en el formato detectado del torneo.
 *
 * @param {number} numGrupos         - Cantidad de grupos del torneo
 * @param {number} parejasPorGrupo   - Promedio de parejas por grupo (puede ser decimal si hay desiguales)
 * @returns {{ clave: string, esquemas: Array } | null}
 */
export function sugerirPreset(numGrupos, parejasPorGrupo) {
  const ppg = Math.round(parejasPorGrupo);
  const clave = `${numGrupos}x${ppg}`;
  const esquemas = PRESETS[clave];
  if (!esquemas) return null;
  return { clave, esquemas };
}

/**
 * Retorna todos los presets compatibles con un formato de torneo dado.
 * "Compatible" significa que la clave base coincide (ej: todos los '2x4*' para un torneo 2x4).
 *
 * @param {number} numGrupos       - Cantidad de grupos
 * @param {number} parejasPorGrupo - Promedio de parejas por grupo
 * @returns {Array<{ clave, nombre, descripcion, recomendado?, esquemas }>}
 */
export function obtenerPresetsCompatibles(numGrupos, parejasPorGrupo) {
  const ppg = Math.round(parejasPorGrupo);
  const prefijo = `${numGrupos}x${ppg}`;

  return Object.entries(PRESETS)
    .filter(([clave]) => clave === prefijo || clave.startsWith(prefijo + '-'))
    .map(([clave, esquemas]) => {
      const meta = PRESETS_META[clave];
      if (!meta) return null;
      return { clave, esquemas, ...meta };
    })
    .filter(Boolean);
}

/**
 * Detecta el formato del torneo desde Supabase y retorna el contexto completo.
 * Siempre retorna un objeto con numGrupos y parejasPorGrupo (aunque sea 0).
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} torneoId  - ID del torneo
 * @returns {{ numGrupos, numParejas, parejasPorGrupo, sugerencia: object|null }}
 */
export async function detectarYSugerirPreset(supabase, torneoId) {
  const [{ data: grupos }, { data: parejas }] = await Promise.all([
    supabase.from('grupos').select('id').eq('torneo_id', torneoId),
    supabase.from('parejas').select('id').eq('torneo_id', torneoId)
  ]);

  const numGrupos  = grupos?.length  || 0;
  const numParejas = parejas?.length || 0;
  const parejasPorGrupo = numGrupos > 0 ? numParejas / numGrupos : 0;

  return {
    numGrupos,
    numParejas,
    parejasPorGrupo,
    sugerencia: sugerirPreset(numGrupos, parejasPorGrupo)
  };
}
