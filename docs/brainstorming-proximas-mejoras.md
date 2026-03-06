# Product Backlog — Torneo de Pádel

> **Fuente única de verdad** para ideas, requerimientos y evolución del producto.
> Detalles técnicos de arquitectura → ver `CLAUDE.md`

**Última actualización**: 2026-03-06 (polish copa vista jugador completado)

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

1. **Carga.html: partidos pendientes de confirmación** — Sección que muestre partidos `a_confirmar`/`en_revision`
2. _(libre — agregar próxima prioridad)_
3. _(libre — agregar próxima prioridad)_

---

## Backlog

> Ordenado por prioridad (Bloques A → B → C → D). Repriorizado 2026-03-03 con scoring del owner.

### Bloque A — Implementar ya

---

#### [MEJORA] Carga.html — sección de partidos pendientes de confirmación `📋 PRIORIZADA`

**Score owner**: 5/5 · **Spec**: ❌ falta

Hoy en `carga.html` no hay forma de ver qué partidos tienen resultado cargado pero pendiente de confirmación. El organizador no sabe qué partidos están "trabados". Agregar sección que muestre partidos en estado `a_confirmar` o `en_revision` para confirmarlos rápidamente.

**Archivo clave**: `src/carga/`

---

#### [MEJORA] Versionado semántico de la app `📋 PRIORIZADA`

**Score owner**: 5/5 · **Spec**: ❌ (trivial, no necesita spec)

Número de versión visible en la app (`Major.Minor.Patch`). Versión centralizada en `package.json`, visible en algún lugar discreto de la UI. Beneficio: contexto al reportar bugs ("esto pasó en v1.2.3").

---

### Bloque B — Quick wins con spec lista

---

#### [BUG] Tab Copas — estado inconsistente al importar nuevas parejas `📋 PRIORIZADA`

**Score owner**: 2/5 · **Spec**: ✅ [spec-bugs-copa-estado-inconsistente.md](spec-bugs-copa-estado-inconsistente.md)

Al importar parejas nuevas con copas del ciclo anterior, el tab Copas muestra mensajes contradictorios y el botón Reset no aparece. Workaround: "Regenerar torneo" desde tab Setup.

**Archivos clave**: `src/admin/copas/index.js`, `src/admin/copas/statusView.js`

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

#### [MEJORA] Admin copas — UX del wizard de presets (Etapa 1) `📋 PRIORIZADA`

**Score owner**: 4/5 (plan activo) + 3/5 (info formato + cancelar) · **Spec**: ❌ falta

Etapa 1 (urgente) del wizard:
1. **Plan activo prominente**: después de aplicar un preset, mostrar qué plan está activo con detalle de seeds/cruces (problema más urgente — causa confusión real).
2. **Botón Reset visible en paso 2**: hoy dice "Usá Reset" pero el botón no aparece.
3. **Info formato del torneo**: mostrar "Torneo actual: 3 grupos × 4 parejas" arriba de la lista de presets.
4. **Botón Cancelar**: poder salir del wizard sin aplicar nada.

**Archivos clave**: `src/admin/copas/planEditor.js`, `src/admin/copas/index.js`

---

#### [BUG] Carga — mensaje STB sigue mostrando después de cargar el resultado `📋 PRIORIZADA`

**Score owner**: 4/5 · **Spec**: ❌ falta

Partido con super tiebreak: se carga el STB y el mismo mensaje ("contame qué pasó") sigue apareciendo en vez de "¡Bien que ganaste!" o "¡Qué lástima!".

**Archivo clave**: `src/viewer/cargarResultado.js`

---

#### [MEJORA] Modal index.html — pareja del jugador siempre primero en listado `📋 PRIORIZADA`

**Score owner**: 4/5 · **Spec**: ❌ falta

Los partidos muestran las parejas en el orden de la BD. El jugador debería ver siempre "Yo vs Rival", no "Rival vs Yo".

**Archivo clave**: `src/viewer/modalConsulta.js`

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

#### [MEJORA] Seeding global — evitar cruces entre equipos del mismo grupo `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

Cuando el seeding es por tabla general (`modo:'global'`), los cruces actuales emparejan por ranking puro (1v4, 2v3). Esto puede generar cruces entre equipos del mismo grupo en primera ronda. Ejemplo real: con 2 grupos × 3 parejas, el cruce 1v4 enfrentó al 1° del Grupo A con el 2° del Grupo A, y el 2v3 enfrentó al 1° del Grupo B con el 2° del Grupo B — repitiendo partidos de fase de grupos.

Debería intentarse separar equipos del mismo grupo en primera ronda, manteniendo el seeding lo más fiel posible al ranking.

**Archivos clave**: `verificar_y_proponer_copas` (RPC), `src/admin/copas/bracketLogic.js`

---

#### [BUG] Propuestas de copa — swap (⇄) no permite cambiar cruces entre matches `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

Las flechas ⇄ en las propuestas de copa solo intercambian pareja_a ↔ pareja_b dentro del mismo match. No permiten mover equipos entre matches distintos. Si el seeding generó Semi 1: A vs B y Semi 2: C vs D, pero el admin quiere Semi 1: A vs D y Semi 2: C vs B, no hay forma de hacerlo desde la UI.

Relacionado con la mejora de seeding anti-mismo-grupo: si el seeding se corrige, este bug será menos frecuente pero sigue siendo necesario para ajustes manuales.

**Archivos clave**: `src/admin/copas/statusView.js`

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

#### [MEJORA] Admin Setup — UX del flujo de importación `💡 CRUDA`

**Score owner**: 1/5 · Botón Importar siempre habilitado, logs desaparecen al refresh.

---

## Historial — Implementado / Validado

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
