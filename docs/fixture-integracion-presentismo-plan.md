# Plan: Integración Fixture + Presentismo + Numeración Dinámica

**Fecha de análisis:** 2026-02-10
**Status:** Plan aprobado, pendiente implementación

---

## Contexto

Análisis funcional realizado para integrar presentismo en fixture.html y mejorar numeración de partidos.

**Usuarios del sistema:**
- **Tipo A:** Admin (organizador principal)
- **Tipo B:** Ayudante del Admin
- **Tipo C:** Usuarios/Jugadores

**Objetivo:** Torneo fluido con UX super simple para tipo C, y lo más simple posible para tipo A/B.

---

## Decisiones Arquitectónicas Confirmadas

### 1. Mantener 2 Vistas Especializadas ✅

**Vista 1: Home Único** (`index.html`)
- **Target:** Jugadores tipo C
- **Foco:** "Mi torneo, mis partidos"
- **Presentismo:** Bloquea partidos si falta compañero
- **Funciones de estado:** NO
- **Complejidad:** Muy baja

**Vista 2: Fixture Organizador** (`fixture.html`)
- **Target:** Admin/Ayudante tipo A/B
- **Foco:** "Gestión operativa del torneo"
- **Presentismo:** Visualización (no bloquea)
- **Funciones de estado:** SÍ (Marcar en juego/Finalizar)
- **Complejidad:** Media (aceptable para ellos)

**Razón:** Separación clara de concerns, sin agregar complejidad innecesaria (no roles/permisos).

---

### 2. NO Agregar Funciones de fixture.html a index.html ✅

**Funciones evaluadas:**

| Función | ¿Agregar a index.html? | Razón |
|---------|------------------------|-------|
| Ver partidos "En juego" | ❌ NO | Estado best effort → no confiable, puede confundir |
| Buscador "Cuándo juega mi amigo" | ❌ NO | No es foco del jugador tipo C |
| Funciones de estado | ❌ NO | Solo para organizador |
| Numeración de partidos | ✅ SÍ (mejora) | Ver punto 3 |

**Decisión:** Mantener index.html simple, enfocado en "mis partidos".

---

### 3. 🔥 Numeración Dinámica de Partidos (NUEVA FEATURE)

#### Problema Actual

Numeración fija no refleja cuántos partidos REALMENTE faltan adelante del jugador.

**Ejemplo del problema:**
```
Torneo con 10 partidos:
- Partidos #1, #2, #3: finalizados (con resultado)
- Partidos #4, #5: en juego
- Mi partido: #6

Numeración actual: Muestra "#6"
Problema: Parece que faltan 5 partidos, pero en realidad soy el PRÓXIMO
```

#### Solución Propuesta

**Numeración dinámica:** Excluir finalizados y en juego, renumerar lo que FALTA.

**Ejemplo mejorado:**
```
Mismo escenario:
- #1, #2, #3: finalizados (NO se cuentan)
- #4, #5: en juego (NO se cuentan)
- Mi partido: ahora es #1 (¡soy el próximo!)

Numeración nueva: Muestra "#1"
Beneficio: Info útil → sé que soy el próximo partido real
```

#### Casos de Uso

**Caso A: Jugador llega al club**
- Ve "#1" → Soy el próximo, me preparo
- Ve "#5" → Faltan 4 partidos, tengo ~30-40 min

**Caso B: Admin decide próximo partido**
- Ve cola: #1, #2, #3... (solo pendientes reales)
- Decisión rápida: "Arranca el #1"

#### Implementación Técnica

**Archivo:** `src/utils/colaFixture.js`

**Opción A: Modificar `calcularColaSugerida()` existente**
```javascript
export function calcularColaSugerida(partidos, grupos) {
  // CAMBIO: Filtrar solo pendientes reales
  const pendientes = partidos.filter(p =>
    esPartidoPendiente(p) // ya existe, verifica estado pendiente
  );

  // Resto de lógica igual (ordenar por ronda/grupo)
  // ...

  return cola; // Cola solo con pendientes, posiciones 1, 2, 3...
}
```

**Nota:** La función `esPartidoPendiente()` ya existe y excluye:
- Partidos con resultado cargado
- Partidos en estado `en_juego`
- Partidos en estado `terminado`

**Verificar que la función actual ya hace lo correcto:**
```javascript
// src/utils/colaFixture.js línea 18
export function esPartidoPendiente(partido) {
  return !esPartidoFinalizado(partido) &&
         partido.estado !== 'en_juego' &&
         partido.estado !== 'terminado';
}
```

