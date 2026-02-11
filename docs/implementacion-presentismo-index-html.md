# Implementación de Presentismo Visual en index.html

**Fecha:** 2026-02-10
**Status:** Especificación aprobada
**Documento base:** [fixture-presentismo-visual.md](fixture-presentismo-visual.md)

---

## Contexto

Integrar badges de presentismo en la vista del jugador (`index.html`) para mostrar visualmente el estado de presencia en cada partido.

**Filosofía clave**: **Guiar, no bloquear**. La app asume que puede tener información incompleta o errónea.

---

## Ubicaciones de Integración

### 1. "Mis Partidos Pendientes" (Home principal)

**Vista**: Bloque principal de `index.html` donde el jugador ve sus partidos

**Propósito**: Informar al jugador si todos están presentes para SUS partidos

**Ejemplo visual**:
```
┌────────────────────────────────────────┐
│ MIS PARTIDOS PENDIENTES                │
├────────────────────────────────────────┤
│ [✅] #3  Grupo A · Ronda 1             │
│ Nico-Fede vs Santi-Mati                │ ← Todos VERDE
│ [Cargar resultado]                     │ ← Directo
├────────────────────────────────────────┤
│ [⚠️] #9  Grupo B · Ronda 2             │
│ Nico-Fede vs Santi-Mati                │ ← Fede y Mati GRIS
│ [Cargar resultado]                     │ ← Con confirmación
└────────────────────────────────────────┘
```

### 2. Modal "Fixture" (Tab dentro del modal de consulta)

**Vista**: Tab "Fixture" en el modal que se abre con botón "Tablas/Grupos"

**Propósito**: Ver el estado de todos los partidos de la cola (no solo los míos)

**Ejemplo visual**:
```
Modal: Tablas / Grupos
┌────────────────────────────────────────┐
│ [Mi Grupo] [Otros Grupos] [Fixture]    │ ← Tabs
├────────────────────────────────────────┤
│ FIXTURE - COLA DE JUEGO                │
│                                        │
│ [✅] #1  Grupo A · Ronda 1             │
│ Ana-Lu vs Sofi-Caro                    │
│                                        │
│ [⚠️] #2  Grupo B · Ronda 1             │
│ Marcos-Leo vs Gaby-Flor                │
│                                        │
│ [✅] #3  Grupo A · Ronda 1             │
│ Nico-Fede vs Santi-Mati                │
└────────────────────────────────────────┘
```

---

## Archivos a Modificar

| Archivo | Tipo de cambio | Propósito |
|---------|---------------|-----------|
| `src/viewer/vistaPersonal.js` | Modificar | Agregar badges y validación en "Mis Partidos" |
| `src/viewer/modalConsulta.js` | Modificar | Agregar badges en tab "Fixture" del modal |
| `src/viewer/presentismo.js` | Agregar funciones | Lógica de auto-corrección |
| `style.css` | Agregar estilos | Clases de badge y colores |

---

## Implementación Técnica

### Paso 1: Crear Función Compartida

**Archivo**: `src/viewer/presentismo.js`

Agregar función `calcularEstadoVisualPartido()` (reutilizar de documento visual):

