# Product Backlog — Torneo de Pádel

> **Fuente única de verdad** para ideas, requerimientos y evolución del producto.
> Detalles técnicos de arquitectura → ver `CLAUDE.md`

**Última actualización**: 2026-03-03 (bugs y mejoras post-testing end-to-end copas)

---

## Cómo usar este documento

- **Toda idea nueva** entra primero en `## Ideas Crudas` con estado `💡 CRUDA`
- **Al iniciar chat con IA**: copiar el bloque al final de este archivo (`## Bloque para IA`)
- **Al completar trabajo**: mover el ítem a `## Historial` con fecha y breve nota
- **Regla anti-cementerio**: si un ítem lleva +60 días sin avanzar, agregar nota de bloqueo o moverlo a Descartado
- **No duplicar con CLAUDE.md**: decisiones técnicas de implementación van en CLAUDE.md; acá van ideas y su estado

---

## Estados

| Emoji | Estado | Significado |
|-------|--------|-------------|
| 💡 | CRUDA | Idea registrada, sin análisis |
| 🔍 | EN ANÁLISIS | Siendo evaluada, preguntas abiertas |
| 📋 | PRIORIZADA | Analizada y lista para desarrollar |
| 🚧 | EN DESARROLLO | Sprint activo ahora mismo |
| ✅ | IMPLEMENTADA | Funcionando en producción |
| 🏆 | VALIDADA | Probada en torneo real |
| 🚫 | DESCARTADA | No se desarrollará (motivo registrado) |

---

## Próximas 3 — Roadmap activo

> Máximo 3 ítems a la vez. Para agregar uno, sacar uno primero. Obliga a priorizar.

1. **Bug scores + labels ronda + polish copa** — fix bug admin, centralizar `labelRonda()`, Doc 3 (badge copa + colores victoria/derrota)
2. **Mensaje de cierre + fixture copa** — Doc 7 (mensaje final jugador) + Doc 5 (ocultar grupos en fase copa)
3. **Presentismo UX** — Doc 8 (semántica toggle, mover botones, drill-down dashboard)

---

## Backlog

### [DEUDA TÉCNICA] Unificar rutinas de reset del torneo `💡 CRUDA`

Hoy hay 4 implementaciones de limpieza separadas que no comparten código:

| Operación | Archivo | Alcance |
|---|---|---|
| "Regenerar torneo" | `groups/index.js` → `resetCopas()` → RPC `reset_copas_torneo` | Copas + esquemas + propuestas (no toca grupos/parejas) |
| "Reset copas" (botón copas) | `statusView.js` → misma `resetCopas()` → mismo RPC | Ídem |
| "Reset partidos de ronda" | `groups/service.js` → `resetPartidosGrupos()` | Solo partidos de grupos (`copa_id IS NULL`) |
| "Importar parejas" | `parejasImport.js` → `borrarTodoTorneo()` | Todo: partidos + copas + esquemas + overrides + parejas + grupos |

**Problema**: si se agrega una tabla nueva, hay que actualizarla en todos los lugares por separado. Ya se vio en práctica: el bug de `propuestas_copa`/`esquemas_copa` huérfanas requirió fixes en dos lugares distintos.

**Dirección de mejora**: centralizar las operaciones de limpieza en RPCs de BD o en funciones compartidas de `src/utils/` o `src/admin/`, y hacer que cada botón delegue en esas rutinas. El caso más urgente es `borrarTodoTorneo()` en `parejasImport.js`, que es el único que hace deletes JS manuales en lugar de llamar al RPC.

---

### [BUG] Tab Copas — estado inconsistente al importar nuevas parejas con copas ya aprobadas `🔍 EN ANÁLISIS`

**Reproducción**: Hay 3 parejas, con copas aprobadas del ciclo anterior. Se importan 4 parejas nuevas (Setup → Importar). Se va al tab Copas.

**Síntoma observado** (screenshot disponible):
- Breadcrumb muestra "2. Esperar grupos" como paso activo
- Texto: "Esperando que finalicen los grupos (0 de 1 completados)"
- Texto: "🔒 Plan bloqueado — hay copas aprobadas. Usá Reset para empezar de nuevo."

**Problema**: Los dos mensajes son contradictorios. El breadcrumb dice "esperar grupos" pero el cuerpo dice "bloqueado por copas aprobadas". El usuario no entiende en qué estado está ni qué hacer.

**Causa probable**: Al importar parejas nuevas, los grupos se regeneran (partidos frescos, 0 jugados) pero las copas/esquemas del ciclo anterior persisten. `index.js` detecta que hay copas → va a `statusView`. Pero `statusView` también evalúa si los grupos terminaron → muestra el mensaje de "esperar grupos". Resultado: ambos textos aparecen al mismo tiempo.

**Síntoma adicional**: El botón "🗑 Reset copas" **no aparece en pantalla** en este estado. El mensaje dice "Usá Reset" pero el botón está ausente — el usuario queda sin salida visible.

**Workaround actual**: Tab Setup → "Regenerar torneo" (que incluye reset de copas), o manipular la BD directamente.

**Idea de fix**: Cuando `statusView` detecta grupos incompletos + copas del ciclo anterior, mostrar un único mensaje claro con el botón Reset visible: "El plan de copas es del ciclo anterior. Hacé Reset para empezar de nuevo con la nueva configuración."

**Archivos clave**: `src/admin/copas/index.js`, `src/admin/copas/statusView.js`

---

### Múltiples torneos `🔍 EN ANÁLISIS`

**Problema**: Un único torneo activo. Al iniciar uno nuevo, se borra la BD y se pierde todo el historial.

**Objetivo**: Guardar historial de torneos anteriores, trabajar sobre torneos nuevos sin perder datos.