✅ **La lógica ya existe!** Solo hay que verificar que se usa consistentemente.

#### Impacto

**Archivos afectados:**
- ✅ `src/utils/colaFixture.js` - Ya tiene lógica correcta
- ✅ `src/viewer/vistaPersonal.js` - Ya usa `calcularColaSugerida()`
- ❌ `src/fixture.js` - Tiene COPIA DUPLICADA (ver problema P1)

**Prioridad:** ALTA (parte del refactor de fixture.js)

**Beneficio:**
- Jugador tipo C: Info útil (cuántos partidos realmente faltan)
- Admin tipo A/B: Vista clara de cola real pendiente

---

### 4. Integración de Presentismo en fixture.html

#### Badge de Presentismo (Mobile-First)

**Formato elegido:** Badge expandible con tap/click

⚠️ **Consideración crítica:** App debe funcionar 100% desde celular. NO usar hover (no existe en mobile).

**Visual - Estado Colapsado (default):**
```
┌───────────────────────────────────────┐
│ #3  Grupo A · Ronda 1  [✅ 2/2] ▼     │ ← Tap para expandir
│ Ana-Lu vs Sofi-Caro                   │
│ [▶ En juego]                          │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│ #9  Grupo B · Ronda 2  [⚠️ 1/2] ▼     │ ← Advertencia
│ Nico-Fede vs Santi-Mati               │
│ [▶ En juego]                          │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│ #12 Grupo C · Ronda 1  [❌ 0/2] ▼     │ ← Bloqueado
│ Marcos-Leo vs Gaby-Flor               │
│ [▶ En juego] (deshabilitado)          │
└───────────────────────────────────────┘
```

**Visual - Estado Expandido (después de tap):**
```
┌───────────────────────────────────────┐
│ #3  Grupo A · Ronda 1  [✅ 2/2] ▲     │ ← Tap para colapsar
│ Ana-Lu vs Sofi-Caro                   │
│ ✅ Presentes: Ana, Lu, Sofi, Caro     │ ← Info expandida
│ [▶ En juego]                          │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│ #9  Grupo B · Ronda 2  [⚠️ 1/2] ▲     │
│ Nico-Fede vs Santi-Mati               │
│ ✅ Presentes: Nico, Fede              │ ← Detalles útiles
│ ❌ Faltan: Santi, Mati                │
│ [▶ En juego]                          │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│ #12 Grupo C · Ronda 1  [❌ 0/2] ▲     │
│ Marcos-Leo vs Gaby-Flor               │
│ ❌ Faltan: Marcos, Leo, Gaby, Flor    │ ← Lista de quiénes faltan
│ [▶ En juego] (deshabilitado)          │
└───────────────────────────────────────┘
```

**Comportamiento:**
- **Mobile:** Tap en badge o en ▼/▲ para expandir/colapsar
- **Desktop:** Click funciona igual (no requiere hover)
- **Teclado:** Enter/Space para expandir/colapsar (accesibilidad)
- **Estado:** Cada partido mantiene su estado independientemente

**Implementación:**
```javascript
// Estado expandido por partido (en memoria)
const expandedPartidos = new Set(); // Set de IDs de partidos expandidos

function togglePresentismoInfo(partidoId) {
  if (expandedPartidos.has(partidoId)) {
    expandedPartidos.delete(partidoId);
  } else {
    expandedPartidos.add(partidoId);
  }
  renderPartido(partidoId); // Re-render solo ese partido
}
```

**Leyenda:**
- `✅ 2/2` = Ambas parejas completas (4/4 jugadores presentes)
- `⚠️ 1/2` = Una pareja completa (2/4 jugadores presentes)
- `❌ 0/2` = Ninguna pareja completa (0/4 jugadores presentes)
- `▼` = Info colapsada (tap para ver detalles)
- `▲` = Info expandida (tap para ocultar)

#### Filtro en fixture.html

**Único filtro necesario:**
```
☑️ Solo mostrar parejas completas [✅ 2/2]
```

**Razón:**
- Filtro "Solo incompletas" NO tiene sentido (partidos que no se pueden jugar)
- Lista de PAREJAS incompletas va en OTRA vista (Admin Presentismo)

**Uso:**
- Admin al inicio: activa filtro → ve solo lo que puede arrancar
- Admin después: desactiva filtro → ve todo

#### Funciones Requeridas

**Nuevas funciones en `src/utils/presentismo.js` o directamente en `fixture.js`:**