```javascript
/**
 * Calcula estado visual de un partido según presentismo individual
 * @param {Object} partido - Partido con pareja_a_id y pareja_b_id
 * @param {Map} parejasMap - Mapa de pareja_id -> data (incluye campo presentes)
 * @returns {Object} Estado visual con jugadores, badge, y lista de ausentes
 */
export function calcularEstadoVisualPartido(partido, parejasMap) {
  const parejaA = parejasMap.get(partido.pareja_a_id);
  const parejaB = parejasMap.get(partido.pareja_b_id);

  if (!parejaA || !parejaB) {
    console.warn('Pareja no encontrada para partido', partido.id);
    return null;
  }

  // Parsear nombres individuales (formato: "Nico-Fede")
  const [jugadorA1, jugadorA2] = parejaA.nombre.split('-').map(n => n.trim());
  const [jugadorB1, jugadorB2] = parejaB.nombre.split('-').map(n => n.trim());

  // Verificar presencia individual
  const presentesA = parejaA.presentes || [];
  const presentesB = parejaB.presentes || [];

  const jugadores = [
    { nombre: jugadorA1, presente: presentesA.includes(jugadorA1), pareja: 'A', parejaId: parejaA.id },
    { nombre: jugadorA2, presente: presentesA.includes(jugadorA2), pareja: 'A', parejaId: parejaA.id },
    { nombre: jugadorB1, presente: presentesB.includes(jugadorB1), pareja: 'B', parejaId: parejaB.id },
    { nombre: jugadorB2, presente: presentesB.includes(jugadorB2), pareja: 'B', parejaId: parejaB.id }
  ];

  const totalPresentes = jugadores.filter(j => j.presente).length;
  const todosPresentes = totalPresentes === 4;
  const ausentes = jugadores.filter(j => !j.presente);

  return {
    jugadores,
    totalPresentes,
    todosPresentes,
    ausentes,
    badge: {
      icono: todosPresentes ? '✅' : '⚠️',
      clase: todosPresentes ? 'todos-presentes' : 'info-incompleta'
    }
  };
}

/**
 * Marca jugadores como presentes cuando el usuario confirma la acción
 * Auto-corrección de presencia
 */
export async function marcarJugadoresComoPresentesAutomaticamente(partido, nombresAusentes, parejasMap) {
  const parejaA = parejasMap.get(partido.pareja_a_id);
  const parejaB = parejasMap.get(partido.pareja_b_id);

  const [jugadorA1, jugadorA2] = parejaA.nombre.split('-').map(n => n.trim());
  const [jugadorB1, jugadorB2] = parejaB.nombre.split('-').map(n => n.trim());

  // Actualizar pareja A si tiene ausentes
  if (nombresAusentes.includes(jugadorA1) || nombresAusentes.includes(jugadorA2)) {
    await marcarAmbosPresentes(parejaA.id, jugadorA1, jugadorA2);
  }

  // Actualizar pareja B si tiene ausentes
  if (nombresAusentes.includes(jugadorB1) || nombresAusentes.includes(jugadorB2)) {
    await marcarAmbosPresentes(parejaB.id, jugadorB1, jugadorB2);
  }
}
```

### Paso 2: Función de Validación con Confirmación

**Archivo**: `src/viewer/vistaPersonal.js`

```javascript
import { calcularEstadoVisualPartido, marcarJugadoresComoPresentesAutomaticamente } from './presentismo.js';

/**
 * Maneja carga de resultado con validación de presentismo
 * Guía al usuario pero NO bloquea
 */
async function cargarResultadoConValidacion(partidoId) {
  const partido = obtenerPartido(partidoId);
  const estadoVisual = calcularEstadoVisualPartido(partido, window.parejasMap);

  // Si todos presentes, cargar directamente
  if (estadoVisual.todosPresentes) {
    return abrirModalCargarResultado(partidoId);
  }

  // Si faltan jugadores, mostrar confirmación
  const ausentes = estadoVisual.ausentes.map(j => j.nombre);
  const mensaje = ausentes.length === 1
    ? `Me figura que ${ausentes[0]} está ausente.`
    : ausentes.length === 2
    ? `Me figura que ${ausentes[0]} y ${ausentes[1]} están ausentes.`
    : `Me figura que ${ausentes.slice(0, -1).join(', ')} y ${ausentes.slice(-1)} están ausentes.`;

  const confirmado = await mostrarDialogoConfirmacion({
    titulo: '¿Estás seguro?',
    mensaje: mensaje,
    detalle: '¿Estás seguro que querés cargar el resultado de este partido?',
    nota: '💡 Si cargás el resultado, los marcaré como presentes automáticamente.',
    botones: {
      cancelar: 'No, volver',
      confirmar: 'Sí, cargar resultado'
    }
  });

  if (!confirmado) return;

  // Auto-corrección: marcar ausentes como presentes
  await marcarJugadoresComoPresentesAutomaticamente(partido, ausentes, window.parejasMap);

  // Mostrar toast
  const nombreAusentes = ausentes.join(', ');
  mostrarToast(`✅ Marcados como presentes: ${nombreAusentes}`);

  // Recargar vista para actualizar colores
  await cargarVistaPersonal();

  // Proceder con carga de resultado
  return abrirModalCargarResultado(partidoId);
}

/**
 * Muestra diálogo de confirmación
 * Reutiliza el sistema de modales existente o crea uno nuevo
 */
async function mostrarDialogoConfirmacion({ titulo, mensaje, detalle, nota, botones }) {
  return new Promise((resolve) => {
    // Crear modal de confirmación
    const modalHtml = `
      <div class="modal-overlay" id="modal-confirmacion">
        <div class="modal-content modal-confirmacion">
          <h2>${titulo}</h2>
          <div class="modal-body">
            <p class="mensaje-principal">${mensaje}</p>
            <p class="detalle">${detalle}</p>
            ${nota ? `<p class="nota">${nota}</p>` : ''}
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="btn-cancelar">${botones.cancelar}</button>
            <button class="btn-primary" id="btn-confirmar">${botones.confirmar}</button>
          </div>
        </div>
      </div>
    `;

    // Agregar al DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Manejar clicks
    document.getElementById('btn-cancelar').addEventListener('click', () => {
      document.getElementById('modal-confirmacion').remove();
      resolve(false);
    });

    document.getElementById('btn-confirmar').addEventListener('click', () => {
      document.getElementById('modal-confirmacion').remove();
      resolve(true);
    });

    // Cerrar con ESC
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        document.getElementById('modal-confirmacion')?.remove();
        resolve(false);
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}
```

