Quiero que ejecutes un test multi-actor de la app actuando como personas distintas dentro del mismo torneo.

Importante:
- El setup del torneo ya fue realizado antes de este prompt.
- No evalues el setup.
- El torneo de este escenario se juega a 1 set por partido.
- Tu foco principal no es la UX sino el buen funcionamiento del sistema, la logica de los estados y la coherencia de la tabla.
- Podes guardar resultados, confirmar acciones, disputar resultados y hacer cambios sin pedir permiso.
- Si para cambiar de jugador tenes que usar "No sos vos?", cerrar identidad local, borrar identificacion guardada o reidentificarte, hacelo. Eso es una mecanica del test y no forma parte de la UX principal a evaluar.
- No uses pantallas de admin, carga.html, presente.html ni otras pantallas tecnicas. Usa la experiencia normal de jugador.
- Cuando un resultado ya fue cargado por el rival:
  - si coincide con lo que sabe ese jugador, confirmalo
  - si no coincide, disputalo o corregilo como corresponda
- Cuando un partido todavia no tenga resultado cargado:
  - cargalo segun la informacion que conoce ese jugador
- No inventes reglas de puntuacion si la app no las muestra claramente.
- Si algo no se puede verificar con confianza, reportalo como limitacion en lugar de adivinar.

Objetivo:
Evaluar si la app soporta de forma coherente este flujo:
1. varios jugadores entran por turnos
2. cargan o confirman resultados reales
3. la tabla de posiciones se actualiza de forma consistente
4. al final, un integrante de una pareja vuelve a entrar para ver si ya termino la fase y si puede entender contra quien juega la copa

Roles del test:
- Jugador 1: Tincho, jugas con Max
- Jugador 2: Ari, jugas con Lean
- Jugador 3: Fede, jugas con Santi
- Jugador 4: Nico, jugas con Pablo
- Jugador 5: Max, jugas con Tincho

URL a usar:
- https://torneo-padel-teal.vercel.app/

FASE 1 - Tincho
Contexto del rol: Sos Tincho.

Las cosas que sabes:
- Jugas con Max.
- Te pidieron que uses la app para cargar los resultados y ver los proximos partidos.
- Los resultados de tus partidos fueron:
  - vs Ari - Lean: ganaste 6-1
  - vs Fede - Santi: ganaste 6-4
  - vs Nico - Pablo: ganaste 6-2

Las cosas que no sabes:
- No sabes lo que hicieron los otros jugadores.

Lo que tenes que hacer:
- Entra a la app e intenta hacer lo que te pidieron los organizadores del torneo.

FASE 1.1 - Log out
- Ya no sos mas este jugador. Ahora solo preparas el escenario para el proximo rol.
- Busca la seccion superior donde aparece el nombre de la pareja actual, Si hace falta, hace scroll hacia arriba hasta ver los nombres.
- Si esa seccion esta compactada y no se ve el texto "No sos vos?", hace click sobre el nombre de la pareja para desplegarla.
- Hace click en "No sos vos?".
- Confirma que volviste a la pagina de Bienvenida.

FASE 2 - Ari
Contexto del rol: Sos Ari.

Las cosas que sabes:
- Jugas con Lean.
- Te pidieron que uses la app para cargar los resultados y ver los proximos partidos.
- Los resultados de tus partidos fueron:
  - vs Tincho - Max: perdiste 1-6
  - vs Fede - Santi: ganaste 6-3
  - vs Nico - Pablo: ganaste 6-4

Las cosas que no sabes:
- No sabes lo que hicieron los otros jugadores.

Lo que tenes que hacer:
- Entra a la app e intenta hacer lo que te pidieron los organizadores del torneo.

FASE 2.1 - Log out
- Ya no sos mas este jugador. Ahora solo preparas el escenario para el proximo rol.
- Busca la seccion superior donde aparece el nombre de la pareja actual, Si hace falta, hace scroll hacia arriba hasta ver los nombres.
- Si esa seccion esta compactada y no se ve el texto "No sos vos?", hace click sobre el nombre de la pareja para desplegarla.
- Hace click en "No sos vos?".
- Confirma que volviste a la pagina de Bienvenida.

FASE 3 - Fede
Contexto del rol: Sos Fede.

Las cosas que sabes:
- Jugas con Santi.
- Te pidieron que uses la app para cargar los resultados y ver los proximos partidos.
- Los resultados de tus partidos fueron:
  - vs Tincho - Max: ganaste 6-4
  - vs Ari - Lean: perdiste 3-6
  - vs Nico - Pablo: ganaste 6-2

Las cosas que no sabes:
- No sabes lo que hicieron los otros jugadores.

Lo que tenes que hacer:
- Entra a la app e intenta hacer lo que te pidieron los organizadores del torneo.

