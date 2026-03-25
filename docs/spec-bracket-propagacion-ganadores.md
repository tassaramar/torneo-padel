# Bracket — Propagar ganadores a la ronda siguiente — Spec Funcional

> **Estado**: Borrador — pendiente de priorización
> **Tipo**: Mejora visual
> **Complejidad**: Baja-media (~30-40 líneas)

---

## El problema hoy

Cuando un partido de cuartos de final tiene resultado confirmado, el ganador no aparece en el slot correspondiente de la semi-final hasta que se completa toda la ronda y se ejecuta `avanzar_ronda_copa`. El jugador y el admin ven todos los slots de la ronda siguiente como "pendiente" aunque ya se sepa quién avanzó.

### Ejemplo

Copa Oro con 8 equipos (QF → SF → F):

- QF2: Lucas-Martin 6-0 Ari-Lean → **ganador confirmado**
- QF3: Ale-Gonza 6-0 Nico-Pablo → **ganador confirmado**
- QF1 y QF4: aún sin jugar

**Hoy**: SF1 y SF2 muestran ambos slots como "pendiente".

**Después**: SF1 muestra "Lucas - Martin" en el slot inferior + "pendiente" arriba. SF2 muestra "Ale - Gonza" en el slot superior + "pendiente" abajo.

---

## Solución propuesta

Cambio puramente **visual / client-side**. No requiere modificar la BD ni las RPCs.

### Mapeo de alimentación entre rondas

En un bracket estándar, el `orden_copa` determina qué partido alimenta a qué slot de la ronda siguiente:

```
QF orden=1 ganador → SF orden=1 slot superior (pareja_a)
QF orden=2 ganador → SF orden=1 slot inferior (pareja_b)
QF orden=3 ganador → SF orden=2 slot superior (pareja_a)
QF orden=4 ganador → SF orden=2 slot inferior (pareja_b)

SF orden=1 ganador → F orden=1 slot superior (pareja_a)
SF orden=2 ganador → F orden=1 slot inferior (pareja_b)
```

Fórmula general para un match con `orden_copa = N` en ronda R:
- Alimenta al match `ceil(N/2)` de la ronda R+1
- Si N es impar → slot superior (pareja_a)
- Si N es par → slot inferior (pareja_b)

### Implementación

Después de `normalizarPartidosParaBracket`, agregar un paso de **propagación**:

1. Recorrer matches de cada ronda de menor a mayor
2. Para cada match con ganador confirmado (`estado === 'confirmado'`):
   - Calcular el match destino en la ronda siguiente usando la fórmula
   - Si el slot correspondiente del match destino está vacío ("pendiente"):
     - Rellenar con el nombre del ganador
     - Marcar como `propagado: true` para diferenciarlo visualmente
3. El renderer muestra el nombre propagado con estilo diferente (ej. texto más tenue, sin fondo verde de ganador)

### Estilo visual sugerido

El equipo propagado debe distinguirse de un equipo "oficial" (asignado por el RPC):

```css
.sb-team.sb-propagated {
  color: #6B7280;        /* gris medio — no es oficial aún */
  font-style: italic;
}
```

Alternativa: mismo estilo que un equipo normal pero sin el badge de "pendiente". El punto es que el usuario vea quién avanzó sin confundirlo con un partido ya armado oficialmente.

---

## Alcance

- **Ambas vistas**: admin (`statusView.js`) y jugador (`modalConsulta.js`)
- Si comparten el mismo renderer de bracket (o se unifica como parte del epic de visualización), el cambio es en **un solo lugar**
- Compatible con brackets de 4 (SF → F) y 8 (QF → SF → F) equipos
- No aplica a formato `direct` (2 equipos, sin rondas siguientes)

---

## Lo que NO cambia

- La BD: los partidos de la ronda siguiente no se modifican hasta que `avanzar_ronda_copa` se ejecute normalmente
- El flujo de aprobación: sigue igual
- Los partidos con formato `direct`: no tienen ronda siguiente

---

## Archivos clave

- `src/admin/copas/statusView.js` — `_normalizarPartidosParaBracket`, `_renderBracketMatch`
- `src/viewer/modalConsulta.js` — rendering de copas en modal del jugador
- `src/utils/bracketRenderer.js` — si se unifica el renderer (epic de visualización)
- `style.css` — clase `.sb-propagated`

---

## Relación con otros ítems

- **Unificar visualización (Sub-ítem C)**: si el bracket se extrae a un módulo compartido, la propagación se implementa una sola vez ahí
- **Conviene implementar después** del sub-ítem C para no duplicar trabajo
