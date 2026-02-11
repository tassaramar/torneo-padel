# Badge de Presentismo - Diseño Visual Simplificado

**Fecha:** 2026-02-10
**Status:** Aprobado

---

## Concepto

**Visual directo con colores** en lugar de badges expandibles. Info visible de un vistazo sin interacción.

---

## Diseño Visual

### ✅ Todos Presentes (SE PUEDE JUGAR)

```
┌────────────────────────────────────────┐
│ #3  [✅]  Grupo A · Ronda 1            │ ← Badge verde simple
│ Nico-Fede vs Santi-Mati                │ ← Todos en VERDE
│ [▶ En juego]                           │
└────────────────────────────────────────┘
```

### ⚠️ Info Incompleta (Faltan Jugadores)

```
┌────────────────────────────────────────┐
│ #9  [⚠️]  Grupo B · Ronda 2            │ ← Badge warning (amarillo/naranja)
│ Nico-Fede vs Santi-Mati                │ ← Nico y Santi VERDE
│                                        │    Fede y Mati GRIS
│ [▶ En juego]                           │ ← Habilitado (con confirmación)
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ #12 [⚠️]  Grupo C · Ronda 1            │ ← Badge warning
│ Marcos-Leo vs Gaby-Flor                │ ← Todos GRIS (nadie)
│ [▶ En juego]                           │ ← Habilitado (con confirmación)
└────────────────────────────────────────┘
```

---

## 🎯 Filosofía: Guiar, No Bloquear

**Principio fundamental de la app**: Asumir que puede tener información incompleta o errónea.

- ✅ **Guiar**: Badge visual advierte de posible problema
- ✅ **Confirmar**: Diálogo pregunta si está seguro
- ✅ **Auto-corregir**: Si confirma, marca jugadores como presentes
- ❌ **NO bloquear**: Siempre permite continuar

### Flujo de Confirmación

```
Usuario hace click en "En juego" (con badge ⚠️)
↓
Sistema muestra diálogo:
┌─────────────────────────────────────────┐
│          ¿Estás seguro?                 │
├─────────────────────────────────────────┤
│  Me figura que Fede y Mati están        │
│  ausentes. ¿Estás seguro que querés     │
│  iniciar este partido?                  │
│                                         │
│  💡 Si iniciás el partido, los marcaré  │
│     como presentes automáticamente.     │
├─────────────────────────────────────────┤
│  [No, volver]    [Sí, iniciar partido] │
└─────────────────────────────────────────┘
↓
Si confirma:
  1. Marca Fede y Mati como presentes en BD
  2. Muestra toast: "✅ Marcados como presentes: Fede, Mati"
  3. Procede con la acción (iniciar partido, cargar resultado, etc.)
```

---

## Lógica Simplificada (2 Estados)

| Estado | Condición | Badge | Botón | Acción |
|--------|-----------|-------|-------|--------|
| **Todos presentes** | 4/4 presentes | ✅ Verde | Habilitado | Ejecuta directamente |
| **Info incompleta** | 0/4, 1/4, 2/4 o 3/4 | ⚠️ Amarillo/Naranja | Habilitado | Pide confirmación + auto-corrige |

---

## Colores

**Jugadores:**
- 🟢 Verde (`#16A34A`): Presente
- ⚪ Gris (`#9CA3AF`): Ausente

**Badge del partido:**
- ✅ Verde: Todos presentes (procede directo)
- ⚠️ Amarillo/Naranja (`#F59E0B`): Info incompleta (pide confirmación)

**Border del card:**
- Verde (4px left): Todos presentes
- Amarillo/Naranja (4px left): Info incompleta

---

## Ventajas

| Aspecto | Beneficio |
|---------|-----------|
| **Visibilidad** | Todo visible sin interacción |
| **Mobile** | No requiere tap/hover |
| **Escaneabilidad** | Admin ve de un vistazo con colores |
| **Simplicidad** | 2 estados claros |
| **Performance** | No requiere estado/toggle |

