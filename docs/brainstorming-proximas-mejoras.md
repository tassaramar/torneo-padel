# Product Backlog — Torneo de Pádel

> **Fuente única de verdad** para ideas, requerimientos y evolución del producto.
> Detalles técnicos de arquitectura → ver `CLAUDE.md`

**Última actualización**: 2026-03-09 (aprobación de copas con visibilidad y control de cruces implementada)

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

1. [MEJORA] Admin copas — gestión sin doble confirmación · `🔍 EN ANÁLISIS` · falta spec
2. _(libre)_
3. _(libre)_

---

## Backlog

> Ordenado por prioridad (Bloques A → B → C → D). Repriorizado 2026-03-03 con scoring del owner.

### Bloque B — Quick wins con spec lista

---


---

#### [MEJORA] Mensaje de cierre cuando el jugador terminó todos sus partidos `📋 PRIORIZADA`

**Score owner**: 2/5 · **Spec**: ✅ [spec-vista-jugador-mensaje-final.md](spec-vista-jugador-mensaje-final.md)

Hoy dice "No tenés partidos pendientes". Reemplazar por mensaje contextual: si ganó copa → "🏆 ¡Campeón!"; si fue finalista → "🥈 Finalista"; si solo jugó grupos → posición final + mensaje con onda.

**Archivo clave**: `src/viewer/vistaPersonal.js`

---

#### [MEJORA] fixture.html — ocultar secciones de grupos en fase de copas `📋 PRIORIZADA`

**Score owner**: 1/5 · **Spec**: ✅ [spec-fixture-ocultar-grupos-fase-copa.md](spec-fixture-ocultar-grupos-fase-copa.md)

Cuando no quedan partidos de grupo pendientes ni en juego, ocultar las secciones "Resumen por Grupo", "En Juego" y "Pendientes". Condición: `pendientes === 0 && en_juego === 0`.

**Archivo clave**: `src/fixture.js`

---

### Bloque C — Necesitan spec, luego implementar

---

#### [MEJORA] Autorefresh background — sin parpadeo al actualizar `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

El autorefresh (cada 30s) reconstruye el DOM completo, lo que genera un parpadeo visible y resetea el scroll. Propuesta: hacer el fetch en background, y solo aplicar los cambios al DOM cuando los datos nuevos ya están listos. Aplica a todas las páginas con polling: `index.html` y `fixture.html`.

**Archivos clave**: `src/personal.js`, `src/fixture.js`

---

#### [MEJORA] Partidos jugados (index.html) — card con colores ganado/perdido `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

La lista "Ver partidos jugados" solo tiene color en el score (verde/rojo en el número). Sería bueno aplicar un estilo de card más completo con fondo verde suave (ganado) o rojo suave (perdido), consistente con el patrón visual del modal Tablas/Grupos. No necesita ser idéntico, pero sí mantener el mismo lenguaje visual en todo el sistema.

**Archivos clave**: `src/viewer/vistaPersonal.js`, `style.css`

---

#### [MEJORA] Modal Tablas/Grupos — renombrar título "Consultar" `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

El título del modal muestra "Consultar", que no describe bien su contenido (tablas, copas y fixture). Cambiar por un título más descriptivo. Alternativas a proponer en la spec.

**Archivos clave**: `src/viewer/modalConsulta.js`

---

#### [BUG] Carga — mensaje STB sigue mostrando después de cargar el resultado `🔍 EN ANÁLISIS — DIFERIDO`

**Score owner**: 4/5 · **Spec**: ❌ falta · **Motivo diferimiento**: solo aplica a torneos a 3 sets, sin torneos de ese formato planeados por ahora.

Partido con super tiebreak: se carga el STB y el mismo mensaje ("contame qué pasó") sigue apareciendo en vez de "¡Bien que ganaste!" o "¡Qué lástima!".

**Archivo clave**: `src/viewer/cargarResultado.js`

---

#### [MEJORA] Admin copas — gestión sin esperar doble confirmación `🔍 EN ANÁLISIS`

**Score owner**: 4/5 · **Spec**: ❌ falta

Idea del owner: si hay partidos con resultados cargados pero en estado `a_confirmar`, mostrar al admin la info de qué se cargó y permitirle avanzar (aprobar propuestas o generar siguiente ronda) sin esperar que ambas parejas confirmen. La misma lógica aplica tanto a la creación de los primeros partidos de copa como a los siguientes. Requiere diseño detallado.

**Archivos clave**: `src/admin/copas/statusView.js`, RPC `avanzar_ronda_copa`

---

#### [DEUDA TÉCNICA] Unificar rutinas de reset del torneo `📋 PRIORIZADA`

