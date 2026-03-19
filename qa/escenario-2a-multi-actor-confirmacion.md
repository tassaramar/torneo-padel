Quiero que ejecutes un test multi-actor de la app actuando como personas distintas dentro del mismo torneo.

Importante:
- El setup del torneo ya fue realizado antes de este prompt.
- No evalues el setup.
- Tu trabajo empieza desde la experiencia de los jugadores.
- Podes guardar resultados, confirmar acciones y hacer cambios sin pedir permiso.
- Si para cambiar de jugador tenes que usar "No sos vos?", cerrar identidad local, borrar identificacion guardada o reidentificarte, hacelo. Eso es una mecanica del test y no forma parte de la UX principal a evaluar.

Objetivo:
Evaluar si la app comunica bien un flujo real entre dos jugadores:
1. un jugador carga un resultado
2. el rival entra despues
3. el rival confirma ese mismo resultado
4. el primer jugador vuelve a entrar y entiende que el flujo quedo cerrado

Roles del test:
- Jugador A: Tincho, jugas con Max
- Jugador B: Ari, jugas con Lean

Reglas de actuacion:
- Cuando actues como Tincho:
  - comportate como Tincho
  - no uses conocimiento tecnico
  - no uses informacion futura de Ari para interpretar la experiencia
- Cuando actues como Ari:
  - comportate como Ari
  - no uses conocimiento tecnico
  - no uses informacion privada de Tincho, salvo lo que la propia app le muestre a Ari
- Actua como jugador real, no como tester tecnico.
- No inventes comportamientos que la UI no muestre.
- Si algo no se entiende rapido, eso es parte importante del test.

URL a usar:
- https://torneo-padel-teal.vercel.app/

FASE 1 - Tincho carga resultado
Contexto del rol:
- Sos Tincho.
- Jugas con Max.
- Ya terminaste tu partido contra Ari - Lean.
- Para vos, ese partido lo ganaste 6-4 6-3.
- Queres dejar cargado el resultado para seguir con el torneo.

Tu tarea como Tincho:
1. Entra a la app.
2. Identificate como Tincho.
3. Encontra el partido contra Ari - Lean.
4. Carga el resultado:
   - ganaste 6-4 6-3
5. Observa como te comunica la app:
   - que el resultado se guardo
   - en que estado quedo el partido
   - si entendes o no que todavia falta una accion del rival

Al terminar esta fase, registra mentalmente:
- que entendio Tincho
- que no entendio
- que espera que pase despues

FASE 2 - Ari confirma
Contexto del rol:
- Ahora actuas como Ari.
- Jugas con Lean.
- Ya terminaste tu partido contra Tincho - Max.
- Para vos, ese partido lo perdiste 4-6 3-6.
- El rival ya cargo el resultado antes que vos.
- Queres revisar lo que cargo el rival y actuar como corresponda.

Tu tarea como Ari:
1. Cambia de jugador.
2. Identificate como Ari.
3. Encontra el partido contra Tincho - Max.
4. Revisa el resultado que ya fue cargado por el rival.
5. Como para vos ese resultado coincide con lo que paso, actua como corresponda para confirmarlo.
6. Observa como te comunica la app:
   - que el rival ya habia cargado algo
   - que vos tenias que revisarlo
   - que el partido quedo confirmado o cerrado

Al terminar esta fase, registra mentalmente:
- que entendio Ari
- que no entendio
- que senales le dieron confianza o desconfianza

FASE 3 - Vuelta a Tincho
Contexto del rol:
- Volves a actuar como Tincho.
- Ya habias cargado el resultado de tu partido contra Ari - Lean.

Tu tarea como Tincho:
1. Cambia nuevamente al jugador Tincho.
2. Reingresa a la app como Tincho.
3. Observa como aparece ahora el partido contra Ari - Lean.
4. Evalua si la app te permite entender:
   - que el resultado ya quedo cerrado
   - que ya no tenes nada pendiente sobre ese partido
   - como impacto eso en tu vista general

Que tenes que evaluar en todo el flujo:
- si fue facil identificarse como cada jugador
- si fue facil encontrar el partido correcto en cada rol
- si fue claro que Tincho cargo un resultado
- si fue claro que Ari debia revisarlo y confirmarlo
- si fue claro cuando el partido quedo efectivamente cerrado
- si el cambio de estado del partido fue entendible para ambos
- si en algun momento hubo dudas, friccion o necesidad de adivinar

Formato obligatorio del reporte final:
1. Resumen general del flujo multi-actor.
2. Experiencia de Tincho al cargar:
   - que entendio rapido
   - que le costo
   - como interpreto el estado posterior a guardar
3. Experiencia de Ari al confirmar:
   - que entendio rapido
   - que le costo
   - como interpreto el resultado ya cargado por el rival
4. Experiencia de Tincho al volver:
   - que entendio al reingresar
   - si quedo claro que el partido ya estaba cerrado
5. Problemas o fricciones detectadas.
6. Para cada problema, indica si fue principalmente:
   - funcional
   - de comprension
   - de confianza
7. Evaluacion general del flujo:
   - excelente / buena / regular / mala
8. Conclusion final:
   - la app soporta bien este flujo entre dos jugadores sin ayuda externa?
