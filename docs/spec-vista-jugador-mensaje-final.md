# Spec: Mensaje de cierre del torneo para el jugador

**Estado**: 📋 PRIORIZADA
**Prioridad**: Tier 2
**Ítem del backlog**: "index.html — mensaje final cuando el jugador no tiene más partidos"

---

## Contexto

### Experiencia del usuario que resuelve

> El jugador termina su último partido, abre la app al día siguiente para ver cómo le fue... y ve "No tenés partidos pendientes". Frío. No le dice nada de lo que vivió. Es como si la app no reconociera que participó.

Cuando un jugador terminó todos sus partidos, la app actualmente muestra un empty state frío: "No tenés partidos pendientes". No hay cierre, no hay emoción, no refleja lo que vivió el jugador en el torneo.

Este feature reemplaza ese mensaje genérico por un mensaje contextual que resume el desempeño del jugador: si ganó una copa, si llegó a la final, cómo quedó en el grupo.

**Prerequisito**: Este feature se beneficia de que [Doc 3 (spec-polish-copa-vista-jugador.md)](spec-polish-copa-vista-jugador.md) ya cargue `copa:copas(nombre)` en la query. Si ese doc se implementa primero, el nombre de copa ya estará disponible. Si no, hay que agregar el join aquí también.

---

## Cuándo mostrar el mensaje

El mensaje de cierre reemplaza al empty state SOLO cuando se cumplen **todas** estas condiciones:

1. El jugador tiene identidad guardada (`localStorage`)
2. No hay partidos pendientes de la pareja (ni de grupos ni de copa)
3. Al menos un partido fue jugado (la pareja participó)

Si no se cumplen: mantener el comportamiento actual.

---

## Árbol de decisión para el mensaje

```
¿La pareja tiene partidos de copa con resultado (confirmado)?
│
├── SÍ → Tomar el partido de copa "más avanzado" (mayor jerarquía de ronda: F > SF > 3P > direct)
│         │
│         ├── ¿Ese partido fue una VICTORIA de la pareja?
│         │     └── SÍ, y la ronda fue 'F' (Final) → "🏆 ¡Campeón! Ganaste la Copa [X]"
│         │     └── SÍ, pero no fue 'F' → "✅ Buen torneo — ganaste en [ronda] de Copa [X]"
│         │
│         └── ¿Ese partido fue una DERROTA?
│               ├── La ronda fue 'F' (Final) → "🥈 ¡Finalista! — Copa [X]"
│               ├── La ronda fue 'SF' → "✅ Llegaste a la semi — Copa [X]"
│               └── Otro → "✅ Participaste en Copa [X] — quedaste en [ronda]"
│
└── NO → ¿Su grupo está completo (todos los partidos de grupos confirmados)?
          │
          ├── SÍ → Tomar posición final en grupo desde la tabla de posiciones
          │         → "✅ ¡Torneo completado! Quedaste [N°] en el Grupo [X]"
          │
          └── NO → No mostrar mensaje de cierre (grupos aún en curso)
```

**Prioridad de copa vs grupo**: Si hay copa, siempre mostrar el resultado de copa (es el logro más reciente y relevante).

---

## Frases del mensaje

Las frases usan el nombre del jugador (`identidad.miNombre`) y del compañero (`identidad.companero`). Tono casual argentino.

| Situación | Mensaje |
|-----------|---------|
| Campeón de copa | 🏆 **¡Campeón, [Nombre]!** Ganaste la Copa [X] con [Compañero]. ¡Cracks! |
| Finalista de copa | 🥈 **¡Llegaste a la final, [Nombre]!** Copa [X] — subcampeón con [Compañero]. |
| Semifinalista perdedor | ✅ **¡Gran torneo, [Nombre]!** Llegaste a la semi de Copa [X] con [Compañero]. |
| Participó en copa (otra ronda) | ✅ **Buen torneo, [Nombre].** Competiste en Copa [X] y quedaste en [ronda]. |
| Solo grupos, posición conocida | ✅ **¡Torneo completado, [Nombre]!** Quedaste [N°] en el Grupo [X] con [Compañero]. |

---

## Lógica técnica

### Determinar victoria/derrota en un partido de copa

