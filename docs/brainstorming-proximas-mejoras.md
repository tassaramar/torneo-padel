# Product Backlog — Torneo de Pádel

> **Fuente única de verdad** para ideas, requerimientos y evolución del producto.
> Detalles técnicos de arquitectura → ver `CLAUDE.md`

**Última actualización**: 2026-03-01 (bugs copa vistas públicas implementados)

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

1. **Bugs wizard copas (admin)** — esquema no persiste, editar no navega wizard, reset duplicado
2. **Polish visual copa** — distinción badge en vista jugador, colores victoria/derrota en modal

---

## Backlog

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

### Tabla general del torneo `📋 PRIORIZADA`

**Idea**: Una tabla de posiciones global que agrupe a todas las parejas del torneo, no solo por grupo.

**Pregunta clave — criterio de ordenamiento**:
- **Opción A (preferida)**: Respetar primero la posición dentro del grupo (1ro de A > 2do de A > 1ro de B…) y dentro de cada posición desempatar por puntos/DS/GF. Esto preserva el valor del resultado "quedar primero en tu grupo".
- **Opción B**: Rankear puramente por puntos/DS/GF sin importar el grupo. Más simple pero puede "premiar" a un grupo más fácil.
- **Opción C**: Configurable por torneo (toggle en setup).

**Dónde mostrarla**:
- Tab nuevo en el modal "Tablas/Grupos/Fixture" de index.html
- También visible en analytics.html

**Dependencia**: Setup de torneo configurable (ver ítem siguiente) — el criterio de tabla general podría ser uno de los parámetros.

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

### [BUG] Partidos de copa no aparecen en "Todos los resultados" (fixture.html) `📋 PRIORIZADA`

**Síntoma**: En fixture.html, la sección "Todos los resultados" no muestra los partidos de copa — ni los pendientes ni los jugados. Sí aparecen en la cola de fixture normalmente.

**Pregunta clave**: ¿Es comportamiento esperado o bug? La sección debería mostrar TODOS los partidos del torneo (grupos + copas), tanto los jugados como los por jugar.

**Archivo clave**: `src/fixture.js` o el módulo que renderiza "Todos los resultados"

---

### [MEJORA] fixture.html — ocultar secciones de grupos cuando no quedan partidos pendientes `📋 PRIORIZADA`

**Idea**: Cuando ya no quedan partidos de grupos pendientes ni en juego, las secciones "Resumen por Grupo", "En Juego" y "Pendientes" dejan de tener utilidad. Ocultarlas y mostrar solo la sección de copas + ya jugados limpia la interfaz y reduce el ruido visual para el organizador.

**Condición de activación**: `partidos_grupos_pendientes === 0 && partidos_grupos_en_juego === 0`

**Archivo clave**: `src/fixture.js`

---

### [BUG] Modal "Tablas/Grupos" en index.html no muestra partidos de copa `📋 PRIORIZADA`

**Síntoma**: Al abrir el modal "Tablas/Grupos/Fixture" desde index.html, la pestaña de fixture no incluye los partidos de copa — solo muestra los de grupos.

**Archivo clave**: `src/viewer/modalConsulta.js`

---

### [MEJORA] Admin copas — indicador claro del paso del flujo `📋 PRIORIZADA`

**Problema**: El flujo de copas tiene pasos bien definidos pero la UI admin no es explícita sobre en qué paso estamos.

**Flujo propuesto (a mostrar al admin)**:
1. **Definir plan** — elegir o armar un esquema de copas
2. **Esperar grupos** — aguardar que finalicen los partidos de grupos necesarios
3. **Aprobar copas** — revisar las propuestas generadas automáticamente y confirmar
4. **Partidos en curso** — se juegan los partidos de copa; el motor genera las siguientes rondas automáticamente
5. **Final** — todos los partidos terminados

**Mejora esperada**: En la pantalla de admin, mostrar un indicador de progreso o un banner claro que diga "Paso 2 de 5 — Esperando que finalicen los grupos" (o similar). Evitar que el admin tenga que inferir el estado leyendo las propuestas.

