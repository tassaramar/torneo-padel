# Product Backlog — Torneo de Pádel

> **Fuente única de verdad** para ideas, requerimientos y evolución del producto.
> Detalles técnicos de arquitectura → ver `CLAUDE.md`

**Última actualización**: 2026-02-24

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

1. **Rediseño sistema de copas** — más flexible, menos intervención manual en el torneo
2. **Múltiples torneos** — historial entre torneos sin borrar la BD
3. *(libre — agregar próxima prioridad)*

---

## Backlog

### Rediseño sistema de copas `📋 PRIORIZADA`

**Plan de diseño**: [`docs/plan-reingenieria-copas.md`](plan-reingenieria-copas.md)

**Problema**: Sistema actual es ad hoc. Un botón por formato, poco flexible. En torneos reales muchas copas no se completan. Durante el torneo no hay tiempo para programar cruces. El ajuste manual de posiciones no alcanza.

**Objetivo**: Sistema flexible, inteligente y adaptable en tiempo real con mínima intervención manual del organizador.

**Preguntas clave**:
- ¿Cuáles son los formatos de copa más comunes que hay que soportar?
- ¿Cómo manejar automáticamente copas incompletas (ausencias, desistimientos)?
- ¿Qué información mínima necesita el organizador para generar cruces en tiempo real?
- ¿Se pueden sugerir cruces automáticos basados en posiciones de grupo?

---

### Múltiples torneos `🔍 EN ANÁLISIS`

**Problema**: Un único torneo activo. Al iniciar uno nuevo, se borra la BD y se pierde todo el historial.

**Objetivo**: Guardar historial de torneos anteriores, trabajar sobre torneos nuevos sin perder datos.

**Preguntas clave**:
- ¿Cómo selecciona el jugador en qué torneo está participando?
- ¿El historial de torneos anteriores es accesible desde la app o solo como backup?
- ¿Cómo afecta a la estructura de BD (foreign keys en partidos, grupos, parejas)?

**Dependencia**: Conviene resolver identificación de jugadores (ver Gestión de usuarios individuales) antes para que el historial sea útil por jugador.

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

## Historial — Implementado / Validado

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