```javascript
function determinarResultado(partido, parejaId) {
  const esP1 = partido.pareja1_id === parejaId;
  let setsP1 = 0, setsP2 = 0;
  [[partido.set1_p1, partido.set1_p2], [partido.set2_p1, partido.set2_p2]]
    .forEach(([a, b]) => {
      if (a != null && b != null) {
        if (a > b) setsP1++;
        else if (b > a) setsP2++;
      }
    });
  const ganoP1 = setsP1 > setsP2;
  return (esP1 ? ganoP1 : !ganoP1) ? 'victoria' : 'derrota';
}
```

### Jerarquía de rondas

```javascript
const JERARQUIA_RONDA = { F: 4, '3P': 3, SF: 2, direct: 1 };
```

Para encontrar el partido de copa "más importante" de la pareja, tomar el que tenga mayor `JERARQUIA_RONDA[p.ronda_copa]`.

### Posición en grupo

La tabla de posiciones ya se calcula en el dashboard de `vistaPersonal.js`. Reutilizar esa información — no hacer una query extra. La posición actual del jugador está disponible como parte del contexto de la vista.

Si el grupo está completo (todos los partidos confirmados), la posición es definitiva. Para verificar si el grupo está completo: todos los partidos del grupo tienen `estado: 'confirmado'`.

### Label de ronda para usuario final

```javascript
const RONDA_LABEL_USUARIO = {
  F: 'la final',
  SF: 'la semifinal',
  '3P': 'el 3° puesto',
  direct: 'el cruce'
};
```

---

## Consideraciones

**Edge case — Jugador eliminado en copa mientras el torneo sigue**: Si la pareja perdió en semifinal pero la final todavía no se jugó, el jugador no tiene partidos pendientes pero el torneo no terminó. ¿Mostrar el mensaje ya? **Sí** — el mensaje dice "Llegaste a la semi", no "El torneo terminó". El jugador ya no tiene acción pendiente, así que el cierre aplica.

**Reutilización de lógica**: La función `determinarResultado()` es la misma que `determinarResultadoParaJugador()` de Doc 3. Centralizar en `src/utils/` para evitar duplicación.

**Dismissibilidad**: El mensaje no necesita un "X" para cerrarse. Es la vista final permanente del jugador. Si vuelve a abrir la app días después, sigue viendo el mensaje (correcto — no cambió nada).

---

## Implementación en `vistaPersonal.js`

La función que detecta el empty state de partidos pendientes y lo reemplaza por el mensaje de cierre.

**Lugar**: En la función principal de render de la vista, donde hoy se renderiza el empty state "No tenés partidos pendientes".

**Datos necesarios** (todos ya cargados o calculables desde datos existentes):
- `identidad` (de localStorage): `miNombre`, `companero`, `parejaId`, `grupo`
- Partidos de copa de la pareja: los `partidosCopa` ya filtrados por `parejaId`
- Posición en el grupo: ya calculada para el dashboard
- Nombre de la copa: con join `copa:copas(nombre)` en la query (ver Doc 3)

**Estructura HTML del mensaje**:

```html
<div class="mensaje-cierre">
  <div class="cierre-emoji">[emoji]</div>
  <div class="cierre-titulo">[título bold]</div>
  <div class="cierre-subtitulo">[subtítulo]</div>
</div>
```

Estilos: card centrada, padding generoso, fondo levemente coloreado según el resultado (dorado suave para campeón, gris-verde para otros).

---

## Criterios de aceptación

- [ ] Cuando no hay partidos pendientes y la pareja jugó copa → mensaje de copa visible en lugar del empty state
- [ ] Campeón de copa → emoji 🏆, mensaje específico "Ganaste la Copa [X]"
- [ ] Finalista → emoji 🥈, "Llegaste a la final"
- [ ] Otros → mensaje positivo con nombre de ronda
- [ ] Cuando no hay copa y el grupo está completo → mensaje con posición final en grupo
- [ ] Cuando no hay copa y el grupo no está completo → no se muestra mensaje de cierre (comportamiento sin cambio)
- [ ] El mensaje usa el nombre del jugador y del compañero
- [ ] El nombre de la copa es el real (de BD), no hardcodeado
- [ ] `npm run build` sin errores nuevos

---

## Archivos a modificar

- `src/viewer/vistaPersonal.js` — función de render del estado vacío; funciones auxiliares `determinarResultado()` y `construirMensajeCierre()`
- `src/style.css` — clase `.mensaje-cierre` y variantes
- (Si Doc 3 no se implementó antes) agregar join `copa:copas(nombre)` en la query de partidos
