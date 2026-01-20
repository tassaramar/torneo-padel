import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

// Circle Method (Berger Tables)
function circleMethod(equipos) {
  let teams = [...equipos];
  const n = teams.length;
  
  if (n % 2 !== 0) {
    teams.push('BYE');
  }
  
  const numRounds = teams.length - 1;
  const matchesPerRound = teams.length / 2;
  const rounds = [];
  
  const fixed = teams[0];
  let rotating = teams.slice(1);
  
  for (let r = 0; r < numRounds; r++) {
    const roundPairings = [];
    roundPairings.push([fixed, rotating[0]]);
    
    for (let i = 1; i < matchesPerRound; i++) {
      roundPairings.push([
        rotating[i],
        rotating[rotating.length - i]
      ]);
    }
    
    rounds.push(roundPairings);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  
  return rounds;
}

async function main() {
  console.log('🚀 Iniciando cálculo de rondas...\n');

  // 1. Obtener grupos
  console.log('📊 Obteniendo grupos del torneo...');
  const { data: grupos, error: errG } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (errG) throw errG;
  console.log(`✅ Encontrados ${grupos.length} grupos\n`);

  // 2. Obtener todos los partidos de grupos
  console.log('⚽ Obteniendo partidos de grupos...');
  const { data: partidos, error: errP } = await supabase
    .from('partidos')
    .select(`
      id,
      grupo_id,
      grupos ( nombre ),
      pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
    `)
    .eq('torneo_id', TORNEO_ID)
    .is('copa_id', null);

  if (errP) throw errP;
  console.log(`✅ Encontrados ${partidos.length} partidos de grupos\n`);

  let totalActualizados = 0;

  // 3. Procesar cada grupo
  for (const grupo of grupos) {
    console.log(`\n🔷 Procesando Grupo ${grupo.nombre}...`);

    // Filtrar partidos del grupo
    const partidosGrupo = partidos.filter(p => p.grupo_id === grupo.id);
    console.log(`   Partidos en el grupo: ${partidosGrupo.length}`);

    if (partidosGrupo.length === 0) {
      console.log('   ⚠️  Sin partidos, saltando...');
      continue;
    }

    // Extraer parejas únicas
    const parejasSet = new Set();
    partidosGrupo.forEach(p => {
      if (p.pareja_a?.nombre) parejasSet.add(p.pareja_a.nombre);
      if (p.pareja_b?.nombre) parejasSet.add(p.pareja_b.nombre);
    });
    const parejas = Array.from(parejasSet).sort();
    console.log(`   Parejas: ${parejas.join(', ')}`);

    // Calcular rondas con Circle Method
    const pairings = circleMethod(parejas);
    console.log(`   Rondas calculadas: ${pairings.length}`);

    // Crear mapa de partidos para búsqueda rápida
    const mapaPartidos = new Map();
    partidosGrupo.forEach(p => {
      const a = p.pareja_a?.nombre;
      const b = p.pareja_b?.nombre;
      if (a && b) {
        mapaPartidos.set(`${a}|${b}`, p);
        mapaPartidos.set(`${b}|${a}`, p);
      }
    });

    // Asignar ronda a cada partido
    for (let rondaIdx = 0; rondaIdx < pairings.length; rondaIdx++) {
      const rondaPairings = pairings[rondaIdx];
      
      for (const [eq1, eq2] of rondaPairings) {
        if (eq1 === 'BYE' || eq2 === 'BYE') continue;

        const partido = mapaPartidos.get(`${eq1}|${eq2}`);
        if (partido) {
          const numeroRonda = rondaIdx + 1;
          
          // Actualizar en BD
          const { error: updateErr } = await supabase
            .from('partidos')
            .update({ ronda: numeroRonda })
            .eq('id', partido.id);

          if (updateErr) {
            console.log(`   ❌ Error actualizando ${eq1} vs ${eq2}: ${updateErr.message}`);
          } else {
            console.log(`   ✅ R${numeroRonda}: ${eq1} vs ${eq2}`);
            totalActualizados++;
          }
        }
      }
    }

    console.log(`   ✅ Grupo ${grupo.nombre} completado`);
  }

  console.log(`\n🎉 ¡Proceso completado!`);
  console.log(`📊 Total de partidos actualizados: ${totalActualizados}`);
}

main().catch(error => {
  console.error('\n❌ ERROR:', error.message);
  console.error(error);
  process.exit(1);
});