**Score owner**: 4/5 · **Spec**: ❌ falta

4 implementaciones separadas de limpieza que no comparten código. Ya causó bugs reales (propuestas/esquemas huérfanas). Centralizar en RPCs de BD.

**Archivos clave**: `groups/index.js`, `statusView.js`, `groups/service.js`, `parejasImport.js`

---

#### [MEJORA] Admin copas — resaltar al ganador en los partidos `💡 CRUDA`

**Score owner**: 3/5 · Quick win (~5 líneas)

Nombre de la pareja ganadora en **negrita** en la vista admin de copas.

**Archivo clave**: `src/admin/copas/statusView.js`

---

#### [MEJORA] Tabla de posiciones del grupo — mostrar empates y criterios de desempate `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

La tabla de posiciones del grupo no explica los criterios utilizados para desempatar ni identifica empates a 3 equipos. El admin puede reordenar posiciones manualmente, pero no tiene visibilidad de por qué el sistema ordenó así. Importante para que la transición grupos → copas sea confiable.

**Archivos clave**: `src/admin/groups/compute.js`, `src/utils/tablaPosiciones.js`

---

### Bloque D — Diferir (diseño grande o bajo entusiasmo)

---

#### [MEJORA] Setup de torneo — panel de configuración centralizado `💡 CRUDA`

**Score owner**: 4/5 · Esfuerzo alto — requiere migración + cambios en muchos módulos

Varios parámetros hardcodeados (formato sets, puntos por partido, nombres grupos). Panel en admin.html para controlarlos.

---

#### [MEJORA] Admin copas — estado "Finalizado" con podio de campeones `🔍 EN ANÁLISIS`

**Score owner**: 3/5 · Requiere diseño de pantalla nueva

Paso 5 "Finalizado" en breadcrumb + podio por copa. Interacción con mensaje de cierre del jugador.

---

#### [MEJORA] Admin copas — UX wizard Etapas 2-4 `💡 CRUDA`

**Score owner**: 3/5 · Etapa 2: filtrado presets por compatibilidad. Etapa 3: descripción textual de presets + migrar hardcodeados a BD. Etapa 4: representación visual de brackets.

---

#### [MEJORA] Unificar Carga y Fixture en una sola página `💡 CRUDA`

**Score owner**: 3/5 · Feature grande, requiere diseño UX mobile

---

#### Análisis de tabla con IA `💡 CRUDA`

**Score owner**: 3/5 · Botón "¿Cómo estoy?" con llamada a Claude API.

---

#### [MEJORA] Admin copas — opción de 3er y 4to puesto en el wizard `💡 CRUDA`

**Score owner**: 2/5 · Requiere migración SQL.

---

#### [BUG] Múltiples sets — carga.html no muestra ni preserva todos los sets `🔍 EN ANÁLISIS — DIFERIDO`

**Score owner**: N/A (no hay torneos a 3 sets planeados) · Cuando se implemente, será la solución completa (carga.html con soporte multi-set).

**Root cause documentado**: carga.html fuerza `num_sets: 1` y nullea sets 2/3 al guardar. RPCs de copa no setean `num_sets` al crear partidos.
**Spec técnica**: [spec-fix-copa-bugs-rpc-unificado.md](spec-fix-copa-bugs-rpc-unificado.md) (sección Bug 3)

---

#### Múltiples torneos `🔍 EN ANÁLISIS`

**Score owner**: N/A · Depende de Gestión de usuarios individuales. Feature más grande del backlog.

---

#### Gestión de usuarios individuales `💡 CRUDA`

Registro de jugadores individuales con datos propios. Base para histórico y stats cross-torneo. Depende de RLS (ya implementado).

---

#### Sorteo de parejas `💡 CRUDA`

Armador de parejas + reveal animado + ajuste manual. Depende de Gestión de usuarios individuales.

---

#### Histórico individual de partidos `💡 CRUDA`

Historial de partidos por jugador. Depende de Múltiples torneos + Gestión de usuarios.

---

#### Round Robin en copas `💡 CRUDA`

**Score owner**: 1/5 · Formato Round Robin en wizard de copas. Requiere extender motor RPC.

---

#### [MEJORA] Barra de navegación admin unificada `💡 CRUDA`

**Score owner**: 1/5 · Unificar barras admin en FAB o menú minimalista.

---

#### [MEJORA] Copas con cantidad de equipos no potencia de 2 (byes) `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

Hoy las copas solo soportan 2, 4 u 8 equipos (potencia de 2). Para copas con 3, 5, 6, 7 equipos, los mejor clasificados podrían saltearse la primera ronda (bye). Formato nuevo de copa, junto con Round Robin.

