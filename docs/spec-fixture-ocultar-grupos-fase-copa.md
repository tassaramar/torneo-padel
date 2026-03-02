# Spec: fixture.html — limpiar UI en fase de copas

**Estado**: 📋 PRIORIZADA
**Prioridad**: Tier 2
**Ítem del backlog**: "fixture.html — ocultar secciones de grupos cuando no quedan partidos pendientes"
**Dependencia**: Implementar después de Doc 1 (cola unificada)

---

## Contexto

### Pregunta del organizador que resuelve

> "Ya terminaron los grupos, ¿por qué sigo viendo secciones vacías?" — El organizador está gestionando copas pero la pantalla sigue mostrando "Resumen por Grupo", "En Juego" y "Pendientes" sin contenido útil.

### Relación con Doc 1

Doc 1 (cola unificada) integra los partidos de copa en la cola principal, eliminando la sección separada "🏆 Copas pendientes". Sin embargo, **las secciones de grupos** siguen renderizándose siempre, aunque estén vacías. Este doc resuelve ese ruido visual.

---

## Comportamiento actual

En `src/fixture.js`, la función `renderColaFixture()` (línea ~774) siempre renderiza:
1. "Resumen por Grupo" — estadísticas de estado por grupo
2. "En Juego" (`<details open>`) — partidos de grupos en estado `en_juego`
3. "Pendientes" (`<details open>`) — cola de partidos de grupos pendientes
4. "Ya Jugados" (`<details open>`) — todos los partidos ya jugados (grupos + copas)

**Nota**: La sección "Copas pendientes" desaparece con Doc 1 (cola unificada). Las secciones 1-3 no tienen condición de ocultamiento aunque estén vacías.

---

## Comportamiento esperado

Cuando **todos los partidos de grupos están finalizados o en juego con resultado** (ninguno pendiente):

- Ocultar: "Resumen por Grupo", sección "En Juego (grupos)", sección "Pendientes (grupos)"
- Mantener siempre: cola unificada (que incluye copas, por Doc 1), "Ya Jugados"
- Mostrar un banner: **"✅ Fase de grupos finalizada"** (si hay copas agregar "— copas en curso")

Cuando **hay al menos 1 partido de grupos pendiente o en juego**:
- Todo se muestra como hoy (sin cambios)

---

## Condición de activación

```javascript
// Partidos de grupos (sin copa_id)
const gruposPendientes = partidos.filter(p => !p.copa_id && esPartidoPendiente(p));
const gruposEnJuego   = partidos.filter(p => !p.copa_id && p.estado === 'en_juego');

const faseCopaActiva = gruposPendientes.length === 0 && gruposEnJuego.length === 0;
```

`esPartidoPendiente()` viene de `src/utils/colaFixture.js` — ya importado en `fixture.js`.

---

## Cambios técnicos

En `src/fixture.js`, en `renderColaFixture()`:

**Paso 1** — Calcular `faseCopaActiva` al inicio de la función (usando las variables `partidos` de grupos y `esPartidoPendiente`).

**Paso 2** — Condicionar el renderizado de las secciones:

```javascript
// En lugar de siempre renderizar:
html += renderResumenPorGrupo(...);
html += renderSeccionEnJuego(...);
html += renderSeccionPendientes(...);

// Renderizar condicionalmente:
if (!faseCopaActiva) {
  html += renderResumenPorGrupo(...);
  html += renderSeccionEnJuego(...);
  html += renderSeccionPendientes(...);
} else {
  html += `
    <div class="fase-copa-banner">
      ✅ Fase de grupos finalizada — copas en curso
    </div>
  `;
}
```

**Paso 3** — La cola unificada (con copas integradas, por Doc 1) y "Ya Jugados" se renderizan siempre.

---

## Consideraciones

**¿Qué pasa si hay partidos de grupos "en juego" sin resultado?**

Un partido puede estar en `en_juego` (marcado por el organizador como "en cancha") pero sin resultado cargado. La condición actual incluye a `en_juego` en el cálculo — si hay partidos de grupos `en_juego`, la condición NO se activa y se siguen mostrando las secciones.

Esto es correcto: el organizador necesita ver los partidos en juego para gestionar la cancha.

**¿Qué pasa si hay partidos de grupos `terminado` sin resultado?**

El estado `terminado` es un estado operacional del organizador. `esPartidoPendiente()` lo considera pendiente si no tiene resultado. Este caso es poco probable pero si ocurre, la condición tampoco se activa — correcto, el organizador debería ver que queda ese partido.

**¿Qué hace el banner si no hay copas?**

Si no hay copas configuradas y todos los grupos terminaron, el banner aparece igual. Esto es correcto — el torneo de grupos terminó, no hay más nada que mostrar. El banner puede decir en ese caso: "✅ Fase de grupos finalizada". La sección "Copas pendientes" simplemente no aparece (ya es condicional).

---

## Estilos

El banner `.fase-copa-banner` puede usar los estilos existentes del proyecto (colores verdes, fondo suave). Ejemplo:

```css
.fase-copa-banner {
  background: #F0FDF4;
  border: 1px solid #BBF7D0;
  border-radius: 8px;
  padding: 12px 16px;
  color: #166534;
  font-weight: 500;
  margin-bottom: 12px;
  text-align: center;
}
```

---

## Criterios de aceptación

- [ ] Cuando no hay partidos de grupos pendientes ni en juego → secciones "Resumen por Grupo", "En Juego (grupos)" y "Pendientes (grupos)" desaparecen
- [ ] Cuando se ocultan las secciones de grupos → aparece el banner "✅ Fase de grupos finalizada — copas en curso"
- [ ] La cola unificada y "Ya Jugados" siempre están visibles (sin cambio respecto a hoy)
- [ ] Si hay al menos 1 partido de grupos pendiente o en juego → todo se muestra como hoy (sin regresión)
- [ ] El cambio es solo visual/condicional — no afecta la lógica de carga de datos
- [ ] `npm run build` sin errores nuevos

---

## Archivos a modificar

- `src/fixture.js` — función `renderColaFixture()`: calcular `faseCopaActiva`, condicionar renderizado de secciones de grupos, agregar banner
- `src/style.css` — clase `.fase-copa-banner` (si no existe ya un estilo equivalente)
