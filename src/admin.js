import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

console.log('ADMIN JS (GRUPOS) CARGADO');

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const log = document.getElementById('log');

function logMsg(msg) {
  const p = document.createElement('p');
  p.textContent = msg;
  log.appendChild(p);
}

/* =========================
   RESET PARTIDOS DE GRUPOS
   (copa_id IS NULL)
========================= */

document.getElementById('reset-grupos').onclick = async () => {
  logMsg('🧹 Eliminando partidos de grupos…');

  const { error } = await supabase
    .from('partidos')
    .delete()
    .eq('torneo_id', TORNEO_ID)
    .is('copa_id', null);

  if (error) {
    console.error(error);
    logMsg('❌ Error eliminando partidos de grupos');
    return;
  }

  logMsg('🧹 Partidos de grupos eliminados');
};

/* =========================
   GENERAR PARTIDOS DE GRUPOS
========================= */

document.getElementById('gen-grupos').onclick = async () => {
  logMsg('🎾 Generando partidos de grupos…');

  // 1. Traer grupos
  const { data: grupos, error: errGrupos } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (errGrupos || !grupos || grupos.length === 0) {
    console.error(errGrupos);
    logMsg('❌ No hay grupos');
    return;
  }

  // 2. Traer parejas
  const { data: parejas, error: errParejas } = await supabase
    .from('parejas')
    .select('id')
    .eq('torneo_id', TORNEO_ID)
    .order('created_at');

  if (errParejas || !parejas || parejas.length < 2) {
    console.error(errParejas);
    logMsg('❌ No hay suficientes parejas');
    return;
  }

  // 3. Validación dura del formato
  if (parejas.length % grupos.length !== 0) {
    logMsg(
      `❌ Formato inválido: ${parejas.length} parejas / ${grupos.length} grupos`
    );
    logMsg('❌ No se pueden repartir parejas equitativamente');
    return;
  }

  const parejasPorGrupo = parejas.length / grupos.length;

  // 4. Asignar parejas por bloques
  let cursor = 0;
  const gruposMap = {};

  for (const grupo of grupos) {
    gruposMap[grupo.id] = parejas.slice(
      cursor,
      cursor + parejasPorGrupo
    );
    cursor += parejasPorGrupo;
  }

  let total = 0;

  // 5. Crear partidos round-robin por grupo
  for (const grupo of grupos) {
    const ps = gruposMap[grupo.id];

    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const { error } = await supabase
          .from('partidos')
          .insert({
            torneo_id: TORNEO_ID,
            grupo_id: grupo.id,
            pareja_a_id: ps[i].id,
            pareja_b_id: ps[j].id,
            copa_id: null
          });

        if (!error) total++;
        else console.error(error);
      }
    }
  }

  logMsg(`🎾 ${total} partidos de grupos creados`);
};
