# Spec: Presentismo — mejoras de UX

**Estado**: 📋 PRIORIZADA
**Prioridad**: Tier 2
**Ítems del backlog**: "Presentismo — acciones masivas debajo del control por pareja" + "Presentismo — botones del dashboard como filtros o drill-down"

---

## Contexto

### Preguntas del organizador que resuelve

> "Ya llegaron casi todos, ¿para qué sigo viendo el presentismo?" — El organizador activó presentismo al inicio, los jugadores se auto-marcaron, pero ahora ya están todos y el sistema es ruido.

> "Dice '2 incompletos' pero ¿quiénes son?" — Los contadores del dashboard son útiles como resumen, pero no revelan quiénes están detrás de cada número.

**Nota sobre roles**: Presentismo lo usa principalmente el **organizador** (desde `presente.html`) y los **jugadores** (desde `index.html`). Las mejoras de drill-down benefician especialmente al organizador que necesita gestionar ausencias rápidamente.

---

## Ítem 0 — Semántica del toggle de presentismo

### Estado actual

El toggle "Sistema de presentismo" (`presentismo_activo` en BD) activa o desactiva el feature. Cuando está OFF, los controles de presencia no se muestran y el sistema no se usa.

### Comportamiento esperado

El toggle cambia de significado:

- **Presentismo ON** = "Necesito trackear quién está". Se activan los controles individuales, los jugadores pueden auto-marcarse, el dashboard muestra contadores.
- **Presentismo OFF** = "Todos presentes". Se asume que todos están. Los badges de presencia se muestran en verde (o no se muestran). El jugador **no puede** cambiar su estado de presencia.

**Flujo real del organizador**:
```
Antes del torneo:  Activa presentismo → los jugadores van llegando y se auto-marcan
Durante:           Ve en el dashboard quién falta → decide qué partidos se pueden jugar
Cuando están todos: Desactiva presentismo → "todos presentes", a jugar
```

**Por qué este cambio**: "Marcar todos presentes" y "Desactivar presentismo" son funcionalmente equivalentes — ambos dicen "ya no me importa quién falta". Pero desactivar es un solo click que el organizador ya conoce, sin necesidad de botones extra.

**Impacto en la lógica de cola**: Cuando presentismo está OFF y todos se consideran presentes, la cola del fixture ordena normalmente sin considerar ausencias — que es exactamente lo que se quiere cuando ya están todos.

### Archivos a modificar

- `src/viewer/presentismo.js` — lógica de render cuando `presentismo_activo = false` (mostrar todos como presentes, deshabilitar toggles del jugador)
- Posiblemente `src/personal.js` o `src/viewer/vistaPersonal.js` — UI del jugador cuando presentismo está OFF

---

## Ítem 1 — Posición de acciones masivas

### Estado actual

El template de la pantalla de presentismo en `src/viewer/presentismo.js` renderiza en este orden:

```
[Marcar todos presentes] [Limpiar todos]   ← botones de acción masiva arriba
---
Pareja A: [Jugador 1 ✅] [Jugador 2 ⬜]
Pareja B: [Jugador 1 ✅] [Jugador 2 ✅]
...                                         ← lista de control individual
```

### Decisión: Mover al final

Mover los botones de acción masiva al final de la lista de parejas. El flujo natural es "revisar primero, actuar después": el organizador escanea quién está y quién falta, y luego decide si usar una acción masiva.

Con 20+ parejas hay que scrollear para llegar a los botones, pero el caso de uso principal de "marcar todos" ya está cubierto por el toggle de presentismo (Ítem 0). Los botones masivos quedan como herramienta secundaria.

```
Pareja A: [Jugador 1 ✅] [Jugador 2 ⬜]
Pareja B: [Jugador 1 ✅] [Jugador 2 ✅]
...                                         ← lista de control individual
---
[Marcar todos presentes] [Limpiar todos]   ← botones al final
```

### Archivos a modificar

- `src/viewer/presentismo.js` — mover botones masivos debajo de la lista en el template HTML

---

## Ítem 2 — Botones del dashboard como drill-down

### Estado actual

El dashboard de presentismo muestra contadores:

```
[✅ Presentes: 6]  [⚠️ Incompletos: 2]  [❌ Ausentes: 0]
```

Los botones son decorativos — al tocarlos no pasa nada.

### Comportamiento esperado

Al tocar un contador, se **expande inline** (debajo del botón) una lista compacta de las parejas/jugadores en ese estado. Tocar de nuevo colapsa.

