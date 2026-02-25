# Plan: Re-ingeniería del Sistema de Copas

> **Última actualización**: 2026-02-24
> **Estado**: `📋 PRIORIZADA` — listo para implementar
> **Plan canónico de implementación**: `C:\Users\Martin\.claude\plans\indexed-snuggling-llama.md`

---

## Contexto

El sistema de copas actual tiene 5 botones hardcodeados en admin.html, cada uno para un formato específico (4x3, 2x5). Solo soporta 2 formatos. El admin lo encuentra confuso y en el último torneo prefirió no usar copas.

**Objetivo**: Sistema flexible donde el admin define un "plan de copas" una vez, la app propone cruces automáticamente cuando los grupos terminan, y el admin revisa y aprueba antes de publicar.

---

## Hallazgos del Product Discovery

- El formato de copas varía por torneo (6-16 parejas, distintas combinaciones de grupos)
- El admin quiere definir el plan antes del torneo y que la app proponga cruces automáticamente
- El admin quiere **revisar y aprobar** los cruces antes de que sean visibles para todos
- Las copas deben poder arrancar incrementalmente (ej: Copa Oro empieza cuando 2 grupos terminan)
- Las copas bajas que no se juegan no molestan — no hace falta feature de "opcional"
- En 3 grupos: el ranking cruzado entre grupos determina quién va a qué copa (ej: "mejor segundo" va a Oro)
- En grupos desiguales (ej: 5+6): cruces hasta la posición del grupo más chico, el sobrante no juega
- Las copas hoy NO aparecen en fixture ni en vista del jugador — deberían aparecer
- Seeding ideal: mejor vs peor (bombo), pero el admin puede modificar la propuesta antes de aprobar
- El plan se puede editar hasta que se apruebe el primer partido de copa. Después, solo Reset.

---

## Flujo de trabajo

### Paso 1: Admin define el plan (manual, una vez)
El admin entra a admin.html → Copas. La app detecta el formato del torneo y sugiere un preset. El admin acepta o edita. El plan queda guardado.

### Paso 2: Motor propone cruces (automático, al confirmar resultados)
Cuando un resultado pasa a `confirmado` (ambas parejas de acuerdo), el motor evalúa si hay copas que se pueden generar. Si los grupos necesarios terminaron, genera una **propuesta** — no la publica todavía.

### Paso 3: Admin revisa y aprueba (manual)
El admin ve las propuestas en admin.html. Puede:
- **Aprobar** → los partidos se crean y son visibles para todos
- **Modificar cruces** → cambiar quién juega contra quién (swap) antes de aprobar
- **Esperar** → dejar la propuesta pendiente hasta tener más equipos (mejor seeding)

### Paso 4: Finales automáticas (sin aprobación)
Cuando las semis de una copa tienen resultado `confirmado`, el motor genera automáticamente la final + 3er puesto. Son determinísticos (ganador vs ganador, perdedor vs perdedor) — no requieren revisión.

### Bloqueo del plan
- El plan es editable libremente hasta que se apruebe el primer partido de copa
- Después, solo disponible "Reset" (borra todo lo generado, vuelve al plan editable)

---

## Catálogo de presets

### 2 grupos — Cruces directos

| Config | Parejas | Copas |
|--------|---------|-------|
| 2x3 | 6 | 3 cruces: Oro, Plata, Bronce |
| 2x4 | 8 | 4 cruces: Oro, Plata, Bronce, Madera |
| 2x5 | 10 | 5 cruces: Oro, Plata, Bronce, Cartón, Papel |
| 2x6 | 12 | 6 cruces directos |

**Grupos desiguales** (ej: 5+6): cruces hasta la posición del grupo más chico. El sobrante no juega copa.

### 3 grupos

| Config | Parejas | Copas | Detalle |
|--------|---------|-------|---------|
| 3x3 | 9 | 3 copas, bracket de 3 | N-ésimos de cada grupo. Bye al mejor, semi entre los otros 2 |
| 3x4 | 12 | 3 copas, bracket de 4 | Ranking cruzado (ver abajo) |

**3x4 — Ranking cruzado:**
- **Copa Oro**: 3 primeros + mejor 2do = 4 equipos → semis + final
- **Copa Plata**: 2 segundos restantes + 2 mejores 3ros = 4 → semis + final
- **Copa Bronce**: peor 3ro + 3 cuartos = 4 → semis + final

### 4 grupos — El caso más limpio

| Config | Parejas | Copas |
|--------|---------|-------|
| 4x3 | 12 | Oro (1os), Plata (2os), Bronce (3os) |
| 4x4 | 16 | Oro (1os), Plata (2os), Bronce (3os), Madera (4os) |

---

## Esquema de datos

### Nueva tabla `esquemas_copa` (el plan de copas)

```sql
CREATE TABLE public.esquemas_copa (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  torneo_id uuid NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  nombre text NOT NULL,           -- "Copa Oro", "Copa Plata", etc.
  orden integer NOT NULL DEFAULT 1,
  formato text NOT NULL DEFAULT 'bracket',  -- 'bracket' | 'direct'
  reglas jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(torneo_id, orden)
);
```

### Nueva tabla `propuestas_copa` (cruces pendientes de aprobación)