**Preguntas clave**:
- ¿Cómo selecciona el jugador en qué torneo está participando?
- ¿El historial de torneos anteriores es accesible desde la app o solo como backup?
- ¿Cómo afecta a la estructura de BD (foreign keys en partidos, grupos, parejas)?

**Dependencia**: Conviene resolver identificación de jugadores (ver Gestión de usuarios individuales) antes para que el historial sea útil por jugador.

**Nota (2026-03-01)**: Fuera del roadmap activo hasta que "Gestión de usuarios individuales" esté definida. Es la feature más grande del backlog y requiere decisiones de diseño previas.

---

### Gestión de usuarios individuales `💡 CRUDA`

**Idea**: Registro de jugadores individuales con datos propios, independientes de las parejas.

**Datos posibles**:
- Nombre, apellido
- Lado de juego (Drive / Revés / Ambos)
- DNI
- Fecha de nacimiento
- Contraseña / método de autenticación

**Objetivo**: Validación de identidad más robusta. Base para histórico personal y estadísticas cross-torneo.

**Condición bloqueante**: Antes de almacenar datos personales sensibles (DNI, fecha de nacimiento), la seguridad de BD debe estar resuelta. No avanzar sin RLS activo.

**Dependencia fuerte**: Seguridad de BD (RLS) debe estar implementada primero.

---

### Sorteo de parejas `💡 CRUDA`

**Idea**: Sortear y presentar parejas entre los jugadores inscriptos al torneo. Dos patas indispensables: el **armador de parejas** (algoritmo balanceado) y el **reveal animado** (presentación para grabar y compartir por WhatsApp). Réplica y evolución del Sorteador existente (hoy en Google Sheets + Google Apps Script).

**Pata 1 — Armador de parejas**:
- Algoritmo v2: agrupar jugadores en Drive / Revés / Ambos, balancear matemáticamente, shufflear y formar parejas por índice
- Restricción opcional: marcar jugadores que no deben ser emparejados (equivalente al MatrimonioID del Sorteador)
- Input: lista de jugadores inscriptos con su lado de juego

**Pata 2 — Reveal animado** (igual o más importante que el sorteo):
- Presentación teatral pareja por pareja: nombre del jugador 1 → nombre del jugador 2 → cierre con humor
- Confetti en cada revelación
- Comentarios con humor estilo argentino (banco de frases)
- Timing configurable por segmento
- **Objetivo principal**: grabar la pantalla del celular y compartir el video por WhatsApp

**Pata 3 — Ajuste de parejas** (mejora respecto al Sorteador original):
- Antes del reveal, poder intercambiar jugadores entre parejas manualmente
- Confirmación visual de los cambios antes de ejecutar el reveal

**Preguntas clave**:
- ¿El sorteo lo hace solo el Admin o también el organizador (fixture.html)?
- ¿El resultado del sorteo genera directamente las parejas en la BD o es una propuesta editable que se confirma?
- ¿El reveal es una pantalla separada o dentro de admin.html?

**Dependencia**: Gestión de usuarios individuales — necesita que los jugadores tengan `lado` (Drive / Revés / Ambos) como dato propio, independiente de las parejas del torneo.

---

### Histórico individual de partidos `💡 CRUDA`

**Idea**: Cada jugador puede consultar su historial de partidos jugados (resultados, rivales, fechas).

**Preguntas clave**:
- ¿Solo del torneo actual o cross-torneos?
- ¿Estadísticas agregadas (W/L, sets ganados) o solo listado cronológico?
- ¿Dónde vive en la UI? ¿Tab nuevo en el modal de consulta del jugador?

**Dependencia**: Múltiples torneos + Gestión de usuarios individuales para que sea útil a largo plazo.

---

### [MEJORA] Setup de torneo — panel de configuración centralizado `💡 CRUDA`

**Problema**: Varios comportamientos del torneo están hardcodeados o dispersos en la BD sin UI para cambiarlos fácilmente.

**Idea**: Una sección "Setup" o "Configuración" en admin.html (ya existe el tab Setup) que permita controlar:

| Parámetro | Opciones | Estado actual |
|-----------|----------|---------------|
| Nombre del torneo | Texto libre | En BD, sin UI |
| Presentismo activo | Sí / No | En BD, hay toggle |
| Formato de sets | 1 set / Mejor de 3 / Opcional | Hardcodeado |
| Puntos por partido | (2,1) / (3,0) / (2,0) | Hardcodeado |
| Nombre de grupos | Texto por grupo (A, B, C…) | Hardcodeado |
| Nombre de copas | Texto por copa | En BD como `copas.nombre` |
| Criterio tabla general | Por posición de grupo / Por puntos globales | Sin implementar |
| ¿Algo más? | — | — |

**Impacto**: Muchos módulos deberían leer estos parámetros de BD en lugar de tener valores fijos. Requiere migración para agregar columnas a `torneos`.

**Archivos clave**: `admin.html` (tab Setup), `src/admin/setup/` (a crear), tabla `torneos`

---

### Análisis de tabla con IA `💡 CRUDA`

**Idea**: Un botón en la vista del jugador (index.html) — "¿Cómo estoy?" o "Analizá mi situación" — que llama a una IA con el contexto del torneo y devuelve un mensaje corto, divertido y útil sobre las chances del jugador.

**Qué le pasaríamos a la IA**:
- Tabla de posiciones del grupo (puntos, DS, GF de cada pareja)
- Partidos ya jugados del grupo
- Partidos que quedan por jugar
- Sistema de puntos del torneo (2,1 o 2,0)
- El nombre e identidad del jugador que consulta

**Qué esperamos que responda**:
- ¿Puede quedar primero? ¿Qué necesita que pase?
- ¿Ya está clasificado a alguna copa?
- Tono: corto, buena onda, estilo argentino — no un informe técnico