---

## Implementación

```javascript
/**
 * Calcula estado visual de un partido según presentismo individual
 */
function calcularEstadoVisualPartido(partido, parejasMap) {
  const parejaA = parejasMap.get(partido.pareja_a_id);
  const parejaB = parejasMap.get(partido.pareja_b_id);

  // Parsear nombres individuales (formato: "Nico-Fede")
  const [jugadorA1, jugadorA2] = parejaA.nombre.split('-').map(n => n.trim());
  const [jugadorB1, jugadorB2] = parejaB.nombre.split('-').map(n => n.trim());

  // Verificar presencia individual
  const presentesA = parejaA.presentes || [];
  const presentesB = parejaB.presentes || [];

  const jugadores = [
    { nombre: jugadorA1, presente: presentesA.includes(jugadorA1), pareja: 'A' },
    { nombre: jugadorA2, presente: presentesA.includes(jugadorA2), pareja: 'A' },
    { nombre: jugadorB1, presente: presentesB.includes(jugadorB1), pareja: 'B' },
    { nombre: jugadorB2, presente: presentesB.includes(jugadorB2), pareja: 'B' }
  ];

  const totalPresentes = jugadores.filter(j => j.presente).length;
  const sePuedeJugar = totalPresentes === 4;

  return {
    jugadores,
    totalPresentes,
    todosPresentes: sePuedeJugar,
    ausentes: jugadores.filter(j => !j.presente),
    badge: {
      icono: sePuedeJugar ? '✅' : '⚠️',
      clase: sePuedeJugar ? 'todos-presentes' : 'info-incompleta'
    }
  };
}
```

### Renderizado HTML

```html
<div class="partido-card ${estadoVisual.badge.clase}">
  <div class="partido-header">
    <span class="badge-presentismo ${estadoVisual.badge.clase}">
      ${estadoVisual.badge.icono}
    </span>
    <span class="partido-numero">#${posicion}</span>
    <span class="partido-grupo">Grupo ${grupo} · Ronda ${ronda}</span>
  </div>

  <div class="partido-parejas">
    <span class="jugador ${estadoVisual.jugadores[0].presente ? 'presente' : 'ausente'}">
      ${estadoVisual.jugadores[0].nombre}
    </span>-<span class="jugador ${estadoVisual.jugadores[1].presente ? 'presente' : 'ausente'}">
      ${estadoVisual.jugadores[1].nombre}
    </span>

    <span class="vs">vs</span>

    <span class="jugador ${estadoVisual.jugadores[2].presente ? 'presente' : 'ausente'}">
      ${estadoVisual.jugadores[2].nombre}
    </span>-<span class="jugador ${estadoVisual.jugadores[3].presente ? 'presente' : 'ausente'}">
      ${estadoVisual.jugadores[3].nombre}
    </span>
  </div>

  <!-- Botón SIEMPRE habilitado -->
  <button
    class="btn-en-juego"
    onclick="manejarAccionConValidacion(partido, estadoVisual)"
  >
    ▶ En juego
  </button>
</div>
```

### Función de Validación

```javascript
/**
 * Maneja acción con validación de presentismo
 * Guía al usuario pero NO bloquea
 */
async function manejarAccionConValidacion(partido, estadoVisual) {
  // Si todos presentes, ejecutar directamente
  if (estadoVisual.todosPresentes) {
    return ejecutarAccion(partido);
  }

  // Si faltan jugadores, pedir confirmación
  const ausentes = estadoVisual.ausentes.map(j => j.nombre);
  const mensaje = ausentes.length === 1
    ? `Me figura que ${ausentes[0]} está ausente.`
    : `Me figura que ${ausentes.join(', ')} están ausentes.`;

  const confirmado = await mostrarDialogoConfirmacion({
    titulo: '¿Estás seguro?',
    mensaje: mensaje,
    detalle: '¿Estás seguro que querés continuar?',
    nota: 'Si continuás, los marcaré como presentes automáticamente.',
    botones: {
      cancelar: 'No, volver',
      confirmar: 'Sí, continuar'
    }
  });

  if (!confirmado) return;

  // Auto-corrección: marcar ausentes como presentes
  await marcarJugadoresComoPresentesAutomaticamente(partido, ausentes);
  mostrarToast(`✅ Marcados como presentes: ${ausentes.join(', ')}`);

  // Ejecutar acción
  return ejecutarAccion(partido);
}
```

