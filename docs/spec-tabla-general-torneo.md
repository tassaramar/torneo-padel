# Spec: Tabla general del torneo

**Estado**: 📋 PRIORIZADA
**Prioridad**: Tier 2
**Ítem del backlog**: "Tabla general del torneo"

---

## Contexto

### Pregunta del usuario que resuelve

> "¿Cómo estamos comparados con los de otros grupos?" — El jugador puede ver su grupo y otros grupos por separado, pero no tiene forma de saber si su pareja es la mejor primera del torneo, o cómo se compara con parejas de otros grupos.

Hoy los jugadores solo pueden ver la tabla de posiciones de su propio grupo o de otro grupo individual. No existe ninguna vista que muestre una clasificación unificada de **todas las parejas del torneo** en un solo ranking.

Esta feature es especialmente útil cuando el torneo tiene múltiples grupos y las parejas quieren saber cómo están posicionadas globalmente (quién es el mejor primero del torneo, quién es el mejor segundo, etc.).

La infraestructura de BD ya está lista: el RPC `obtener_standings_torneo` existe en la migración `20260225000000_add_esquemas_copa.sql`.

---

## Criterio de ordenamiento

Ordenar primero por **posición dentro del grupo**, desempatar por métricas.

Justificación: Preserva el valor de "quedar primero en tu grupo". Un primero de grupo mediocre (en puntos) no debería quedar detrás de un segundo de grupo brillante.

```
Orden final:
  1. posicion_en_grupo ASC (1ro > 2do > 3ro...)
  2. puntos DESC (dentro de misma posición)
  3. ds DESC (diferencia de sets)
  4. gf DESC (games a favor)
  5. nombre de pareja ASC (último desempate)
```

### Aviso "Tabla provisional"

Si algún grupo aún no terminó todos sus partidos (`grupo_completo: false` en la respuesta del RPC), la tabla muestra un aviso:

> ⚠️ Tabla provisional — quedan partidos por jugar en el Grupo [X]

---

## Qué devuelve el RPC

`obtener_standings_torneo(p_torneo_id)` devuelve filas con:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `grupo_id` | UUID | ID del grupo |
| `pareja_id` | UUID | ID de la pareja |
| `puntos` | int | Puntos acumulados |
| `ds` | int | Diferencia de sets |
| `gf` | int | Games a favor |
| `posicion_en_grupo` | int | Posición dentro del grupo (1, 2, 3...) |
| `grupo_completo` | bool | True si todos los partidos del grupo están confirmados |

El RPC no devuelve `nombre de pareja` ni `nombre de grupo` — hay que obtenerlos desde los arrays de `parejas` y `grupos` ya cargados en el cache del modal.

---

## Dónde se muestra

**Ubicación primaria**: Sub-tab **"General"** dentro del tab "Grupos" del modal de `index.html`.

La nueva estructura de tabs del modal (definida en Doc 1) es:

```
[Grupos]                    [Copas]         [Fixture]
  [Grupo A] [Grupo B] [Grupo C] [General]   ← sub-tabs dentro de Grupos
```

"General" es el último sub-tab, después de todos los grupos individuales.

**Ubicación secundaria** (menos prioritaria, implementar después si hay tiempo): Sección en `analytics.html`.

---

## Diseño de la tabla

```
⚠️ Tabla provisional — quedan partidos en el Grupo B        (si aplica)

#   Pareja           Grupo   Pos.    Pts   DS   GF
─────────────────────────────────────────────────────
1   Tincho-Max       A       1°       6   +4   18    ← resaltado si es mi pareja
2   Pedro-Lucho      B       1°       6   +2   16
3   Nico-Fede        C       1°       5   +1   14
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
4   Gaby-Santi       A       2°       5   +3   17
5   Rafa-Javi        B       2°       4    0   15
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
```

- Separador visual entre bloques de distinta posición (ej. línea punteada entre "todos los primeros" y "todos los segundos")
- La pareja del jugador identificado aparece resaltada en verde (igual que en las otras tablas)
- Columna `DS`: mostrar con signo (`+4`, `-2`, `0`)

