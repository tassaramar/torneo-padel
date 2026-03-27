import { createClient } from '@supabase/supabase-js';
import { obtenerTorneoActivo } from '../utils/torneoActivo.js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export let TORNEO_ID = null;

export async function initTorneo() {
  TORNEO_ID = await obtenerTorneoActivo(supabase);
  return TORNEO_ID;
}