**Implementación técnica**:
- Llamada a Claude API (o similar) desde el frontend o desde un Edge Function de Supabase
- El prompt incluye los datos estructurados del torneo + pregunta fija
- Cachear la respuesta por X minutos para no llamar en cada refresh

**Preguntas a resolver**:
- ¿Llamada directa desde el browser (con API key expuesta) o via Edge Function?
- ¿Costo de API por torneo? ¿Limitar a N consultas por jugador?
- ¿El análisis es solo de grupos o también incluye copas?

**Archivos clave**: `src/viewer/vistaPersonal.js`, posiblemente nueva Edge Function en Supabase

---

### [MEJORA] Barra de navegación admin — unificar y hacer mobile-friendly `💡 CRUDA`

**Problema**: Hay dos barras de admin distintas e inconsistentes:
- En `index.html` (si estás logueado como admin): barra negra **abajo** con links de navegación
- En `admin.html`: barra negra **arriba** sin links, solo botón de logout

Además ambas ocupan pantalla de forma permanente, lo que en mobile es valioso.

**Idea**: Unificar en una solución mobile-friendly que no ocupe pantalla siempre. Opciones a evaluar:
- **FAB (Floating Action Button)** con menú desplegable al tocar — mínima ocupación
- **Bottom sheet** que aparece al deslizar desde abajo — patrón mobile estándar
- **Hamburger menu** minimalista en una esquina

**Contenido del menú unificado**: Links a todas las páginas de gestión (admin, fixture, carga, analytics) + botón de logout visible.

**Archivos clave**: `admin.html`, `index.html`, posiblemente un componente compartido nuevo en `src/`

---

### [MEJORA] Versionado semántico de la app `💡 CRUDA`

**Idea**: Implementar un número de versión visible en la app con el esquema `Major.Minor.Patch`:
- **Major**: cambios importantes (nuevas funcionalidades grandes, rediseños)
- **Minor**: mejoras y features menores
- **Patch**: ajustes, bugfixes

**Implementación sugerida**:
- Versión centralizada en `package.json` (campo `"version"`)
- Visible en algún lugar discreto de la UI (footer de admin, o pantalla "about")
- Podría mostrarse en el menú de navegación admin unificado (ver ítem anterior)

**Beneficio**: Da contexto al equipo y a los usuarios cuando reportan bugs ("esto pasó en v1.2.3").

---

### [MEJORA] index.html — mensaje final cuando el jugador no tiene más partidos `📋 PRIORIZADA`

**Problema**: Cuando un jugador ya jugó todos sus partidos, la app muestra "No tenés partidos pendientes" — un mensaje frío que no refleja lo que vivió ni le da cierre.

**Idea**: Reemplazarlo por un mensaje contextual y emotivo según el resultado final:
- Si ganó una copa → "🏆 ¡Campeón! Ganaste la Copa Oro"
- Si fue subcampeón → "🥈 ¡Finalista! Quedaste subcampeón de la Copa Plata"
- Si terminó sin copa → "✅ ¡Torneo completado! Quedaste Nº en el Grupo A"
- Con buena onda, estilo argentino — "¡Ya diste todo, crack!"

**Lógica a implementar**:
- Detectar si la pareja tiene partidos de copa → mostrar resultado de copa
- Si no tiene copa → mostrar posición final en el grupo
- Solo activar cuando no quedan partidos pendientes para esa pareja

**Preguntas a resolver**:
- ¿Cómo saber si una copa ya terminó o puede haber más rondas para esa pareja?
- ¿El nombre de la copa lo tomamos de `copas.nombre`?

**Archivo clave**: `src/viewer/vistaPersonal.js`

---

### [MEJORA] Presentismo — acciones masivas debajo del control por pareja `📋 PRIORIZADA`

**Idea**: En la pantalla de presentismo, mover los botones de acciones masivas ("Marcar todos presentes", etc.) para que queden debajo de la lista de control por pareja, no arriba. Mejora el flujo natural: primero se ve el estado individual, luego las acciones globales.

**Archivo clave**: `src/viewer/presentismo.js` o el HTML/template de la sección de presentismo

---

### [MEJORA] Presentismo — botones del dashboard como filtros o drill-down `📋 PRIORIZADA`

**Problema**: Los botones del dashboard de presentismo (ej. "3 presentes", "2 ausentes") muestran contadores pero no hacen nada útil al tocarlos.

**Dos opciones a evaluar**:

1. **Filtro**: Al tocar un botón del dashboard, filtra la lista "por Jugador" mostrando solo las parejas en ese estado (ej. tocar "Ausentes" → lista solo muestra parejas con algún jugador ausente). Tocar de nuevo desfiltrar.

2. **Drill-down / popover**: Al tocar el botón, aparece una lista compacta de las parejas/jugadores que están detrás de ese número, sin abandonar la pantalla.

**Preferencia inicial**: La opción 2 (drill-down) parece más útil para acción rápida — ver de un vistazo quiénes faltan sin scrollear toda la lista.

**Preguntas a resolver**:
- ¿El filtro reemplaza o convive con el listado completo?
- ¿El drill-down es un popover, un modal pequeño, o una expansión inline?

**Archivo clave**: `src/viewer/presentismo.js`, template del dashboard de presentismo

---

### [MEJORA] fixture.html — ocultar secciones de grupos cuando no quedan partidos pendientes `📋 PRIORIZADA`

**Idea**: Cuando ya no quedan partidos de grupos pendientes ni en juego, las secciones "Resumen por Grupo", "En Juego" y "Pendientes" dejan de tener utilidad. Ocultarlas y mostrar solo la sección de copas + ya jugados limpia la interfaz y reduce el ruido visual para el organizador.