**Mobile-first**: La tabla debe ser scrollable horizontalmente en mobile si no cabe. Columnas mínimas visibles sin scroll: `#`, `Pareja`, `Pos.`, `Pts`.

---

## Cambios técnicos

### 1. `src/viewer/modalConsulta.js`

**En `cargarDatosModal()`**: Agregar llamada al RPC en paralelo con las otras queries:

```javascript
const [gruposRes, partidosRes, parejasRes, standingsRes] = await Promise.all([
  // ... queries existentes ...
  supabase.rpc('obtener_standings_torneo', { p_torneo_id: torneoId })
]);

modalState.cache = {
  // ... campos existentes ...
  standings: standingsRes.data || []
};
```

**Agregar tab en el HTML del modal** (en la función que genera el HTML de tabs):

```html
<button class="tab-btn" data-tab="general">Tabla General</button>
```

**Crear función `renderTablaGeneral(container)`**:

```javascript
function renderTablaGeneral(container) {
  const { cache, identidad } = modalState;
  const standings = cache.standings || [];

  if (standings.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay datos de tabla general disponibles.</p>';
    return;
  }

  // Enriquecer standings con nombre de pareja y nombre de grupo
  const parejasMap = Object.fromEntries((cache.parejas || []).map(p => [p.id, p.nombre]));
  const gruposMap = Object.fromEntries((cache.grupos || []).map(g => [g.id, g.nombre || g.letra || `Grupo ${g.orden}`]));

  const enriched = standings.map(s => ({
    ...s,
    parejaNombre: parejasMap[s.pareja_id] || '—',
    grupoNombre: gruposMap[s.grupo_id] || '—'
  }));

  // Verificar si algún grupo no está completo
  const hayGruposIncompletos = standings.some(s => !s.grupo_completo);
  const gruposIncompletos = [...new Set(standings.filter(s => !s.grupo_completo).map(s => gruposMap[s.grupo_id]))];

  // Ordenar: posicion_en_grupo ASC, puntos DESC, ds DESC, gf DESC
  enriched.sort((a, b) =>
    a.posicion_en_grupo - b.posicion_en_grupo ||
    b.puntos - a.puntos ||
    b.ds - a.ds ||
    b.gf - a.gf ||
    a.parejaNombre.localeCompare(b.parejaNombre)
  );

  // Renderizar tabla con separadores entre bloques de posición
  // ...
}
```

### 2. `src/utils/tablaPosiciones.js` (opcional)

Si la función de ordenamiento `ordenarStandingsGlobal()` se necesita en más de un lugar (ej. analytics), moverla aquí. Si solo la usa `modalConsulta.js`, dejarla inline.

### 3. Listener del sub-tab

En el handler de sub-tabs del tab "Grupos", agregar el case para `'general'`:

```javascript
case 'general':
  renderTablaGeneral(content);
  break;
```

---

## Criterios de aceptación

- [ ] El tab "Grupos" del modal tiene sub-tab "General" como último sub-tab
- [ ] La tabla muestra todas las parejas del torneo con columnas: #, Pareja, Grupo, Pos. Grupo, Pts, DS, GF
- [ ] Ordenado: primero todos los 1ros (ordenados por Pts/DS/GF entre sí), luego todos los 2dos, etc.
- [ ] La pareja del jugador identificado está resaltada en verde
- [ ] Si hay grupos incompletos: se muestra aviso "⚠️ Tabla provisional — quedan partidos en Grupo [X]"
- [ ] Separadores visuales entre bloques de diferente posición de grupo
- [ ] Columna DS con signo (`+4`, `-2`, `0`)
- [ ] Funciona en mobile (tabla scrollable horizontal)
- [ ] `npm run build` sin errores nuevos

---

## Archivos a modificar

- `src/viewer/modalConsulta.js` — query (cargarDatosModal), HTML de tabs, función renderTablaGeneral, handler de tabs
- Opcionalmente: `src/utils/tablaPosiciones.js` — función `ordenarStandingsGlobal()`
