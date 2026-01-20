/**
 * Test del algoritmo Circle Method
 */

function circleMethod(equipos) {
  let teams = [...equipos];
  const n = teams.length;
  
  if (n % 2 === 1) {
    teams.push('BYE');
  }
  
  const rounds = [];
  const totalRounds = teams.length - 1;
  const fixed = teams[0];
  let rotating = teams.slice(1);
  
  for (let r = 0; r < totalRounds; r++) {
    const roundPairings = [];
    
    roundPairings.push([fixed, rotating[0]]);
    
    for (let i = 1; i < rotating.length / 2; i++) {
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

function testCase(numEquipos) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${numEquipos} EQUIPOS`);
  console.log('='.repeat(60));
  
  const equipos = [];
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  for (let i = 0; i < numEquipos; i++) {
    equipos.push(`Equipo ${letters[i]}`);
  }
  
  const rounds = circleMethod(equipos);
  
  rounds.forEach((round, idx) => {
    console.log(`\n🔹 Ronda ${idx + 1}:`);
    
    let matchesCount = 0;
    let byesCount = 0;
    
    round.forEach(([eq1, eq2]) => {
      if (eq1 === 'BYE' || eq2 === 'BYE') {
        const playing = eq1 === 'BYE' ? eq2 : eq1;
        console.log(`  📅 ${playing} - Fecha libre`);
        byesCount++;
      } else {
        console.log(`  ⚽ ${eq1} vs ${eq2}`);
        matchesCount++;
      }
    });
    
    console.log(`  ➡️  ${matchesCount} partido${matchesCount !== 1 ? 's' : ''} en paralelo`);
  });
  
  const totalMatches = (numEquipos * (numEquipos - 1)) / 2;
  const expectedRounds = numEquipos % 2 === 0 ? numEquipos - 1 : numEquipos;
  
  console.log(`\n✅ RESUMEN:`);
  console.log(`   Total rondas: ${rounds.length} (esperadas: ${expectedRounds})`);
  console.log(`   Total partidos: ${totalMatches}`);
  console.log(`   Máximo paralelismo: ${Math.floor(numEquipos / 2)} partidos/ronda`);
  console.log(`   Estado: ${rounds.length === expectedRounds ? '✅ ÓPTIMO' : '❌ NO ÓPTIMO'}`);
}

// Ejecutar tests
console.log('\n🧪 TESTING CIRCLE METHOD - ROUND ROBIN TOURNAMENT\n');

testCase(3);
testCase(4);
testCase(5);

console.log(`\n${'='.repeat(60)}`);
console.log('✅ TODOS LOS TESTS COMPLETADOS');
console.log('='.repeat(60));