**Condición de activación**: `partidos_grupos_pendientes === 0 && partidos_grupos_en_juego === 0`

**Archivo clave**: `src/fixture.js`

---

### [MEJORA] Partidos de copa en index.html sin distinción visual `📋 PRIORIZADA`

**Problema**: Los partidos de copa aparecen en la vista del jugador igual que los partidos de grupos, sin ninguna señal visual que indique que es un partido especial.

**Idea**: Agregar un badge o etiqueta ("Copa Oro", "Copa Plata", etc.) visible en la card del partido de copa. Podría incluir un ícono de trofeo 🏆 y el nombre de la copa y la ronda (Semi, Final...).

**Alcance adicional confirmado en testing**: También en el **popup de carga de resultado** — cuando el jugador abre el diálogo para cargar un resultado de copa, no hay indicación de que es un partido de copa ni de qué ronda es.

**Archivos clave**: `src/viewer/vistaPersonal.js`, `src/viewer/cargarResultado.js`

---

### [MEJORA] Modal index.html — pareja del jugador siempre primero en la lista de partidos `💡 CRUDA`

**Idea**: En el tab Fixture del modal (y en el listado de partidos del grupo), los partidos se muestran con las parejas en el orden en que están en la BD. Para el jugador, sería más natural ver siempre su pareja listada primero ("Yo vs Rival"), no "Rival vs Yo" según cómo quedó guardado el partido.

**Alcance**: Aplica al listado de partidos dentro del modal (`src/viewer/modalConsulta.js`), no necesariamente al fixture del organizador.

**Archivo clave**: `src/viewer/modalConsulta.js`

---

### [MEJORA] Colores en tablas/copas — verde para ganar, otro para perder `📋 PRIORIZADA`

**Problema**: En la sección "Tablas/Copas" del modal en index.html, todos los resaltados del jugador usan el mismo verde — tanto las victorias como las derrotas como la posición en tabla.

**Idea**:
- Verde → victorias (partidos ganados) y posición en tabla
- Rojo o naranja → derrotas (partidos perdidos)
- Sin cambio → fila de posición en tabla (mantener verde o neutro)

**Pregunta a resolver**: ¿La distinción de colores aplica también en la tabla de posiciones o solo en el listado de partidos jugados?

**Archivo clave**: `src/viewer/modalConsulta.js`, `src/utils/tablaPosiciones.js`

---

### [MEJORA] Admin copas — UX del wizard de presets `📋 PRIORIZADA`

**Prioridad elevada**: el estado actual no solo es molesto sino bastante confuso para el admin.

**Problemas identificados en testing**:

1. **No se indica cuál preset está activo**: Después de aplicar un preset, la vista vuelve a la lista sin indicar cuál fue seleccionado. El admin no tiene feedback de qué plan está activo. **Propuesta**: cuando hay un plan aplicado, mostrarlo prominentemente en una sección separada ("Plan activo") con detalle de seeds y cruces, y ocultar o minimizar la lista de presets alternativos. **Este es el problema más urgente — causa confusión real.**

2. **Presets de usuario no se filtran por formato compatible**: Los presets creados por el usuario se muestran todos juntos, sin importar si son compatibles con la cantidad de grupos/equipos actuales. Confunde al admin porque ve opciones que no puede aplicar.
   - **Comportamiento esperado**: mostrar por default solo los presets compatibles con el torneo actual. Un preset es compatible si su formato de grupos/equipos coincide con el torneo (misma cantidad de grupos y misma cantidad de equipos por grupo o compatible).
   - **Compatibilidad flexible**: un preset diseñado para más equipos por grupo podría aplicarse si el torneo actual tiene menos (ej: preset 3G×4E podría aplicarse en 3G×3E, tomando solo posiciones que existen). NO al revés.
   - **"Ver todos" opcional**: toggle para que el admin vea todos los presets guardados, pero sin poder aplicar los incompatibles (mostrarlos deshabilitados con tooltip explicando por qué).

3. **Falta descripción de cada preset**: El nombre solo ("1ro vs 3ro - 2do Out") no alcanza para entender qué hace. Cada preset debería mostrar un resumen de sus reglas: cuántas copas, quiénes entran a cada una, qué formato tienen.

4. **Presets hardcodeados vs BD generan duplicación**: Hoy `presets.js` tiene presets estáticos como fallback y `presets_copa` en BD tiene los mismos datos. Migrar los hardcodeados a BD y eliminar `presets.js` simplificaría el código.

5. **Representación visual de presets** *(más ambicioso)*: Mostrar una mini-vista del bracket/cruces de cada preset.

6. **[BUG confirmado] Botón "Reset copas" ausente en paso 2**: Con un esquema seleccionado y el breadcrumb en paso 2, el botón Reset no aparece en ningún lado. El admin no puede des-seleccionar el esquema y dejar el torneo sin plan de copas. Confirmado en testing: el único workaround es "Regenerar torneo" desde el tab Grupos.

7. **El wizard no muestra el formato actual del torneo**: En el paso 1 (lista de presets) no se ve en ningún lado cuántos grupos hay ni cuántas parejas tiene cada uno. El admin no puede saber qué presets son compatibles sin esa info de contexto. **Propuesta**: mostrar un resumen del torneo actual arriba de la lista de presets: "Torneo actual: 3 grupos × 4 parejas".

8. **Falta botón "Cancelar" en el wizard**: Al entrar al wizard para crear un plan, no hay forma de salir sin aplicar algo. Si el admin entró por error o quiere volver atrás, no tiene opción visible. **Propuesta**: botón "Cancelar" al pie del wizard que vuelve al estado previo (si había un esquema aplicado, vuelve a mostrarlo; si no había nada, vuelve al paso 1 limpio).