FASE 3.1 - Log out
- Ya no sos mas este jugador. Ahora solo preparas el escenario para el proximo rol.
- Busca la seccion superior donde aparece el nombre de la pareja actual, Si hace falta, hace scroll hacia arriba hasta ver los nombres.
- Si esa seccion esta compactada y no se ve el texto "No sos vos?", hace click sobre el nombre de la pareja para desplegarla.
- Hace click en "No sos vos?".
- Confirma que volviste a la pagina de Bienvenida.

FASE 4 - Nico
Contexto del rol: Sos Nico.

Las cosas que sabes:
- Jugas con Pablo.
- Te pidieron que uses la app para cargar los resultados y ver los proximos partidos.
- Los resultados de tus partidos fueron:
  - vs Tincho - Max: perdiste 2-6
  - vs Ari - Lean: perdiste 4-6
  - vs Fede - Santi: perdiste 2-6

Las cosas que no sabes:
- No sabes lo que hicieron los otros jugadores.

Lo que tenes que hacer:
- Entra a la app e intenta hacer lo que te pidieron los organizadores del torneo.

FASE 4.1 - Log out
- Ya no sos mas este jugador. Ahora solo preparas el escenario para el proximo rol.
- Busca la seccion superior donde aparece el nombre de la pareja actual, Si hace falta, hace scroll hacia arriba hasta ver los nombres.
- Si esa seccion esta compactada y no se ve el texto "No sos vos?", hace click sobre el nombre de la pareja para desplegarla.
- Hace click en "No sos vos?".
- Confirma que volviste a la pagina de Bienvenida.

FASE 5 - Max
Contexto del rol: Sos Max.

Las cosas que sabes:
- Jugas con Tincho.
- Te pidieron que todos los jugadores usen la app para cargar y confirmar los resultados, tambien para ver los proximos partidos.
- Los resultados de tus partidos fueron:
  - vs Ari - Lean: ganaste 6-1
  - vs Fede - Santi: perdiste 4-6
  - vs Nico - Pablo: ganaste 6-2

Las cosas que no sabes:
- No sabes lo que hicieron los otros jugadores.

Lo que tenes que hacer:
- Entra a la app para cargar resultados y ver como les fue en el torneo.

Fin FASE 5.

Que tenes que evaluar en todo el flujo:
- si la app permite cargar, confirmar y disputar resultados de forma coherente
- si los estados de los partidos cambian de manera logica
- si la misma realidad del torneo se refleja de forma consistente para distintos jugadores
- si la tabla de posiciones es coherente con los resultados conocidos
- si los datos de PJ, PG, PP, sets, games, diferencias y puntos parecen correctos segun lo que la app muestra
- si el orden de posiciones parece consistente con los resultados
- si la vision de Max al final es coherente con lo que antes hicieron Tincho, Ari, Fede y Nico
- si la copa o el siguiente cruce se muestran de manera coherente, o si no se muestran cuando todavia no deberia esperarse
- si queda algun partido en disputa o en revision, explica como afecta eso a la tabla y a la informacion de copa

Chequeo esperado de coherencia del grupo:
Sin asumir reglas de puntos no visibles, el grupo deberia reflejar al menos esta logica basica:
- Tincho - Max: 3 jugados, 2 ganados, 1 perdido, games 16 a favor y 9 en contra
- Fede - Santi: 3 jugados, 2 ganados, 1 perdido, games 15 a favor y 12 en contra
- Ari - Lean: 3 jugados, 2 ganados, 1 perdido, games 13 a favor y 13 en contra
- Nico - Pablo: 3 jugados, 0 ganados, 3 perdidos, games 8 a favor y 18 en contra

Si la app muestra sets en este torneo a 1 set:
- Tincho - Max: 2 sets ganados, 1 perdido
- Fede - Santi: 2 sets ganados, 1 perdido
- Ari - Lean: 2 sets ganados, 1 perdido
- Nico - Pablo: 0 sets ganados, 3 perdidos

Formato obligatorio del reporte final:
1. Resumen general del flujo multi-actor.
2. Que hizo Tincho y como quedo su vision del torneo.
3. Que hizo Ari y como quedo su vision del torneo.
4. Que hizo Fede y como quedo su vision del torneo.
5. Que hizo Nico y como quedo su vision del torneo.
6. Que vio Max al final.
7. Estado final de cada partido relevante:
   - cargado
   - confirmado
   - disputado
   - pendiente
8. Tabla observada al final:
   - posiciones
   - PJ / PG / PP
   - sets
   - games
   - diferencias
   - puntos
9. Comparacion entre la tabla observada y la tabla esperada segun los resultados conocidos.
10. Problemas o inconsistencias detectadas.
11. Para cada problema, indica si fue principalmente:
   - funcional
   - de logica
   - de consistencia de datos
   - de comprension
12. Conclusion final:
   - el sistema se comporto de forma coherente en este escenario?
   - la tabla final parece correcta?
   - la informacion de copa para Max fue coherente o quedo inconclusa?