```sql
CREATE TABLE public.propuestas_copa (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  esquema_copa_id uuid NOT NULL REFERENCES public.esquemas_copa(id) ON DELETE CASCADE,
  ronda text NOT NULL,             -- 'SF', 'F', '3P', 'direct'
  pareja_a_id uuid REFERENCES public.parejas(id),
  pareja_b_id uuid REFERENCES public.parejas(id),
  orden integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'aprobado' | 'descartado'
  created_at timestamptz DEFAULT now()
);
```

### Formato de `reglas` (JSONB)

```jsonc
// Caso simple: "1os de cada grupo"
[{"posicion": 1}]

// Copa Oro en 3x4: "3 primeros + mejor 2do"
[{"posicion": 1}, {"posicion": 2, "cantidad": 1, "criterio": "mejor"}]

// Copa Plata en 3x4: "2 segundos restantes + 2 mejores terceros"
[{"posicion": 2, "cantidad": 2, "criterio": "peor"}, {"posicion": 3, "cantidad": 2, "criterio": "mejor"}]
```

### Alteración a `copas` existente

```sql
ALTER TABLE copas ADD COLUMN esquema_copa_id uuid REFERENCES esquemas_copa(id) ON DELETE SET NULL;
```

---

## UI — Tres estados en admin.html

### Estado 1: Plan (editando el esquema)

```
┌─────────────────────────────────────────┐
│ Plan de Copas                           │
│                                         │
│ [Copa Oro]    Semi+Final  1os de grupo  │
│ [Copa Plata]  Semi+Final  2os de grupo  │
│ [Copa Bronce] Semi+Final  3os de grupo  │
│                                         │
│ [+ Agregar copa]                        │
│                                         │
│ Preset sugerido: 4x3 (auto-detectado)  │
│                                         │
│ ℹ️ Los cruces se propondrán auto-      │
│    máticamente al confirmarse results.  │
└─────────────────────────────────────────┘
```

### Estado 2: Propuestas pendientes

```
┌─────────────────────────────────────────┐
│ Copas — Propuestas pendientes (2)       │
│                                         │
│ Copa Oro — 2 semis propuestas           │
│  Semi 1: Tincho-Max vs Gaby-Chino      │
│  Semi 2: Mauri-Diego vs Gaston-Lean    │
│  [✏️ Modificar]  [✅ Aprobar]          │
│                                         │
│ Copa Plata ⏳ Esperando Grupo C...      │
│ Copa Bronce ⏳ Esperando Grupos C, D...│
│                                         │
│ [Proponer ahora]  [Reset]              │
└─────────────────────────────────────────┘
```

### Estado 3: En curso

```
┌─────────────────────────────────────────┐
│ Copas — En curso                        │
│                                         │
│ Copa Oro ✅                             │
│  Semi 1: Tincho-Max vs Gaby-Chino (6-4)│
│  Semi 2: Mauri-Diego vs Gaston (pend.) │
│  → Final se genera al completar        │
│                                         │
│ Copa Plata — Propuesta pendiente        │
│  Semi 1: [propuesta]  [✅ Aprobar]     │
│                                         │
│ [Reset]                                 │
└─────────────────────────────────────────┘
```

---

## Motor de propuestas — Algoritmo

```
verificar_y_proponer_copas(torneo_id):
  1. Cargar esquemas_copa del torneo
  2. Si no hay esquemas → return (sin plan definido)
  3. Para cada esquema:
     a. Evaluar reglas → determinar qué grupos necesita
     b. Verificar cuáles grupos tienen todos sus partidos en `confirmado`
     c. Obtener equipos elegibles por ranking cruzado
     d. Si no hay suficientes equipos → skip
     e. Si ya hay propuestas/partidos para esta copa+ronda → skip (idempotencia)
     f. Generar PROPUESTAS (no partidos) con seeding bombo
  4. Para copas con partidos en curso:
     a. Si semis en `confirmado` y no existe final → CREAR final + 3er puesto directamente
```

**Seeding**: Con 4 equipos → bombo (mejor vs peor). Con 2 equipos → cruce directo.
**Idempotencia**: Múltiples ejecuciones no duplican propuestas.
**Trigger**: Se invoca cuando `partidos.estado` cambia a `confirmado`. También disponible "Proponer ahora" desde admin.

---

## Plan de implementación — 6 fases con testing incremental

| Fase | Qué | Verificación |
|------|-----|-------------|
| 1 | Migración BD (tablas + RLS + función RPC) | Tablas visibles en Supabase, RLS correcto |
| 2 | Módulos JS (`bracketLogic`, `tablaGrupoDB`, `presets`, `planService`) | `npm run build` pasa |
| 3 | Nueva UI admin (editor + propuestas + estado) | Flujo manual en admin.html |
| 4 | Motor de propuestas + aprobación + finales auto | Flujo completo con datos reales |
| 5 | Integración en vistas (fixture, index, modal) | Copas visibles para jugadores |
| 6 | Cleanup (legacy code + backlog) | `npm run build` + smoke test |

**Archivos a crear**: `esquemas_copa` migration, `src/admin/copas/{presets,planService,planEditor,generationEngine,statusView,bracketLogic}.js`, `src/utils/tablaGrupoDB.js`
**Archivos a modificar**: `src/admin/copas/index.js` (reescribir), `admin.html`, `src/fixture.js`, `src/viewer/vistaPersonal.js`, `src/viewer/modalConsulta.js`