```
[✅ Presentes: 6]  [⚠️ Incompletos: 2 ▼]  [❌ Ausentes: 0]
                    ┌─────────────────────────────┐
                    │ Pareja A  Tincho [✅→⬜]     │
                    │           Max   [⬜→✅]     │
                    │ Pareja D  Gaby  [✅→⬜]     │
                    └─────────────────────────────┘
```

Cada ítem de la lista expande incluye:
- Nombre de la pareja
- Por cada jugador de la pareja: nombre + botón toggle de presencia
- Al tocar el toggle → actualiza en BD (misma lógica que los toggles de la lista principal)

**Solo un panel abierto a la vez**: Al abrir "Incompletos", si "Presentes" estaba abierto, se cierra.

### Implementación

**Tipo de expansión**: Lista inline debajo del botón (no modal, no popover flotante). Más simple, funciona bien en mobile.

**Lógica de qué muestra cada panel**:

```javascript
function obtenerParejasPorEstado(parejas, estado) {
  switch (estado) {
    case 'presentes':
      // Todas las parejas donde TODOS los jugadores están presentes
      return parejas.filter(p =>
        p.jugadores.every(j => p.presentes.includes(j))
      );
    case 'incompletos':
      // Parejas donde AL MENOS UN jugador falta (pero no todos)
      return parejas.filter(p =>
        p.jugadores.some(j => !p.presentes.includes(j)) &&
        p.jugadores.some(j => p.presentes.includes(j))
      );
    case 'ausentes':
      // Parejas donde NINGÚN jugador está marcado
      return parejas.filter(p =>
        p.jugadores.every(j => !p.presentes.includes(j))
      );
  }
}
```

**HTML del panel expandido**:

```html
<div class="drill-panel" data-estado="incompletos">
  <div class="drill-item">
    <span class="drill-pareja">Pareja A</span>
    <div class="drill-jugadores">
      <button class="toggle-jugador presente" data-jugador="Tincho" data-pareja-id="...">
        ✅ Tincho
      </button>
      <button class="toggle-jugador ausente" data-jugador="Max" data-pareja-id="...">
        ⬜ Max
      </button>
    </div>
  </div>
  <!-- más items... -->
</div>
```

**Toggle desde el drill-down**: Usar la misma función de toggle que usa la lista principal (ya implementada en `presentismo.js`). Después del toggle, re-renderizar el contador del dashboard y el panel expandido.

### Archivos a modificar

- `src/viewer/presentismo.js` — dashboard render, lógica de drill-down, toggle handler

---

## Consideraciones de mobile

Todas las mejoras son mobile-first:
- Ítem 0: cambio de lógica, sin impacto visual directo
- Ítem 1: solo un reorden de elementos — sin impacto en mobile
- Ítem 2: el panel expandido es inline (no flotante), no requiere posicionamiento — funciona bien en mobile. Asegurarse que los botones toggle dentro del panel tengan `min-height: 44px` para área de toque cómoda.

---

## Criterios de aceptación

**Ítem 0 — Semántica del toggle**:
- [ ] Cuando presentismo está OFF → todos los jugadores se consideran presentes
- [ ] Cuando presentismo está OFF → el jugador no puede cambiar su estado de presencia desde `index.html`
- [ ] Cuando presentismo está OFF → la cola del fixture no filtra ni reordena por presencia
- [ ] Cuando presentismo se desactiva → no se pierden los datos de presencia en BD (por si se reactiva)

**Ítem 1 — Acciones masivas**:
- [ ] Los botones de acción masiva están al final de la lista (debajo de todas las parejas)
- [ ] La funcionalidad de los botones no cambia

**Ítem 2 — Drill-down**:
- [ ] Al tocar un contador del dashboard → se expande una lista inline debajo con las parejas en ese estado
- [ ] Tocar de nuevo el mismo contador → se colapsa la lista
- [ ] Solo un panel abierto a la vez
- [ ] Cada jugador en el panel tiene un botón toggle que funciona (actualiza en BD)
- [ ] Después de un toggle en el drill-down, el contador del dashboard se actualiza
- [ ] Si el estado es `'ausentes': 0`, el botón del dashboard no es interactivo (o no tiene expansión vacía)
- [ ] Funciona en mobile (áreas de toque adecuadas)

**Todos los ítems**:
- [ ] `npm run build` sin errores nuevos

---

## Archivos a modificar

- `src/viewer/presentismo.js` — semántica del toggle (ítem 0), template HTML reorden (ítem 1), dashboard + drill-down + toggle handler (ítem 2)
- `src/style.css` — clases `.drill-panel`, `.drill-item`, `.drill-jugadores`, `.drill-pareja` para el panel expandido