---

#### [MEJORA] Admin Setup — UX del flujo de importación `💡 CRUDA`

**Score owner**: 1/5 · Botón Importar siempre habilitado, logs desaparecen al refresh.

---

## Historial — Implementado / Validado

### Admin copas — Aprobación con visibilidad y control de cruces `✅ IMPLEMENTADA`

**Fecha**: 2026-03-09 · **Spec funcional**: [spec-copa-aprobacion-cruces.md](spec-copa-aprobacion-cruces.md) · **Spec técnica**: [spec-copa-aprobacion-cruces-tecnico.md](spec-copa-aprobacion-cruces-tecnico.md)

Rediseño completo del flujo de aprobación de copas en admin.html tab Copas:
- **Visibilidad (D1)**: tabla de clasificados con puntos, DS, grupo; zona gris (empate en frontera); warnings de empates a 3 dentro de un grupo; equipos pendientes con null slots.
- **Control (D2)**: edición libre de cruces con selects; swap de equipos entre matches; warnings de mismo grupo en primera ronda; aprobación individual o masiva.
- **Propuestas progresivas**: `verificar_y_proponer_copas` genera propuestas con NULL slots cuando grupos terminan parcialmente (position-based seeding); sólo global espera todos los grupos.
- **Una sola función de cálculo**: `calcularClasificadosConWarnings` y `calcularCrucesConWarnings` en `planService.js` — sin código duplicado para partial vs complete.
- Resuelve: tabla general visible antes de aprobar (modo global), seeding anti-mismo-grupo (warnings), swap ⇄ entre matches distintos.

---

### [BUG] Tab Copas — estado inconsistente al importar nuevas parejas `✅ IMPLEMENTADA`

**Fecha**: 2026-03-09 · **Spec**: [spec-bugs-copa-estado-inconsistente.md](spec-bugs-copa-estado-inconsistente.md)

Los tres cambios de código ya estaban implementados en iteraciones anteriores; verificación confirmó que la migración `20260302000000_fix_reset_copas_esquemas` también está aplicada en producción.
- `parejasImport.js` `borrarTodoTorneo()`: borra `esquemas_copa` (CASCADE elimina `propuestas_copa`)
- `planEditor.js`: bloque `bloqueado` incluye botón Reset funcional que llama `resetCopas`
- `index.js`: detecta propuestas aprobadas huérfanas y ajusta `infoPaso2` con mensaje claro

---

### BUG score invertido — sistema-wide (Por confirmar + En revisión + Partidos jugados) `✅ IMPLEMENTADA`

**Fecha**: 2026-03-09 · **Spec**: [spec-bug-score-por-confirmar-invertido.md](spec-bug-score-por-confirmar-invertido.md)

- `invertirScoresPartido(partido)` agregada a `src/utils/formatoResultado.js` — swapea `set1..3_a↔b`, `sets_a↔b`, `games_totales_a↔b` retornando copia sin mutar el original.
- `renderPartidosConfirmar`: score orientado al jugador (soyA ? p : invertirScoresPartido(p)).
- `renderPartidosRevision`: ambos scores (original y temporal) orientados al jugador.
- `renderPartidosConfirmados` ("Partidos jugados"): score orientado; clases CSS `ganador`/`perdedor` con colores `#16A34A`/`#DC2626` alineados con tabla de posiciones.
- `orientarPartido` en `modalConsulta.js` simplificado para importar `invertirScoresPartido` como fuente única.

---

### Admin copas — UX wizard plantillas Etapa 1 `✅ IMPLEMENTADA`

**Fecha**: 2026-03-09 · **Spec**: [spec-admin-copas-wizard-ux-etapa1.md](spec-admin-copas-wizard-ux-etapa1.md) · **Versión**: v1.1.0 → v1.1.3

- Panel 1 reescrito como acordeón: cada plantilla se expande inline con diagrama de bracket + botones Aplicar/Borrar. Múltiples ítems abiertos simultáneamente.
- `renderBracketDiagram(copa, numGrupos)` — componente compartido (sin duplicación) en Panel 1 y `renderPlanActivo`.
- `renderPlanActivo` — Estado 2 prominente: plan vigente con diagramas completos + botón Reset visible.
- Botón Cancelar en paneles 2 y 3 del wizard.
- Formato del torneo visible: "N grupos × M equipos" (con rango "min-max" si grupos desiguales).
- Migración `20260309000000_drop_es_default_presets_copa.sql`: columna `es_default` eliminada de `presets_copa`.
- `presets.js` estático eliminado; `detectarYSugerirPreset` migrada a `planService.js` con soporte `minParejasPorGrupo`.
- Post-deploy fixes: toast al borrar plantilla, filtrado correcto con grupos desiguales, posiciones usadas deshabilitadas en dropdown global con "(usado)", validación de overlap al avanzar, info box "Posiciones ocupadas" eliminada, propagación de `modo` y rango automático a la siguiente copa.