**Sugerencia de implementación por etapas**:
- Etapa 1 (urgente): Sección "Plan activo" prominente + botón Reset visible en paso 2 + info de formato del torneo en paso 1 + botón Cancelar
- Etapa 2: Filtrado de presets por compatibilidad + "Ver todos" con presets deshabilitados
- Etapa 3: Descripción textual de cada preset + migrar hardcodeados a BD
- Etapa 4: Representación visual (requiere diseño)

**Archivos clave**: `src/admin/copas/planEditor.js`, `src/admin/copas/presets.js`, `src/admin/copas/planService.js`, `src/admin/copas/index.js`

---

### [BUG CRÍTICO] Copa — final no se genera automáticamente al confirmar las semis `💡 CRUDA`

**Reproducción** (testing end-to-end, Paso 18 de [testing-guide-copas.md](testing-guide-copas.md)):
- Copa de 4 equipos con semis y final
- Se cargaron y confirmaron los resultados de las 2 semis desde `index.html`
- La final **no se creó automáticamente**
- Se volvió a intentar cargando desde `carga.html` → tampoco se creó la final

**Impacto**: Bloqueante. El torneo de copa no puede completarse sin que la final exista.

**Causa sospechosa**: El RPC `generar_finales_copa` debería ejecutarse automáticamente al confirmar la última semi. El trigger está en `cargarResultado.js` (fire-and-forget al confirmar). Verificar si el trigger se llama para partidos de copa confirmados desde ambos flujos (index.html y carga.html).

**Archivos sospechosos**: `src/viewer/cargarResultado.js`, `src/carga/copas.js`, RPC `generar_finales_copa`

---

### [BUG] Copa — propuesta genera 1 cruce en lugar de 2 para bracket de 4 equipos `💡 CRUDA`

**Reproducción** (testing end-to-end, Paso 9 de [testing-guide-copas.md](testing-guide-copas.md)):
- 2 grupos de 3 parejas
- Preset custom: 1 copa, 4 equipos, seeding por tabla general
- Todos los partidos de grupos confirmados
- Propuesta generada: **1 partido solo** en vez de 2 cruces de semifinal

**Workaround**: Volver al paso 1, aplicar el preset nuevamente → las copas se generaron correctamente en el segundo intento.

**Posibilidades a investigar**:
- El preset custom no se guardó/aplicó correctamente al esquema (reglas vacías o incompletas)
- El RPC `verificar_y_proponer_copas` con `modo: 'global'` generó solo 1 seed en lugar de 4
- Race condition: el preset se aplicó pero la propuesta se generó antes de que el esquema se guardara

**Archivos sospechosos**: `src/admin/copas/planEditor.js` (`_applyEsquemas`), `src/admin/copas/planService.js` (`guardarEsquemas`), RPC `verificar_y_proponer_copas`

---

### [BUG] Admin copas — scores muestran sets ganados en lugar de games `📋 PRIORIZADA`

**Problema**: En `admin.html` > Copas > partidos en curso, el resultado se muestra como "1–0" (sets ganados) en lugar de "6–4, 4–6" (games por set). Causa: `statusView.js` usa `p.sets_a–p.sets_b` directamente en lugar de llamar a `formatearResultado()`.

**Fix**: Agregar campos de sets a la query SELECT + usar `formatearResultado(p)` en `renderPartido()`.

**Archivo clave**: `src/admin/copas/statusView.js`

---

### [MEJORA] Admin copas — estado "Finalizado" con podio de campeones `🔍 EN ANÁLISIS`

**Problema**: El breadcrumb de copas tiene 4 pasos (Definir plan → Esperar grupos → Aprobar → En curso). El paso 4 nunca termina — cuando se jugaron todos los partidos de copa, sigue diciendo "En curso". No hay cierre visual ni se muestra quién ganó.

**Idea**: Agregar un paso 5 "Finalizado" que se active cuando todos los partidos de copa estén confirmados/terminados. Mostrar una pantalla de podio por copa: Campeón, Subcampeón, 3° Puesto (si hubo).

**Preguntas abiertas**:
- ¿Qué pasa si una copa terminó pero otra no? ¿Paso 5 parcial o solo cuando TODAS terminan?
- ¿El admin puede "volver atrás" desde Finalizado (ej. resetear una copa)?
- ¿Esta pantalla de podio también debería existir en la vista del jugador (index.html)?
- ¿El estado Finalizado persiste en BD o es derivado de los partidos?
- ¿Interacción con el mensaje de cierre del jugador (Doc 7)?

**Archivos clave**: `src/admin/copas/index.js`, `src/admin/copas/statusView.js`

---

---

### [MEJORA] Admin copas — opción de 3er y 4to puesto en el wizard `📋 PRIORIZADA`

**Problema**: El partido por 3er y 4to puesto se genera siempre para brackets de 4 y 8 equipos. No hay forma de desactivarlo desde el wizard.

**Idea**: Agregar un toggle "¿Incluir partido por 3er y 4to puesto?" en el Panel 3 del wizard cuando `equipos >= 4`. Requiere guardar la preferencia en el esquema y que el RPC `aprobar_propuestas_copa` la respete.

**Complejidad**: Requiere migración SQL para modificar el RPC. Diferido a próxima ronda de implementación.

**Archivos clave**: `src/admin/copas/planEditor.js`, `src/admin/copas/planService.js`, migración SQL

---

### [BUG] Múltiples sets — carga.html no muestra ni preserva todos los sets `🔍 EN ANÁLISIS`

**Síntoma confirmado en testing**: Un partido cargado con 3 sets por los jugadores (desde index.html) solo muestra **1 set** en carga.html. Al cargar el resultado desde carga.html, elimina los resultados del set 2 y 3.