**Archivo clave**: `src/admin/copas/statusView.js`, posiblemente `src/admin/copas/index.js`

---

### [MEJORA] Partidos de copa en index.html sin distinción visual `📋 PRIORIZADA`

**Problema**: Los partidos de copa aparecen en la vista del jugador igual que los partidos de grupos, sin ninguna señal visual que indique que es un partido especial.

**Idea**: Agregar un badge o etiqueta ("Copa Oro", "Copa Plata", etc.) visible en la card del partido de copa. Podría incluir un ícono de trofeo 🏆 y el nombre de la copa.

**Archivo clave**: `src/viewer/vistaPersonal.js`

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

### [BUG] Wizard copas — esquema custom se aplica pero no queda guardado `📋 PRIORIZADA`

**Síntoma**: Al crear un esquema personalizado en el wizard (sin guardarlo como preset), el sistema no da error pero los esquemas de copa no persisten en la BD. Probablemente `_applyEsquemas()` en `planEditor.js` falla silenciosamente o hay un problema con la llamada a `guardarEsquemas()` en `planService.js`.

**Para investigar**:
- Revisar si `guardarEsquemas()` retorna `ok: false` y el mensaje no se muestra
- Verificar si el problema es de permisos RLS (el admin necesita estar autenticado para escribir `esquemas_copa`)
- Agregar feedback visual explícito si falla

**Archivo clave**: `src/admin/copas/planEditor.js` → `_applyEsquemas()`, `src/admin/copas/planService.js` → `guardarEsquemas()`

---

### [BUG] Wizard copas — "Editar" desde statusView no permite navegar el wizard `📋 PRIORIZADA`

**Síntoma**: Cuando hay un esquema aplicado y los partidos están finalizados, el botón "Editar" en la vista admin lleva directamente al Panel 4 (Resumen del Plan) sin permitir navegar el wizard. El botón "‹" vuelve al panel de presets, no a los pasos del wizard donde el admin podría hacer cambios.

**Causa probable**: `_fromEsquemasToWiz(esquemas)` carga el estado del wizard y llama `_showPreview(() => _showPresets())` — el `backFn` apunta a `_showPresets` en lugar de `_showWizNum()` o `_showWizCopa(0)`.

**Fix esperado**: En modo "editar esquema existente", el back desde el preview debería ir a `_showWizNum()` para que el usuario pueda navegar los pasos del wizard y hacer cambios antes de aplicar.

**Archivo clave**: `src/admin/copas/planEditor.js` → `_showPresets()` handlers `.wiz-btn-edit`, y `statusView.js` donde se llama a `renderPlanEditor`.

---

### [REVISAR] Botón "Reset Resultados" — posible duplicado `📋 PRIORIZADA`

**Síntoma**: Existe un botón "Reset Resultados" en admin que parece solaparse funcionalmente con "Reset partidos de grupos". Posible duplicado o mal ubicado.

**Para investigar**:
- Verificar qué hace exactamente cada botón (`resetearResultados()` en `src/admin.js` vs. reset de grupos en `src/admin/groups/index.js`)
- Si son equivalentes, eliminar el duplicado
- Si difieren, evaluar si tiene sentido mantener ambos y mejorar los labels para que quede claro la diferencia

**Archivos clave**: `admin.html`, `src/admin.js` → `resetearResultados()`, `src/admin/groups/index.js`

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

### Bugs copa en vistas públicas `✅ IMPLEMENTADA`

**Fecha**: 2026-03-01
**Spec**: [docs/spec-bugs-copa-vistas-publicas.md](spec-bugs-copa-vistas-publicas.md)

- **fixture.html vista "Tabla"**: `renderFixtureGrid()` ahora recibe `partidosCopa` como segundo parámetro y agrega sección "🏆 Copas" al final del grid, agrupada por copa y ordenada por `orden_copa`. Reutiliza `renderCopaItem()` existente.
- **index.html modal tab "Fixture"**: `cargarDatosModal()` carga copas y partidos de copa en paralelo; `renderFixture()` llama `renderCopasEnModal()` al final mostrando copas agrupadas por nombre con ronda y resultado.

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