```javascript
/**
 * Verifica si ambas parejas de un partido están completas
 * @param {string} parejaAId - ID de pareja A
 * @param {string} parejaBId - ID de pareja B
 * @param {Map} parejasMap - Mapa de pareja_id -> data (incluye campo presentes)
 * @returns {Object} { completo: boolean, parejaA: '2/2'|'1/2'|'0/2', parejaB: '2/2'|'1/2'|'0/2' }
 */
function verificarPresentismoPartido(parejaAId, parejaBId, parejasMap) {
  const parejaA = parejasMap.get(parejaAId);
  const parejaB = parejasMap.get(parejaBId);

  const presentesA = parejaA?.presentes || [];
  const presentesB = parejaB?.presentes || [];

  // Asumimos que cada pareja tiene 2 jugadores
  const ratioA = `${presentesA.length}/2`;
  const ratioB = `${presentesB.length}/2`;

  const completo = presentesA.length === 2 && presentesB.length === 2;

  return { completo, parejaA: ratioA, parejaB: ratioB };
}

/**
 * Genera badge visual para un partido
 */
function generarBadgePresentismo(parejaA, parejaB) {
  const totalPresentes =
    parseInt(parejaA.split('/')[0]) + parseInt(parejaB.split('/')[0]);

  if (totalPresentes === 4) {
    return { icono: '✅', texto: '2/2', color: 'green', completo: true };
  } else if (totalPresentes >= 2) {
    return { icono: '⚠️', texto: '1/2', color: 'orange', completo: false };
  } else {
    return { icono: '❌', texto: '0/2', color: 'red', completo: false };
  }
}
```

#### Datos Necesarios

**Query Supabase en `fixture.js`:**

Agregar campo `presentes` al SELECT de parejas:

```javascript
const { data: parejas } = await supabase
  .from('parejas')
  .select('id, nombre, orden, presentes') // ← Agregar presentes
  .eq('torneo_id', TORNEO_ID)
  .order('orden');
```

---

### 5. Lista de Parejas Incompletas (Futura - Admin Presentismo)

**Decisión:** NO va en fixture.html, va en pantalla separada **Admin Presentismo** (`presente.html`)

**Razón:**
- Fixture muestra PARTIDOS (unidad = partido)
- Lista de parejas es otra vista (unidad = pareja)
- Admin Presentismo es el lugar correcto

**Mockup:**
```
presente.html
┌─────────────────────────────────────┐
│ 👥 Gestión de Presentismo           │
│                                     │
│ ✅ PAREJAS COMPLETAS (8)            │
│ ┌─────────────────────────────────┐│
│ │ Tincho-Max         [2/2] ✅      ││
│ │ Ana-Lu             [2/2] ✅      ││
│ │ Sofi-Caro          [2/2] ✅      ││
│ │ ...                              ││
│ └─────────────────────────────────┘│
│                                     │
│ ⚠️ PAREJAS INCOMPLETAS (3)          │
│ ┌─────────────────────────────────┐│
│ │ Nico-Fede          [1/2] ⚠️      ││
│ │   Presentes: Nico                ││
│ │   Faltan: Fede                   ││
│ │                                  ││
│ │ Marcos-Leo         [0/2] ❌      ││
│ │   Faltan: Marcos, Leo            ││
│ │                                  ││
│ │ Pedro-Juan         [1/2] ⚠️      ││
│ │   Presentes: Pedro               ││
│ │   Faltan: Juan                   ││
│ └─────────────────────────────────┘│
│                                     │
│ [Marcar todos presentes]            │
│ [Resetear presentismo]              │
└─────────────────────────────────────┘
```

**Funcionalidad:**
- Ver qué parejas están completas/incompletas de un vistazo
- Marcar/desmarcar presencia por jugador individual
- Botones bulk: "Todos presentes" / "Resetear"
- Buscador por nombre de jugador o pareja

**Prioridad:** Media (parte de tarea "Pantalla Admin Presentismo")

**Documentar para implementar más adelante:** ✅

---

## Resumen de Tareas Generadas

### Alta Prioridad

#### T1: Refactor fixture.js - Eliminar duplicación
**Problema:** fixture.js tiene copias de funciones de utils/colaFixture.js
**Solución:** Importar funciones compartidas
**Archivos:** `src/fixture.js`, `src/utils/colaFixture.js`
**Status:** Pendiente (deuda técnica crítica)