---

### Bugs copa (final + modo global) + RPC unificado `✅ IMPLEMENTADA`

**Fecha**: 2026-03-03
**Spec**: [spec-fix-copa-bugs-rpc-unificado.md](spec-fix-copa-bugs-rpc-unificado.md)

- **Bug 1 — Final no se genera**: `cargarResultado.js` nunca llamaba al RPC de generación de finales. Resuelto con nuevo RPC genérico `avanzar_ronda_copa` que reemplaza a `generar_finales_copa`. Fire-and-forget agregado en `cargarResultado.js` (2 lugares) y `carga/copas.js`. Fix adicional: `guardarResultadoComoSet` en `carga/copas.js` no seteaba `estado='confirmado'` — `avanzar_ronda_copa` requiere ese estado para procesar el partido.
- **Bug 2 — Modo global genera 1 cruce**: `verificar_y_proponer_copas` no tenía rama para `{modo:'global'}`. Agregada rama que consulta `obtener_standings_torneo` con LIMIT/OFFSET. Además, fix de **race condition**: carga.html dispara el RPC partido por partido — cuando un grupo terminaba antes que otro, generaba bracket parcial. Fix: esquemas con `modo:'global'` ahora requieren que TODOS los grupos estén completos.
- **Mejora incluida**: Soporte para brackets de 8 equipos (QF) gratis en el RPC.
- **Migraciones**: `20260303000000_fix_copa_avanzar_ronda.sql` (consolidada con fix race condition)

---

### Admin copas — scores en games + labels ronda `✅ IMPLEMENTADA`

**Fecha**: 2026-03-02

Fix de scores en statusView (mostraba sets ganados "1-0" en vez de games "6-4, 3-6"). Centralización de labels de ronda en `src/utils/copaRondas.js`.

---

### Bugs wizard copas (admin) — 3 bugs resueltos `✅ IMPLEMENTADA`

**Fecha**: 2026-03-01
**Spec**: [docs/spec-bugs-wizard-copas-admin.md](spec-bugs-wizard-copas-admin.md)

- Bug 1 — Esquema custom no persiste: validación de reglas vacías antes de insertar.
- Bug 2 — "Editar" no navega el wizard: tercer parámetro `esquemaExistente` en `renderPlanEditor()`.
- Bug 3 — Botones de reset redistribuidos por tab (Grupos/Copas/Setup).

---

### Admin copas — indicador de progreso del flujo `✅ IMPLEMENTADA`

**Fecha**: 2026-03-01
**Spec**: [docs/spec-admin-copas-indicador-flujo.md](spec-admin-copas-indicador-flujo.md)

Breadcrumb de 4 pasos (Definir plan → Esperar grupos → Aprobar → En curso).

---

### Copa en vistas públicas — integración completa `✅ IMPLEMENTADA`

**Fecha**: 2026-03-01
**Spec**: [docs/spec-bugs-copa-vistas-publicas.md](spec-bugs-copa-vistas-publicas.md)

fixture.html cola unificada + index.html modal con tabs Grupos/Copas/Fixture + sub-tab General.

---

### Wizard de Copas + Presets en BD `✅ IMPLEMENTADA`

**Implementado**: 2026-02-28

Wizard de 4 paneles + presets en tabla `presets_copa` + motor `modo:'global'`.
**Migración**: `20260227000000_add_presets_copa.sql`

---

### Re-ingeniería sistema de copas `✅ IMPLEMENTADA`

**Implementado**: 2026-02-25

Modelo plan→propuesta→aprobación. Módulos: presets.js, planService.js, planEditor.js, statusView.js, bracketLogic.js.
**Migración**: `20260225000000_add_esquemas_copa.sql`
**Plan**: [docs/plan-reingenieria-copas.md](plan-reingenieria-copas.md)

---

### Seguridad — BD (Row Level Security) `✅ IMPLEMENTADA`

**Implementado**: 2026-02-24

RLS policies + función `is_admin()`. Páginas públicas: fixture, carga, presente.
**Migración**: `20260224000000_fix_rls_policies.sql`

---

### Versionado semántico `✅ IMPLEMENTADA`

**Fecha**: 2026-03-06