### Paso 3: Renderizado de "Mis Partidos"

**Archivo**: `src/viewer/vistaPersonal.js`

Modificar función que renderiza partidos pendientes:

```javascript
function renderizarMisPartidosPendientes(partidos, parejasMap) {
  if (!partidos || partidos.length === 0) {
    return '<p class="sin-partidos">No tenés partidos pendientes</p>';
  }

  return partidos.map(partido => {
    const estadoVisual = calcularEstadoVisualPartido(partido, parejasMap);

    if (!estadoVisual) {
      console.warn('No se pudo calcular estado visual para partido', partido.id);
      return ''; // Skip este partido
    }

    return `
      <div class="partido-card ${estadoVisual.badge.clase}" data-partido-id="${partido.id}">
        <div class="partido-header">
          <span class="badge-presentismo ${estadoVisual.badge.clase}">
            ${estadoVisual.badge.icono}
          </span>
          <span class="partido-numero">#${partido.posicionGlobal || ''}</span>
          <span class="partido-info">Grupo ${partido.grupos?.nombre || '?'} · Ronda ${partido.ronda || '?'}</span>
        </div>

        <div class="partido-parejas">
          ${renderizarNombresConColores(estadoVisual.jugadores)}
        </div>

        <button
          class="btn-cargar-resultado"
          onclick="cargarResultadoConValidacion('${partido.id}')"
        >
          Cargar resultado
        </button>
      </div>
    `;
  }).join('');
}

function renderizarNombresConColores(jugadores) {
  const [j1, j2, j3, j4] = jugadores;
  return `
    <div class="pareja">
      <span class="jugador ${j1.presente ? 'presente' : 'ausente'}">${j1.nombre}</span>-<span class="jugador ${j2.presente ? 'presente' : 'ausente'}">${j2.nombre}</span>
    </div>
    <span class="vs">vs</span>
    <div class="pareja">
      <span class="jugador ${j3.presente ? 'presente' : 'ausente'}">${j3.nombre}</span>-<span class="jugador ${j4.presente ? 'presente' : 'ausente'}">${j4.nombre}</span>
    </div>
  `;
}
```

### Paso 4: Integración en Modal "Fixture"

**Archivo**: `src/viewer/modalConsulta.js`

Modificar tab "Fixture" para agregar badges:

```javascript
// Similar a paso anterior, pero sin botón "Cargar resultado"
// Solo mostrar info visual del estado
function renderizarFixtureEnModal(partidos, parejasMap) {
  return partidos.map(partido => {
    const estadoVisual = calcularEstadoVisualPartido(partido, parejasMap);

    if (!estadoVisual) return '';

    return `
      <div class="partido-card-fixture ${estadoVisual.badge.clase}">
        <div class="partido-header">
          <span class="badge-presentismo ${estadoVisual.badge.clase}">
            ${estadoVisual.badge.icono}
          </span>
          <span class="partido-numero">#${partido.posicion}</span>
          <span class="partido-info">Grupo ${partido.grupos?.nombre} · Ronda ${partido.ronda}</span>
        </div>

        <div class="partido-parejas">
          ${renderizarNombresConColores(estadoVisual.jugadores)}
        </div>

        ${partido.estado ? `<span class="estado">${partido.estado}</span>` : ''}
      </div>
    `;
  }).join('');
}
```

---

## CSS Requerido

**Archivo**: `style.css`