#### T2: Integrar Presentismo en fixture.html
**Objetivo:** Admin puede ver estado de presentismo y filtrar
**Componentes:**
- Badge expandible `[✅ 2/2] ▼` en cada partido (mobile-first)
- Tap/click para expandir y ver detalles (nombres presentes/faltan)
- Filtro "Solo parejas completas"
- Query de campo `presentes` desde BD

**⚠️ Crítico:** NO usar hover tooltip (no funciona en mobile). Badge debe ser expandible con tap.

**Archivos:** `src/fixture.js`
**Dependencias:** T1 (refactor primero para evitar duplicar código)
**Status:** Pendiente

#### T3: Verificar Numeración Dinámica
**Objetivo:** Confirmar que numeración ya es dinámica (excluye finalizados/en juego)
**Verificación:**
- Revisar que `calcularColaSugerida()` usa `esPartidoPendiente()` correctamente
- Confirmar que fixture.js (después de refactor T1) usa misma lógica
- Testing: verificar que #1, #2, #3... solo incluyen pendientes reales

**Archivos:** `src/utils/colaFixture.js`, `src/fixture.js` (post-refactor)
**Status:** Pendiente verificación

### Media Prioridad

#### T4: Pantalla Admin Presentismo (`presente.html`)
**Objetivo:** Vista completa de gestión de presentismo
**Componentes:**
- Lista de parejas completas
- Lista de parejas incompletas (con nombres de quiénes faltan)
- Acciones: Marcar/desmarcar individual, bulk actions
- Buscador por jugador/pareja

**Archivos:** Nuevos: `presente.html`, `src/admin/presente.js`
**Status:** Documentado, pendiente implementación

---

## Criterios de Aceptación

### Para T2 (Integración Presentismo)

**Dado** que soy Admin y abro fixture.html en mobile o desktop
**Cuando** veo la cola de partidos
**Entonces** cada partido muestra badge colapsado `[✅ 2/2] ▼`, `[⚠️ 1/2] ▼` o `[❌ 0/2] ▼`

**Dado** que hago tap/click en un badge
**Entonces** el badge se expande mostrando: "✅ Presentes: X, Y" y "❌ Faltan: Z, W"
**Y** el icono cambia a `▲`

**Dado** que hago tap/click nuevamente en el badge expandido
**Entonces** el badge se colapsa ocultando los detalles
**Y** el icono vuelve a `▼`

**Dado** que activo filtro "Solo parejas completas"
**Entonces** solo veo partidos con badge `[✅ 2/2]`

**Dado** que hay 3 partidos en cola pero 2 tienen parejas incompletas
**Entonces** con filtro activo solo veo 1 partido

**Dado** que estoy en mobile (sin hover disponible)
**Entonces** el badge expandible funciona perfectamente con tap
**Y** no requiero hover para ver información

### Para T3 (Numeración Dinámica)

**Dado** que hay 10 partidos en el torneo
**Y** 3 están finalizados (con resultado)
**Y** 2 están en juego
**Cuando** veo la cola de pendientes
**Entonces** el primer partido pendiente real se numera como #1 (no #6)

**Dado** que soy jugador y mi partido era #7
**Y** se finalizaron 4 partidos y hay 2 en juego
**Cuando** refresco mi vista personal
**Entonces** mi partido ahora es #1 (soy el próximo)

---

## Notas de Implementación

### Orden de Implementación Sugerido

1. **T1 (Refactor):** Eliminar duplicación en fixture.js
2. **T3 (Verificación):** Confirmar numeración dinámica funciona
3. **T2 (Presentismo):** Integrar presentismo en fixture.html
4. **T4 (Admin Presentismo):** Implementar presente.html (puede ser después)

### Consideraciones Técnicas

**Presentismo en BD:**
- Campo `presentes TEXT[]` ya existe en tabla `parejas`
- Funciones en `src/viewer/presentismo.js` ya están implementadas
- Solo falta consumirlas desde fixture.js

**Numeración:**
- Lógica correcta ya existe en `esPartidoPendiente()`
- Solo verificar que se usa consistentemente post-refactor

**Performance:**
- Query de parejas con campo `presentes` no agrega overhead significativo
- Filtrado de partidos es en memoria (arrays pequeños <100 partidos)

---

## Referencias

- Plan principal: `C:\Users\Martin\.claude\plans\purrfect-herding-aurora.md`
- Problema duplicación: P1 en plan principal
- Implementación presentismo: `docs/implementacion-home-unico.md`
- Migraciones BD: `supabase/migrations/20260130010000_add_presentes_to_parejas.sql`
