Roles del asistente

Fase ya cerrada (hecha): Analista Funcional Senior (go-lives reales, eventos en vivo, usuarios no técnicos, carga bajo presión).
Fase actual (desde ahora): Desarrollador Senior Full Stack (Vite + JS vanilla + Supabase + Vercel) + mantiene mirada AF para no romper la operación en vivo.

Reglas históricas (para no reescribir la historia):

El torneo ya se jugó, el asistente NO estuvo.

No asumir qué funcionó bien/mal más allá de lo reportado.

La etapa de entrevista/síntesis ya está cerrada; ahora estamos en diseño e implementación.

Links y stack

Repo: https://github.com/tassaramar/torneo-padel

Deploy: https://torneo-padel-teal.vercel.app/

Páginas:

/ Viewer (solo lectura)

/carga/ Carga de resultados

/admin/ Admin

Stack: Vite + JS vanilla + Supabase + Vercel

Resumen del torneo (hechos)

100% celulares, datos móviles, sin WiFi. OS no fue factor relevante.

Inicio 19:05, fin ~22:10.

Setup previo: sin UI para cargar parejas/grupos; se editó Supabase a mano (tabla parejas, 12 dummy → nombres reales).

Asignación de grupos dependía de orden implícito; se mapeó en Excel, recarga + verificación 1x1.

En vivo (grupos):

App sirvió para confirmar rival; canchas/orden manual.

Carga: vos + Diego. Performance OK.

Fricción #1: encontrar partido correcto en /carga/ (muchos “casi cargo cualquiera”), mitigado validando con jugador.

Incidente: ausencias/reemplazo (Hernán → Ariel) no reflejado en app; no confusión, sí complicó búsqueda.

Copas:

Zonas desfasadas; se arrancaron copas antes de cerrar todo.

“Generar copas” dependía de zonas cerradas y tiró cruces inconsistentes vs lo jugado.

Semis a 2 sets (no representable).

Conclusión: go-live exitoso en lo crítico (grupos + carga), falló donde no era crítico ese día (copas).

Priorización y alcance próximo torneo

Orden: A, B, D, C

A) ABM + carga rápida de parejas (P0)

ABM en /admin/.

Import “pegar desde Excel” con preview + validaciones mínimas.

Edición individual para reemplazos/correcciones.

Sin audit formal, pero con “cancelar/deshacer” básico.

B) Copas manuales registrables (B0)

No autogeneración inteligente de llaves.

Admin crea partidos de copa manuales (Copa X + Pareja A + Pareja B).

Viewer muestra copas como lista (sin bracket).

Tema 3 sets: pendiente para definir después.

D) Engagement del Viewer

Buscador grande por nombre.

QR visible en el club.

Estados: pendiente / por confirmar / confirmado / en revisión.

C) Carga distribuida por equipos + confirmación

Equipo carga → “por confirmar”.

Rival confirma; si difiere → “en revisión”.

Resolución de revisión por admin.

Fallback: admin puede cargar/forzar.

Pendiente clave

Definir mecanismo de identidad simple para C (sin login pesado): tokens/QR/códigos por pareja.

Pedido al asistente (modo Dev Senior Full Stack)

Proponer diseño técnico + modelo de datos + endpoints/queries + UI mínima.

Implementar por etapas (PRs lógicas) con criterios de aceptación y escenarios de prueba (reemplazo, copas desfasadas, carga por equipos).