`v1.0.0` arranca. Versión en `package.json` (única fuente de verdad), expuesta en build via `__APP_VERSION__` (Vite `define`). Visible en topnav (derecha) en carga/fixture/admin, y como badge fijo bottom-right en index.html. Nuevo archivo: `src/utils/version.js` con `injectVersion()`.

---

### Carga.html — modo "A confirmar" `✅ IMPLEMENTADA`

**Fecha**: 2026-03-06 · **Spec**: [spec-carga-partidos-a-confirmar.md](spec-carga-partidos-a-confirmar.md)

- **4to botón "Confirmar"** en la barra de modos (entre Pendientes y Jugados). Badges con counter `(N)` en "Confirmar" y "Disputas" vía `actualizarCounters()` con Promise.all.
- **Query unificada**: todos los modos (incluido confirmar) traen grupos y copas juntos — sin filtro por `copa_id`. `cargarCopas` es no-op; `carga.html` eliminó el `<h2>Copas</h2>` huérfano.
- **Card de solo lectura**: ganador siempre arriba con `is-winner`, "Cargado por: [pareja]", botones Confirmar y Editar.
- **Confirmar**: optimistic UI (card desaparece al instante, rollback si falla).
- **Editar**: reutiliza `crearCardEditable` con mensaje en vivo "🏆 Ganó [pareja]" que se actualiza al cambiar los inputs.
- **Fire-and-forget** `avanzar_ronda_copa` para partidos de copa al confirmar.

---

### Modal — mi pareja siempre primero en partidos `✅ IMPLEMENTADA`

**Fecha**: 2026-03-06 · **Spec**: [spec-modal-jugador-primero.md](spec-modal-jugador-primero.md)

En los 3 tabs del modal (Grupos, Copas, Fixture), los partidos donde el jugador participa ahora muestran siempre "Yo vs Rival". Helper `orientarPartido()` centraliza la lógica — cuando se invierte el orden, el score también se invierte para mantener coherencia. Modificado únicamente `src/viewer/modalConsulta.js`.

---

### Polish copa — badge nombre + colores victoria/derrota en vista jugador `✅ IMPLEMENTADA`

**Fecha**: 2026-03-06 · **Spec**: [spec-polish-copa-vista-jugador.md](spec-polish-copa-vista-jugador.md)

- **Ítem 1 — Badge copa en cards**: join `copa:copas(id,nombre)` en la query de partidos. Cards pendientes y historial ahora muestran "🏆 Copa Oro — Semi" en vez de solo "Semi". Afecta `renderPartidosPendientesHome` (cards pendientes) y `renderPartidosConfirmados` (historial).
- **Ítem 2 — Colores victoria/derrota en modal**: partidos jugados por mi pareja en el modal de consulta ahora muestran fondo verde suave + borde verde (victoria) o rojo suave + borde rojo (derrota). Usa `determinarGanadorParaPareja` existente. Aplica en tabs Grupos y Copas del modal.

---

### Presentismo — mejoras UX `✅ IMPLEMENTADA`

**Implementado**: 2026-03-06 · **Spec**: [spec-presentismo-mejoras-ux.md](spec-presentismo-mejoras-ux.md)

6 mejoras en `presente.html` (3 de la spec + 3 adicionales del owner):
1. **Semántica del toggle**: OFF = "Todos presentes ✅" (antes decía "Desactivado ❌"). El comportamiento ya estaba correcto en el código — solo se actualizó el texto.
2. **Acciones masivas al final**: botones "Marcar TODOS" / "Limpiar TODOS" movidos debajo de la lista de parejas.
3. **Drill-down en resumen**: los cards "Completas / Incompletas / Ausentes" son ahora botones que expanden una lista inline con las parejas en ese estado y toggles individuales funcionales.
4. **Sincronización filtros**: al tocar un card del resumen, se activa automáticamente el filtro correspondiente en "Control por Pareja" con scroll suave.
5. **Layout compacto en Jugadores Ausentes**: pareja + grupo en una sola línea, botón ✅ (44×44px) anclado a la derecha. Optimistic UI: la card desaparece al instante con rollback si falla.
6. **Reordenamiento de secciones**: "Control por Pareja" sube antes de "Operaciones por Grupo".

---

### Autenticación Admin — Google OAuth `✅ IMPLEMENTADA`

**Implementado**: 2026-02-19

Login con Google OAuth para admin.html.

---

### Presentismo individual `✅ IMPLEMENTADA`

**Implementado**: 2026-01-30

Campo `presentes TEXT[]` + toggle `presentismo_activo`.
**Migración**: `20260130010000_add_presentes_to_parejas.sql`

---

### Modelo de sets `✅ IMPLEMENTADA`

**Implementado**: 2026-01-30

Refactor del modelo de juego a sets.
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