**Aclaración**: El fix no debe ser que no elimine los sets extra, sino que **permita ver y cargar todos los sets** del partido (los que correspondan según `num_sets`).

**Síntoma adicional para copa**: Al intentar cargar el resultado de un partido de copa, la UI no permite ingresar más de 1 set. Probablemente el RPC `aprobar_propuestas_copa` crea partidos con `num_sets = 1` siempre.

**Impacto**: Doble problema — carga.html es inconsistente con index.html para partidos de grupos multi-set; los partidos de copa quedan forzados a 1 set aunque el torneo use 3.

**Para investigar**:
- ¿De dónde toma `num_sets` el flujo de carga de copa?
- ¿El RPC `aprobar_propuestas_copa` crea partidos con `num_sets = 1` siempre?
- ¿Por qué carga.html ignora los sets 2 y 3 al mostrar un partido ya cargado?

**Archivos sospechosos**: `src/viewer/cargarResultado.js`, `src/carga/copas.js`, migración SQL del RPC `aprobar_propuestas_copa`

---

### [BUG] Carga — mensaje STB sigue mostrando "contame qué pasó" después de cargar el resultado `💡 CRUDA`

**Reproducción**:
- Partido con super tiebreak (empate 1-1 en sets)
- Al llegar al set 2 empatado, se muestra "contame qué pasó en el STB" → correcto
- Se carga el resultado del STB y hay un ganador claro
- El mismo mensaje del STB **sigue apareciendo** en lugar de mostrar el resultado del ganador

**Comportamiento esperado**: Una vez cargado el STB, identificar la situación y mostrar mensaje acorde:
- Ganaste el STB → "¡Bien que ganaste!"
- Perdiste el STB → "¡Qué lástima!"
- Empate en STB → no debería ser posible, mostrar error

**Archivo clave**: `src/viewer/cargarResultado.js` — lógica del mensaje post-STB

---

### [MEJORA] Admin Setup — UX del flujo de importación de parejas `💡 CRUDA`

**Problemas identificados en testing**:

1. **Botón "Importar" siempre habilitado aunque no se hizo Preview**: El botón funciona solo después de hacer click en "Previsualizar", pero visualmente está disponible desde el inicio. Confuso. Mínimo: dejarlo deshabilitado hasta que se previsualice. Máximo: mini wizard que guíe los pasos.
   - Antes de cambiar el flujo, entender si "Previsualizar" es obligatorio por alguna razón de validación o si es solo un paso de confirmación.

2. **Los logs de importación desaparecen al hacer refresh**: Al finalizar la importación, la página se recarga y todos los logs del proceso (qué se borró, qué se creó, errores si los hubo) desaparecen. El admin no tiene registro de qué pasó.
   - **Opción A**: Eliminar el reload automático y actualizar la UI de forma incremental (más trabajo pero mejor UX)
   - **Opción B**: Conservar el reload pero guardar los logs de la importación en `sessionStorage` y mostrarlos al recargar (más simple)

**Archivo clave**: `src/admin/parejas/parejasImport.js`

---

### [MEJORA] Admin copas — gestión de resultados sin esperar doble confirmación `💡 CRUDA`

**Contexto**: En la fase de copa, es común que solo un equipo cargue el resultado. El flujo actual (ambas parejas deben confirmar) puede frenar el avance del torneo.

**Problemas identificados**:

1. **En Admin-Copas no se distinguen partidos confirmados de los que solo tienen una carga**: El admin no puede ver de un vistazo cuáles partidos están `confirmado` vs `a_confirmar`.

2. **El admin debería poder avanzar aunque no estén confirmados**: Si el admin ve que hay 2 cargas consistentes pero ninguna confirmó, debería poder confirmar manualmente sin esperar.

3. **No esperar confirmación para generar siguientes rondas**: Podría ser suficiente con que el resultado esté "cargado" (no necesariamente `confirmado`) para que el motor genere la siguiente ronda. El admin tiene visibilidad de los resultados incompletos.

**Propuesta**:
- En la vista de copa (statusView), diferenciar visualmente partidos `confirmado` vs `a_confirmar`
- Botón "Confirmar resultado" por partido en la vista admin, que fuerza el estado a `confirmado`
- Evaluar si `generar_finales_copa` puede activarse con resultado `a_confirmar` además de `confirmado`

**Archivos clave**: `src/admin/copas/statusView.js`, RPC `generar_finales_copa`

---

### [MEJORA] Admin copas — resaltar al ganador en los partidos `💡 CRUDA`

**Idea**: En la vista de Admin-Copas, cuando un partido tiene resultado cargado o confirmado, mostrar el nombre de la pareja ganadora en **negrita** para identificarla rápidamente.

**Alcance**: Solo la vista admin (`statusView.js`), no afecta index.html ni fixture.html.

**Archivo clave**: `src/admin/copas/statusView.js`

---

### [MEJORA] Unificar Carga y Fixture en una sola página para admin/ayudante `💡 CRUDA`

**Idea**: Hoy `fixture.html` muestra la cola de partidos y `carga.html` permite cargar resultados, pero son páginas separadas. El organizador tiene que navegar entre ambas durante el torneo.

**Objetivo**: Una única página (`fixture.html` extendida o nueva) que permita al admin/ayudante gestionar todo el torneo en curso: ver la cola, marcar partidos en juego, y cargar/confirmar resultados directamente.

**Nota**: Es una de las features más importantes para la operación del torneo. Requiere pensar bien el diseño antes de implementar — especialmente la UX mobile.

**Sub-mejora relacionada**: Agregar en `carga.html` una sección para identificar partidos pendientes de confirmación y confirmarlos rápidamente (acción más acotada y separable).

**Archivos clave**: `src/fixture.js`, `src/carga.js`, posiblemente nueva página unificada

