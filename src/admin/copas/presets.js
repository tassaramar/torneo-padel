/**
 * Catálogo de presets de copas por formato de torneo.
 * Cada preset es un array de esquemas listos para insertar en esquemas_copa.
 *
 * Formato de reglas (JSONB):
 *   [{"posicion": N}]                                     → N-ésimo de cada grupo
 *   [{"posicion": N, "cantidad": K, "criterio": "mejor"}] → K mejores N-ésimos (ranking cruzado)
 *   [{"posicion": N, "cantidad": K, "criterio": "peor"}]  → K peores N-ésimos (ranking cruzado)
 */

/**
 * Presets para torneos de 2 grupos — cruces directos
 * 1°A vs 1°B, 2°A vs 2°B, etc.
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
 * Detecta el formato del torneo desde Supabase y sugiere un preset.
 *
 * @param {Object} supabase  - Cliente de Supabase
 * @param {string} torneoId  - ID del torneo
 * @returns {{ clave: string, esquemas: Array, numGrupos: number, numParejas: number } | null}
 */
export async function detectarYSugerirPreset(supabase, torneoId) {
  const [{ data: grupos }, { data: parejas }] = await Promise.all([
    supabase.from('grupos').select('id').eq('torneo_id', torneoId),
    supabase.from('parejas').select('id').eq('torneo_id', torneoId)
  ]);

  const numGrupos  = grupos?.length  || 0;
  const numParejas = parejas?.length || 0;
  const parejasPorGrupo = numGrupos > 0 ? numParejas / numGrupos : 0;

  const sugerencia = sugerirPreset(numGrupos, parejasPorGrupo);
  if (!sugerencia) return null;

  return {
    ...sugerencia,
    numGrupos,
    numParejas,
    parejasPorGrupo
  };
}
