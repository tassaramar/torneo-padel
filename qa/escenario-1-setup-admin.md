Quiero que prepares el sistema para un test de experiencia de jugador. En esta tarea NO estas evaluando UX del producto; solo estas armando las precondiciones del test. Ejecuta los pasos de forma precisa y secuencial, casi mecanica. No improvises. No explores otras areas salvo que sea necesario para completar el setup.

Objetivo del setup:
Dejar un torneo recien creado desde cero, con parejas importadas, partidos generados, sin resultados cargados, sin copas configuradas y con presentismo desactivado.

Contexto:
- URL admin:
  https://torneo-padel-teal.vercel.app/admin.html?qa_token=Mgn9Ces1XMajjVmOt0FfSqZ1XlJi6Rjad6
- URL presentismo:
  https://torneo-padel-teal.vercel.app/presente.html?qa_token=Mgn9Ces1XMajjVmOt0FfSqZ1XlJi6Rjad6

Datos a importar:
Pega exactamente este bloque, respetando TAB entre pareja y grupo:

Tincho - Max	A
Ari - Lean	A
Fede - Santi	A
Nico - Pablo	A
Lucas - Martin	B
Diego - Javi	B
Ale - Gonza	B
Mateo - Bruno	B

Reglas:
- No evalues la UX del setup salvo que haya un bloqueo critico.
- Si una pantalla tarda, espera razonablemente y reintenta.
- Si ves mensajes de exito o logs, usalos para verificar.
- Si algo no coincide, detenete y reporta el bloqueo.
- No cargues resultados manualmente.
- No configures copas.
- No hagas acciones extra fuera de las necesarias para dejar el torneo en estado limpio.

Pasos exactos:

Parte 1: entrar al admin
1. Abri la URL de admin.
2. Espera a que cargue completamente la pantalla.
3. Verifica que estas dentro del panel de administracion y no en una pantalla de login.
4. En la barra de tabs de arriba del contenido principal, hace clic en `Setup`.

Parte 2: importar parejas
5. Dentro de Setup, ubica la seccion `Parejas (import rapido)`.
6. Busca el textarea grande de pegado.
7. Pega exactamente este contenido:

Tincho - Max	A
Ari - Lean	A
Fede - Santi	A
Nico - Pablo	A
Lucas - Martin	B
Diego - Javi	B
Ale - Gonza	B
Mateo - Bruno	B

8. Busca el boton `Previsualizar` y hace clic una sola vez.
9. Espera a que aparezca la previsualizacion.
10. Verifica que la previsualizacion quede en estado OK y que muestre:
   - 8 parejas
   - 2 grupos
   - grupos A y B
11. Busca el boton `Importar (borra y recrea)` y hace clic una sola vez.
12. Va a aparecer un `confirm()` del navegador avisando que esto borra y recrea todo el torneo actual. Confirmalo.
13. Espera el proceso completo.
14. Durante el proceso pueden aparecer mensajes en el log y luego la pagina hace un reload automatico. No interrumpas ese reload.
15. Una vez que recargue, volve a verificar que seguis dentro del admin.

Parte 3: verificar grupos y normalizar resultados
16. En la barra de tabs superior, hace clic en `Grupos`.
17. Espera a que carguen las cards o tablas de grupos.
18. Verifica que existan los grupos A y B.
19. Verifica que en Grupo A esten estas parejas:
   - Tincho - Max
   - Ari - Lean
   - Fede - Santi
   - Nico - Pablo
20. Verifica que en Grupo B esten estas parejas:
   - Lucas - Martin
   - Diego - Javi
   - Ale - Gonza
   - Mateo - Bruno
21. Revisa si todas las parejas estan en cero, es decir sin partidos jugados ni puntos cargados.
22. Si TODO esta en cero, continua al paso 27.
23. Si aparece cualquier partido jugado, marcador cargado o estadistica distinta de cero, busca el boton `Limpiar resultados de grupos`.
24. Hace clic una sola vez en `Limpiar resultados de grupos`.
25. Va a aparecer un `confirm()` del navegador advirtiendo que se borran los resultados de grupos. Confirmalo.
26. Espera a que termine el proceso y volve a revisar la seccion `Grupos` hasta confirmar que todas las parejas quedaron en cero.
27. Toma esto como confirmacion de que los partidos de grupos existen pero no tienen resultados cargados.

Parte 4: verificar copas en estado inicial
28. En la barra de tabs superior, hace clic en `Copas`.
29. Espera a que cargue el contenido de copas.
30. Verifica que el sistema este en el estado inicial de copas, equivalente a `1. Definir Plan`.
31. No crees copas, no cargues presets y no apruebes nada.

Parte 5: desactivar presentismo
32. Abri la URL de presentismo:
   https://torneo-padel-teal.vercel.app/presente.html?qa_token=Mgn9Ces1XMajjVmOt0FfSqZ1XlJi6Rjad6
33. Espera a que cargue completamente.
34. En la seccion `Sistema de Presentismo (toggle global)`, ubica el control global.
35. Observa el texto de estado.
36. Si el sistema esta activo, apagalo usando el toggle.
37. Si ya esta apagado, dejalo asi.
38. Confirma visualmente que el estado final mostrado sea:
   `Todos presentes ✅`
39. No marques presentes ni ausentes manualmente.
40. No uses acciones masivas.
41. No hagas ninguna otra accion en esa pantalla.

Parte 6: verificacion final
42. Confirma que el sistema quedo listo para un test de jugador con estas condiciones:
   - torneo recien creado
   - parejas importadas
   - grupos correctos
   - partidos de grupos generados
   - todos los partidos pendientes
   - sin resultados cargados
   - sin copas activas
   - presentismo desactivado

Formato obligatorio del reporte final:
1. Resultado general del setup: exitoso / fallido.
2. Parejas importadas: si / no.
3. Grupos correctos: si / no.
4. Partidos generados: si / no / no verificable directamente.
5. Resultados en cero despues de la normalizacion: si / no.
6. Copas en estado inicial: si / no.
7. Presentismo desactivado: si / no.
8. Bloqueos o inconsistencias encontradas.
9. Confirmacion final de si el sistema quedo listo para pasar al test de jugador.

Importante:
No empieces el test de jugador. Termina tu trabajo apenas dejes listas las precondiciones y entregues el reporte.