---

### Round Robin en copas `💡 CRUDA`

**Idea**: Agregar formato Round Robin como opción en el wizard de copas, además de Mata-mata (bracket/cruce directo).

**Contexto**: El wizard actual solo soporta `equipos: 2/4/8` (cruce directo o bracket). Round Robin agregaría un `formato: 'round_robin'` donde todos los equipos de la copa se enfrentan entre sí.

**Preguntas clave**:
- ¿Cómo se combinan grupos y sistema de puntos para Round Robin de copa? ¿Es lo mismo que la fase de grupos?
- ¿La fase final de la copa también sería bracket? ¿O solo el Round Robin?
- ¿Cómo afecta al motor RPC `verificar_y_proponer_copas` que hoy solo soporta bracket/direct?

**Dependencia**: Requiere extender el motor de propuestas (RPC) y el modelo de datos de `copas/partidos`.

---

## Historial — Implementado / Validado

### Centralizar labels de rondas de copa `✅ IMPLEMENTADA`

**Fecha**: 2026-03-02

Creado `src/utils/copaRondas.js` con `labelRonda(ronda, corto)`. Labels largo: SF→Semifinal, F→Final, 3P→3er y 4to puesto, direct→Final, QF→Cuartos de final. Labels corto: SF→Semi, F→Final, 3P→3° Puesto, direct→Final, QF→Cuartos. Eliminada duplicación en `statusView.js`, `vistaPersonal.js`, `carga/copas.js`, `planEditor.js`. Corregido label de `direct`: era "Cruce" en vistaPersonal, ahora es "Final" consistentemente.

---

### Bugs wizard copas (admin) — 3 bugs resueltos `✅ IMPLEMENTADA`

**Fecha**: 2026-03-01
**Spec**: [docs/spec-bugs-wizard-copas-admin.md](spec-bugs-wizard-copas-admin.md)

- **Bug 1 — Esquema custom no persiste**: `guardarEsquemas()` en `planService.js` ahora valida que ningún esquema tenga `reglas: []` antes de insertar. `_showPreview()` en `planEditor.js` muestra aviso inline y deshabilita "Aplicar" si alguna copa (modo grupo) no tiene posiciones seleccionadas. `_applyEsquemas()` ya no redirige a presets en caso de error — el admin se queda en el panel actual para corregir.
- **Bug 2 — "Editar" no navega el wizard**: `renderPlanEditor()` acepta tercer parámetro `esquemaExistente`; si hay esquema, carga el wizard en Panel 2 (cuántas copas) en lugar de Panel 1 (presets). `statusView.js` pasa los esquemas actuales al llamar a `renderPlanEditor`. Los botones "Editar" de presets (`.wiz-btn-edit`, `.wiz-btn-local-edit`) ahora pasan `() => _showWizNum()` como backFn del Panel 4, no `() => _showPresets()`.
- **Bug 3 — Botones de reset redistribuidos por tab**: Tab Grupos → "Limpiar resultados de grupos" (solo limpia scores, no toca copas). Tab Copas → "Reset copas" con modal de 2 opciones: "Solo resultados" (limpia scores de copa, conserva estructura) o "Todo (partidos + plan)" (llama `reset_copas_torneo` RPC). Tab Setup → "Regenerar torneo" (reset copas + regenera partidos de grupos desde parejas).

---

### Admin copas — indicador de progreso del flujo `✅ IMPLEMENTADA`

**Fecha**: 2026-03-01
**Spec**: [docs/spec-admin-copas-indicador-flujo.md](spec-admin-copas-indicador-flujo.md)

Breadcrumb de 4 pasos (Definir plan → Esperar grupos → Aprobar → En curso) siempre visible en la parte superior del panel de copas en `admin.html`. El paso activo se resalta en azul, los completados muestran ✓ en verde, los futuros en gris. Debajo del breadcrumb, mensaje contextual de acción. En paso 2, muestra "X de Y grupos completados" consultando los partidos de cada grupo. Implementado en `src/admin/copas/index.js` + CSS en `style.css`.

---

### Copa en vistas públicas — integración completa `✅ IMPLEMENTADA`

**Fecha**: 2026-03-01
**Spec**: [docs/spec-bugs-copa-vistas-publicas.md](spec-bugs-copa-vistas-publicas.md)