```css
/* === BADGES DE PRESENTISMO === */

.badge-presentismo {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  margin-right: 8px;
}

.badge-presentismo.todos-presentes {
  background: rgba(22, 163, 74, 0.12);
  color: #16A34A;
  border: 1px solid #16A34A;
}

.badge-presentismo.info-incompleta {
  background: rgba(251, 191, 36, 0.12);
  color: #F59E0B;
  border: 1px solid #F59E0B;
}

/* === JUGADORES CON ESTADO === */

.jugador {
  font-weight: 600;
  transition: color 0.2s ease;
}

.jugador.presente {
  color: #16A34A; /* Verde */
}

.jugador.ausente {
  color: #9CA3AF; /* Gris */
  opacity: 0.7;
}

/* === CARDS DE PARTIDO === */

.partido-card {
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: all 0.2s ease;
}

.partido-card.todos-presentes {
  border-left: 4px solid #16A34A;
}

.partido-card.info-incompleta {
  border-left: 4px solid #F59E0B;
  opacity: 1; /* Sin reducir opacidad */
}

.partido-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #6B7280;
}

.partido-numero {
  font-weight: 700;
  color: #374151;
}

.partido-parejas {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.pareja {
  display: inline;
}

.vs {
  color: #9CA3AF;
  font-weight: 600;
  font-size: 12px;
}

/* === MODAL DE CONFIRMACIÓN === */

.modal-confirmacion {
  max-width: 480px;
  padding: 24px;
}

.modal-confirmacion h2 {
  margin: 0 0 16px 0;
  font-size: 20px;
  color: #111827;
}

.modal-confirmacion .mensaje-principal {
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.modal-confirmacion .detalle {
  color: #6B7280;
  margin-bottom: 12px;
}

.modal-confirmacion .nota {
  background: #FEF3C7;
  border-left: 3px solid #F59E0B;
  padding: 12px;
  border-radius: 4px;
  font-size: 14px;
  color: #92400E;
  margin-top: 16px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.btn-secondary {
  background: #F3F4F6;
  color: #374151;
  border: 1px solid #D1D5DB;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #E5E7EB;
}

.btn-primary {
  background: #2563EB;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #1D4ED8;
}

/* === RESPONSIVE === */

@media (max-width: 640px) {
  .badge-presentismo {
    font-size: 12px;
    padding: 3px 6px;
  }

  .jugador {
    font-size: 14px;
  }

  .partido-card {
    padding: 12px;
  }

  .modal-confirmacion {
    max-width: 90vw;
    padding: 20px;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal-actions button {
    width: 100%;
  }
}
```

---

## Query de Datos

**Archivo**: `src/viewer/vistaPersonal.js`

Modificar query de Supabase para incluir campo `presentes`:

```javascript
async function cargarDatosParaVistaPersonal(torneoId) {
  // ... queries existentes ...

  // IMPORTANTE: Agregar campo 'presentes' al query de parejas
  const { data: parejas } = await supabase
    .from('parejas')
    .select('id, nombre, orden, presentes') // ← Agregar 'presentes'
    .eq('torneo_id', torneoId)
    .order('orden');

  // Crear mapa para acceso rápido
  const parejasMap = new Map(parejas.map(p => [p.id, p]));
  window.parejasMap = parejasMap; // Guardar en window para uso global

  // ... resto del código ...
}
```

---

## Flujo Completo: Caso de Uso

### Escenario: Jugador carga resultado con ausentes

1. **Usuario**: Abre `index.html`, ve sus partidos
2. **Sistema**: Muestra partido #9 con badge ⚠️ (Fede y Mati grises)
3. **Usuario**: Click en "Cargar resultado"
4. **Sistema**: Detecta que `todosPresentes = false`
5. **Sistema**: Muestra diálogo:
   ```
   ¿Estás seguro?

   Me figura que Fede y Mati están ausentes.
   ¿Estás seguro que querés cargar el resultado?

   💡 Si cargás el resultado, los marcaré como presentes.

   [No, volver] [Sí, cargar resultado]
   ```
6. **Usuario**: Click en "Sí, cargar resultado"
7. **Sistema**:
   - Llama `marcarJugadoresComoPresentesAutomaticamente()`
   - UPDATE en BD: `parejas.presentes` agrega "Fede" y "Mati"
   - Muestra toast: "✅ Marcados como presentes: Fede, Mati"
   - Recarga vista personal
   - Abre modal de carga de resultado
8. **Resultado**: Fede y Mati ahora aparecen en verde, badge cambió a ✅

---

## Criterios de Aceptación

### Funcionales

