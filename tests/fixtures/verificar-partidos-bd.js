import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mwrruwgviwsngdwwraql.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_05uwPP0ecqtvvjzAb-WzvA_jLUhr8Qn';
const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136'; // ID del torneo real

async function verificarPartidos() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log(`\n🔍 Verificando partidos en BD para torneo: ${TORNEO_ID}\n`);

  // 1. Verificar que el torneo existe
  const { data: torneo, error: errorTorneo } = await supabase
    .from('torneos')
    .select('*')
    .eq('id', TORNEO_ID)
    .single();

  if (errorTorneo) {
    console.log('❌ Torneo NO existe en BD');
    console.log('Error:', errorTorneo.message);
    return;
  }

  console.log('✅ Torneo existe:', torneo.nombre || TORNEO_ID);

  // 2. Contar parejas
  const { count: countParejas, error: errorParejas } = await supabase
    .from('parejas')
    .select('*', { count: 'exact', head: true })
    .eq('torneo_id', TORNEO_ID);

  console.log(`\n📊 Parejas: ${countParejas || 0}`);

  // 3. Contar grupos
  const { count: countGrupos, error: errorGrupos } = await supabase
    .from('grupos')
    .select('*', { count: 'exact', head: true })
    .eq('torneo_id', TORNEO_ID);

  console.log(`📊 Grupos: ${countGrupos || 0}`);

  // 4. Contar partidos
  const { count: countPartidos, error: errorPartidos } = await supabase
    .from('partidos')
    .select('*', { count: 'exact', head: true })
    .eq('torneo_id', TORNEO_ID);

  console.log(`📊 Partidos: ${countPartidos || 0}`);

  // 4b. Ver distribución de partidos por grupo
  if (countPartidos > 0) {
    const { data: partidosPorGrupo } = await supabase
      .from('partidos')
      .select('grupo_id')
      .eq('torneo_id', TORNEO_ID);

    const distribucion = {};
    partidosPorGrupo.forEach(p => {
      distribucion[p.grupo_id] = (distribucion[p.grupo_id] || 0) + 1;
    });

    console.log('\n📊 Distribución de partidos por grupo:');
    Object.entries(distribucion).forEach(([grupoId, count]) => {
      console.log(`  Grupo ${grupoId.substring(0, 8)}...: ${count} partidos`);
    });
  }

  if (countPartidos === 0) {
    console.log('\n⚠️ NO HAY PARTIDOS EN LA BD');
    console.log('Esto confirma que generarPartidosGrupos() NO insertó partidos en BD');
  } else {
    console.log(`\n✅ HAY ${countPartidos} PARTIDOS EN LA BD`);
    console.log('El problema es que fixture.html NO los muestra');

    // Mostrar detalles de algunos partidos
    const { data: partidos } = await supabase
      .from('partidos')
      .select('*')
      .eq('torneo_id', TORNEO_ID)
      .limit(3);

    console.log('\nEjemplos de partidos (primeros 3):');
    partidos.forEach((p, i) => {
      console.log(`  ${i + 1}.`, JSON.stringify(p, null, 2));
    });
  }

  console.log('\n');
}

verificarPartidos().catch(console.error);