### CSS

```css
/* Jugadores */
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

/* Badge de presentismo */
.badge-presentismo {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.badge-presentismo.todos-presentes {
  background: rgba(22, 163, 74, 0.12);
  color: #16A34A;
  border: 1px solid #16A34A;
}

.badge-presentismo.info-incompleta {
  background: rgba(251, 191, 36, 0.12);  /* Amarillo/Naranja warning */
  color: #F59E0B;
  border: 1px solid #F59E0B;
}

/* Card del partido */
.partido-card {
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  background: white;
  transition: all 0.2s ease;
}

.partido-card.todos-presentes {
  border-left: 4px solid #16A34A;
}

.partido-card.info-incompleta {
  border-left: 4px solid #F59E0B;  /* Warning, no error */
  opacity: 1;  /* Sin reducir opacidad */
}

/* Responsive */
@media (max-width: 640px) {
  .badge-presentismo {
    font-size: 12px;
    padding: 3px 6px;
  }

  .jugador {
    font-size: 14px;
  }
}
```

---

## Consideraciones Arquitectónicas

### Presentismo Individual

⚠️ **Importante:** Aunque la BD almacena por parejas (`presentes TEXT[]` en tabla `parejas`), el presentismo es por **jugador individual**.

**Ejemplo válido:**
- Pareja "Nico-Fede" → `presentes = ['Nico']` (solo Nico, Fede ausente)
- Pareja "Santi-Mati" → `presentes = ['Santi']` (solo Santi, Mati ausente)
- **Resultado:** Partido con 2/4 presentes (Nico y Santi) → ❌ NO se puede jugar

### Cambio Futuro (Documentado)

**Refactor propuesto** (más adelante):
- Tabla `jugadores` con presentismo por jugador
- Tabla `parejas` referencia 2 jugadores
- Permite reutilizar jugadores en diferentes parejas

**Decisión:** Implementar MÁS ADELANTE, la estructura actual funciona.

---

## Filtro "Solo con Todos Presentes"

```
☑️ Solo mostrar con todos presentes [✅]
```

**Efecto:**
- Activo: muestra solo partidos con badge ✅ (4/4)
- Desactivo: muestra todos

**Uso:**
- Admin al inicio: activa filtro → ve solo lo jugable
- Admin después: desactiva → ve todo

---

## Testing

### Escenarios de Prueba

1. **Todos presentes (4/4)**
   - Badge: ✅ verde
   - Nombres: todos verdes
   - Botón: habilitado
   - Border: verde
   - **Acción**: Ejecuta directamente sin confirmación

2. **Parcial (2/4)**
   - Badge: ⚠️ amarillo/naranja
   - Nombres: 2 verdes, 2 grises
   - Botón: habilitado
   - Border: amarillo/naranja
   - **Acción**: Muestra diálogo de confirmación
   - **Si confirma**: Marca ausentes como presentes + ejecuta

3. **Nadie (0/4)**
   - Badge: ⚠️ amarillo/naranja
   - Nombres: todos grises
   - Botón: habilitado
   - Border: amarillo/naranja
   - **Acción**: Muestra diálogo de confirmación
   - **Si confirma**: Marca todos como presentes + ejecuta

4. **Mobile**
   - Info visible sin tap
   - Colores claros
   - No requiere interacción
   - Diálogo de confirmación funciona en mobile

5. **Auto-corrección**
   - Usuario confirma acción a pesar de ausentes
   - Sistema marca ausentes como presentes en BD
   - Muestra toast de confirmación
   - Refresca vista con colores actualizados