- ✅ Badge ✅ verde cuando 4/4 presentes
- ✅ Badge ⚠️ amarillo/naranja cuando <4 presentes
- ✅ Nombres en verde si presentes, gris si ausentes
- ✅ Botón "Cargar resultado" SIEMPRE habilitado
- ✅ Si todos presentes → carga directa
- ✅ Si faltan → muestra diálogo de confirmación
- ✅ Si confirma → marca ausentes como presentes + carga
- ✅ Si cancela → vuelve sin hacer nada
- ✅ Toast muestra quiénes fueron marcados como presentes

### UX

- ✅ Info visible de un vistazo (sin interacción)
- ✅ Colores claros (verde/gris)
- ✅ Mobile-friendly (diálogo funciona en celular)
- ✅ No frustra al usuario (siempre puede continuar)
- ✅ Guía suavemente (pregunta antes de proceder)

### Técnicos

- ✅ Reutiliza `calcularEstadoVisualPartido()` en ambos lugares
- ✅ Query incluye campo `presentes`
- ✅ Auto-corrección actualiza BD (Supabase)
- ✅ Vista se refresca después de auto-corrección
- ✅ CSS responsive (<640px)

---

## Testing

### Casos de Prueba

1. **Todos presentes**
   - Resultado esperado: Badge ✅, nombres verdes, carga directa

2. **1 ausente**
   - Resultado esperado: Badge ⚠️, 1 nombre gris, diálogo con 1 nombre

3. **2 ausentes**
   - Resultado esperado: Badge ⚠️, 2 nombres grises, diálogo con "X y Y"

4. **3 ausentes**
   - Resultado esperado: Badge ⚠️, 3 nombres grises, diálogo con "X, Y y Z"

5. **4 ausentes**
   - Resultado esperado: Badge ⚠️, todos grises, diálogo con todos los nombres

6. **Confirmación → Auto-corrección**
   - Usuario confirma diálogo
   - Verificar UPDATE en BD (`presentes` actualizado)
   - Verificar toast se muestra
   - Verificar vista se refresca (nombres ahora verdes, badge ✅)

7. **Cancelación**
   - Usuario cancela diálogo
   - Verificar que NO se abre modal de carga
   - Verificar que NO se actualiza BD

8. **Mobile**
   - Verificar que badges se ven correctamente
   - Verificar que diálogo es responsive
   - Verificar que botones son fáciles de tocar

---

## Notas de Implementación

### Reutilización

- ✅ Misma función `calcularEstadoVisualPartido()` en "Mis Partidos" y "Modal Fixture"
- ✅ Mismo CSS en ambos lugares
- ✅ Consistencia visual total

### Compatibilidad

- ✅ No rompe funcionalidad existente
- ✅ Si `presentes` no existe en BD → array vacío (todos ausentes)
- ✅ Fallback si no se puede calcular estado → no muestra badge

### Performance

- ✅ Cálculo de estado es en memoria (no query adicional)
- ✅ Map de parejas se crea una sola vez
- ✅ Actualización de presencia es 1-2 queries (según parejas afectadas)

---

## Orden de Implementación Sugerido

1. ✅ Agregar función `calcularEstadoVisualPartido()` en `presentismo.js`
2. ✅ Agregar función `marcarJugadoresComoPresentesAutomaticamente()` en `presentismo.js`
3. ✅ Agregar función `mostrarDialogoConfirmacion()` en `vistaPersonal.js`
4. ✅ Modificar query para incluir campo `presentes`
5. ✅ Modificar renderizado de "Mis Partidos" con badges
6. ✅ Agregar función `cargarResultadoConValidacion()`
7. ✅ Agregar CSS de badges, jugadores, y modal de confirmación
8. ✅ Modificar tab "Fixture" en modal de consulta
9. ✅ Testing completo

---

## Dependencias

- ✅ Campo `presentes` debe existir en tabla `parejas` (ya existe)
- ✅ Funciones de presentismo en `src/viewer/presentismo.js` (ya existen)
- ✅ Modal de consulta funcionando (ya existe)
- ✅ Vista personal funcionando (ya existe)

---

## Referencias

- [Diseño Visual](fixture-presentismo-visual.md) - Especificación de badges y colores
- [Plan de Integración](fixture-integracion-presentismo-plan.md) - Arquitectura general
- [Migraciones BD](../supabase/migrations/20260130010000_add_presentes_to_parejas.sql) - Campo `presentes`