**fixture.html — cola unificada**:
- Los partidos de copa pendientes se integran al final de la sección "Pendientes" (eliminada la sección separada "🏆 Copas pendientes"). Numeración global continua (#1, #2…). `renderCopaItem()` acepta `posicion` para mostrar el número. Ordenados por nombre de copa, luego por ronda (SF → F → 3P).

**index.html modal — reestructuración completa de tabs**:
- Nuevos tabs: **Grupos** | **Copas** (condicional) | **Fixture**. Tab "Copas" solo aparece si hay copas con partidos en BD.
- Tab **Grupos**: sub-tabs por grupo (Grupo A, B, C…) con scroll horizontal + sub-tab "General" al final. El grupo del jugador queda seleccionado por defecto. Cada sub-tab muestra tabla de posiciones + partidos del grupo.
- Sub-tab **General**: tabla cross-grupos vía RPC `obtener_standings_torneo`. Ordenada por posición en grupo, luego Pts/DS/GF. Separadores visuales entre bloques de posición. Aviso "⚠️ Tabla provisional" si algún grupo no terminó. Pareja del jugador resaltada.
- Tab **Copas**: una sección por copa con sus partidos en orden de ronda (SF → F → 3P). Muestra resultado si está jugado, "Esperando resultado anterior" si un equipo no está definido aún. Resalta partidos del jugador.
- Tab **Fixture**: partidos de grupo pendientes (en orden de cola) + partidos de copa pendientes al final con badge 🏆 y numeración continua. Resalta partidos del jugador.
- CSS: nuevas clases `.modal-sub-tabs`, `.modal-sub-tab`, `.modal-copa-seccion`, `.modal-copa-titulo`, `.modal-aviso-provisional`, `.tabla-general-scroll`, `.tabla-general-separador`, `.modal-fixture-copa-pill`.

---

### Wizard de Copas + Presets en BD `✅ IMPLEMENTADA`

**Implementado**: 2026-02-28
**Qué se hizo**: Reescritura de `planEditor.js` como wizard de 4 paneles. Panel 1: lista de presets compatibles (filtrados por formato) + presets guardados + "Crear personalizado". Panel 2: cuántas copas + nombres. Panel 3: por copa — formato (2/4/8 eq) + seeding (por posición de grupo o por tabla general del torneo). Panel 4: preview + guardar preset + aplicar. Presets migrados de localStorage a tabla `presets_copa` en BD.
**Motor extendido**: RPC `verificar_y_proponer_copas` ahora soporta `modo:'global'` — seeding por ranking global del torneo, requiere que todos los grupos estén completos.
**Tabla nueva**: `presets_copa` con 9 presets por defecto sembrados (2x3 → 4x4, incluyendo `2x4-dos-brackets`).
**Migración**: `20260227000000_add_presets_copa.sql`
**Plan de diseño**: `C:\Users\Martin\.claude\plans\indexed-snuggling-llama.md`

---

### Re-ingeniería sistema de copas `✅ IMPLEMENTADA`

**Implementado**: 2026-02-25
**Qué se hizo**: Reemplazo completo del sistema de copas. Nuevo modelo plan→propuesta→aprobación. El admin define un plan de copas (esquemas_copa) una vez; el motor genera propuestas automáticamente cuando grupos terminan; el admin revisa y aprueba antes de publicar. Finales se generan automáticamente cuando las semis están confirmadas.
**Módulos nuevos**: `presets.js`, `planService.js`, `planEditor.js`, `statusView.js`, `bracketLogic.js`, `utils/tablaGrupoDB.js`
**Migración**: `20260225000000_add_esquemas_copa.sql` (tablas `esquemas_copa`, `propuestas_copa`, funciones RPC)
**Vistas actualizadas**: fixture.html (copa en cola), index.html (copa en vista jugador)
**Plan de diseño**: [`docs/plan-reingenieria-copas.md`](plan-reingenieria-copas.md)

---

### Seguridad — BD (Row Level Security) `✅ IMPLEMENTADA`

**Implementado**: 2026-02-24
**Qué se hizo**: RLS policies alineadas con el modelo de autenticación. Función `is_admin()` con SECURITY DEFINER. Escrituras estructurales restringidas a admin autenticado; escrituras operacionales (UPDATE partidos/parejas) abiertas a anon para soportar páginas públicas (fixture, carga, presente). `admin_users` protegida con RLS. `posiciones_manual` habilitada (estaba OFF).
**Migración**: `20260224000000_fix_rls_policies.sql`
**Cambio relacionado**: fixture.html, carga.html, presente.html pasaron a ser páginas públicas (sin login). Solo admin.html y analytics.html requieren login.
**Plan de diseño**: `C:\Users\Martin\.claude\plans\iterative-bouncing-trinket.md`

---

### Autenticación Admin — Google OAuth `✅ IMPLEMENTADA`

**Implementado**: 2026-02-19
**Qué se hizo**: Login con Google OAuth para proteger `admin.html`. Overlay de login fijo que cubre el contenido admin hasta autenticar.
**Commits clave**: `41575a4 feat(auth): implementar autenticación admin con Google OAuth`, `0f0a4d2 fix(auth): login screen como overlay fijo`

---

### Presentismo individual `✅ IMPLEMENTADA`

**Implementado**: 2026-01-30
**Qué se hizo**: Campo `presentes TEXT[]` en tabla `parejas`. Toggle `presentismo_activo` en `torneos`. Badges visuales (✅/⚠️) en vista de fixture y del jugador.
**Migración**: `20260130010000_add_presentes_to_parejas.sql`

---

### Modelo de sets `✅ IMPLEMENTADA`

**Implementado**: 2026-01-30
**Qué se hizo**: Refactor del modelo de juego a sets. Formato de resultado actualizado.
**Migración**: `20260130000000_refactor_games_to_sets_model.sql`

---

## Descartado

*(Vacío por ahora — cuando se descarte algo, registrar motivo para no volver a discutirlo)*

---

## Bloque para IA

> Copiar esto al inicio de cada nuevo chat con Claude Code, Cursor u otra IA.

```
### Contexto del proyecto

- **App**: Gestión de torneos de pádel (Vite + Supabase + JS vanilla)
- **Deploy**: https://torneo-padel-teal.vercel.app/
- **Arquitectura técnica**: leer `CLAUDE.md` antes de cualquier decisión técnica
- **Fuente única de ideas y evolución**: `docs/brainstorming-proximas-mejoras.md`

### Estados del backlog

💡 CRUDA → 🔍 EN ANÁLISIS → 📋 PRIORIZADA → 🚧 EN DESARROLLO → ✅ IMPLEMENTADA → 🏆 VALIDADA
(o 🚫 DESCARTADA con motivo registrado)

### Reglas para este chat

1. Si surge una idea nueva → agregarla al backlog en estado 💡 CRUDA
2. Si completamos algo → actualizar estado en el documento y mover a Historial
3. No reimplementar lo que ya está en "Historial — Implementado"
4. No tomar decisiones de arquitectura sin leer CLAUDE.md primero
5. Datos personales sensibles (DNI, etc.) → no implementar sin RLS activo primero
```
