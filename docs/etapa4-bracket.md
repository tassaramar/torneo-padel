# Etapa 4-bracket — Visualización gráfica del bracket

## Objetivo

Reemplazar la lista plana de cruces por un bracket gráfico HTML/CSS/SVG en dos lugares:

1. `_renderCrucesReadOnly` — estado "listo para aprobar" (equipos + info de grupo)
2. `_renderEsquemaEnCurso` — copa en curso (equipos + resultados + ganadores resaltados)

El modo edición (selectores de E4b) NO cambia. La tabla de clasificados (acordeón) tampoco cambia.

**Archivos que cambian**: `src/admin/copas/statusView.js` + `style.css`

---

## 1. CSS a agregar al final de `style.css`

```css
/* ── Bracket de copas ── */
.sbracket {
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding: 8px 0;
}

.sbracket-col {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  flex-shrink: 0;
}

.sbracket-lines {
  width: 24px;
  flex-shrink: 0;
}

.sb-match {
  margin: 4px 0;
  flex-shrink: 0;
}

.sb-label {
  font-size: 10px;
  color: #9ca3af;
  text-align: center;
  margin-bottom: 2px;
  font-weight: 600;
  text-transform: uppercase;
}

.sb-teams {
  display: flex;
  flex-direction: column;
}

.sb-team {
  font-size: 11px;
  padding: 4px 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 150px;
}
.sb-teams .sb-team:first-child {
  border-bottom: none;
  border-radius: 5px 5px 0 0;
}
.sb-teams .sb-team:last-child {
  border-radius: 0 0 5px 5px;
}
.sb-team.sb-winner {
  font-weight: 600;
  background: #f0fdf4;
}
.sb-team.sb-pending {
  color: #9ca3af;
  font-style: italic;
}
.sb-team.sb-endogeno {
  border-left: 2px solid #f59e0b;
}

.sb-result {
  font-size: 10px;
  color: #6b7280;
  text-align: center;
  margin-top: 2px;
}

.sb-trophy {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  width: 40px;
  flex-shrink: 0;
  align-self: center;
}
```

---

## 2. Nuevas funciones en `statusView.js`

Agregar las 5 funciones antes del bloque `// Helpers`.

### `_normalizarCrucesParaBracket`

```js
function _normalizarCrucesParaBracket(cruces) {
  return (cruces || []).map(c => ({
    ronda:    c.ronda,
    orden:    c.orden || 0,
    teamA:    c.parejaA ? {
      nombre:  c.parejaA.nombre,
      detalle: c.parejaA.grupoNombre
        ? `${c.parejaA.grupoNombre} ${c.parejaA.posicion_en_grupo || '?'}°`
        : null,
      winner: false
    } : null,
    teamB:    c.parejaB ? {
      nombre:  c.parejaB.nombre,
      detalle: c.parejaB.grupoNombre
        ? `${c.parejaB.grupoNombre} ${c.parejaB.posicion_en_grupo || '?'}°`
        : null,
      winner: false
    } : null,
    resultado: null,
    endogeno:  c.endogeno || false
  }));
}
```

### `_normalizarPartidosParaBracket`

```js
function _normalizarPartidosParaBracket(partidos) {
  return (partidos || []).map(p => {
    const hayResultado = p.sets_a !== null && p.sets_b !== null;
    return {
      ronda:    p.ronda_copa,
      orden:    p.orden_copa || 0,
      teamA:    p.pareja_a ? {
        nombre:  p.pareja_a.nombre,
        detalle: null,
        winner:  hayResultado && p.sets_a > p.sets_b
      } : null,
      teamB:    p.pareja_b ? {
        nombre:  p.pareja_b.nombre,
        detalle: null,
        winner:  hayResultado && p.sets_b > p.sets_a
      } : null,
      resultado: hayResultado ? formatearResultado(p, { incluirSTB: true }) : null,
      endogeno:  false
    };
  });
}
```

### `_renderBracketMatch`

```js
function _renderBracketMatch(m) {
  const needsNumber = !['F', 'direct', '3P'].includes(m.ronda);
  const rondaLabel  = labelRonda(m.ronda, true) + (needsNumber && m.orden ? ` ${m.orden}` : '');

  const renderTeam = (team, isWinner) => {
    if (!team) {
      return `<div class="sb-team sb-pending">⏳ pendiente</div>`;
    }
    const detalleHtml = team.detalle
      ? ` <span style="color:#9ca3af; font-size:10px;">(${_esc(team.detalle)})</span>`
      : '';
    const cls = ['sb-team'];
    if (isWinner)   cls.push('sb-winner');
    if (m.endogeno) cls.push('sb-endogeno');
    return `<div class="${cls.join(' ')}">${_esc(team.nombre)}${detalleHtml}</div>`;
  };

  const resultHtml = m.resultado
    ? `<div class="sb-result">${_esc(m.resultado)}</div>`
    : '';

  const endogenoWarn = m.endogeno
    ? `<div style="font-size:10px; color:#d97706; margin-top:2px;">⚠️ mismo grupo</div>`
    : '';

  return `
    <div class="sb-match">
      <div class="sb-label">${_esc(rondaLabel)}</div>
      <div class="sb-teams">
        ${renderTeam(m.teamA, m.teamA?.winner)}
        ${renderTeam(m.teamB, m.teamB?.winner)}
      </div>
      ${resultHtml}
      ${endogenoWarn}
    </div>
  `;
}
```

### `_renderBracketConnector`

Las líneas SVG usan coordenadas en porcentaje para que se alineen con los centros de los matches,
que con `justify-content: space-around` quedan en `(2i+1)/(2N) × 100%`.

```js
function _renderBracketConnector(inputCount) {
  const N     = inputCount;
  const pairs = N / 2;
  const lines = [];

  for (let p = 0; p < pairs; p++) {
    const topY = `${((4 * p + 1) / (2 * N)) * 100}%`;
    const botY = `${((4 * p + 3) / (2 * N)) * 100}%`;
    const midY = `${((4 * p + 2) / (2 * N)) * 100}%`;
    lines.push(
      `<line x1="0" y1="${topY}" x2="50%" y2="${topY}" stroke="#d1d5db" stroke-width="1"/>`,
      `<line x1="0" y1="${botY}" x2="50%" y2="${botY}" stroke="#d1d5db" stroke-width="1"/>`,
      `<line x1="50%" y1="${topY}" x2="50%" y2="${botY}" stroke="#d1d5db" stroke-width="1"/>`,
      `<line x1="50%" y1="${midY}" x2="100%" y2="${midY}" stroke="#d1d5db" stroke-width="1"/>`
    );
  }

  return `
    <div class="sbracket-lines">
      <svg width="100%" height="100%" preserveAspectRatio="none"
           style="display:block; height:100%;">
        ${lines.join('\n        ')}
      </svg>
    </div>
  `;
}
```

### `_renderBracket`

Agrupa matches por ronda, agrega rondas futuras como placeholders, genera columnas + conectores SVG.

Rounds soportados en orden: `QF → SF → direct → F`. El partido `3P` (tercer puesto) se muestra debajo.

```js
function _renderBracket(matches) {
  if (!matches?.length) {
    return '<p style="font-size:13px; color:var(--muted);">Sin cruces calculados.</p>';
  }

  // Agrupar por ronda y ordenar por orden
  const byRound = {};
  for (const m of matches) {
    if (!byRound[m.ronda]) byRound[m.ronda] = [];
    byRound[m.ronda].push(m);
  }
  for (const arr of Object.values(byRound)) {
    arr.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }

  // Agregar rondas futuras como placeholders (equipos null → "⏳ pendiente")
  const addPlaceholder = (ronda, count) => {
    if (!byRound[ronda]) {
      byRound[ronda] = Array.from({ length: count }, (_, i) => ({
        ronda, orden: i + 1, teamA: null, teamB: null, resultado: null, endogeno: false
      }));
    }
  };
  if (byRound['QF'] && !byRound['SF']) addPlaceholder('SF', byRound['QF'].length / 2);
  if ((byRound['QF'] || byRound['SF']) && !byRound['F']) addPlaceholder('F', 1);
  // direct: no necesita placeholder

  const has3P = !!byRound['3P'];

  const ROUND_ORDER = ['QF', 'SF', 'direct', 'F'];
  const rounds = ROUND_ORDER.filter(r => byRound[r]);

  if (!rounds.length) {
    return '<p style="font-size:13px; color:var(--muted);">Sin cruces calculados.</p>';
  }

  let html = '<div class="sbracket">';
  for (let i = 0; i < rounds.length; i++) {
    const ronda        = rounds[i];
    const roundMatches = byRound[ronda];

    html += `<div class="sbracket-col">`;
    html += roundMatches.map(m => _renderBracketMatch(m)).join('');
    html += `</div>`;

    if (i < rounds.length - 1) {
      html += _renderBracketConnector(roundMatches.length);
    }
  }
  html += `<div class="sb-trophy">🏆</div>`;
  html += `</div>`;

  if (has3P) {
    const m3p = byRound['3P'][0];
    html += `
      <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);">
        <div style="font-size:11px; color:var(--muted); margin-bottom:4px; font-weight:600;">3ER PUESTO</div>
        ${_renderBracketMatch(m3p)}
      </div>
    `;
  }

  return html;
}
```

---

## 3. Modificaciones a funciones existentes

### `_renderCrucesReadOnly` — un cambio de línea

Reemplazar `${_renderCruces(cruces)}` por `${_renderBracket(_normalizarCrucesParaBracket(cruces))}`.

Línea exacta a cambiar (actualmente línea 167):
```js
// ANTES:
${_renderCruces(cruces)}

// DESPUÉS:
${_renderBracket(_normalizarCrucesParaBracket(cruces))}
```

### `_renderEsquemaEnCurso` — reemplazar body completo

```js
function _renderEsquemaEnCurso(esq, copa, partidos) {
  const semis   = partidos.filter(p => p.ronda_copa === 'SF');
  const final   = partidos.find(p => p.ronda_copa === 'F');
  const directo = partidos.find(p => p.ronda_copa === 'direct');

  const semisConfirmadas = semis.filter(s => s.estado === 'confirmado').length;
  const pendFinal = semis.length >= 2 && semisConfirmadas === semis.length && !final && !directo;
  const autoFinalHint = pendFinal
    ? `<p style="font-size:12px; color:var(--muted); margin-top:8px;">
         → Final se generará automáticamente al confirmar semis
       </p>`
    : '';

  return `
    <div class="copa-seccion" data-esquema-id="${esq.id}"
         style="border:1px solid var(--border,#e5e7eb); border-radius:12px;
                padding:12px 14px; margin-bottom:10px; background:var(--surface,#fff);">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <strong>${_esc(esq.nombre)}</strong>
        <span style="font-size:12px; color:#16a34a;">✅ En curso</span>
      </div>
      ${_renderBracket(_normalizarPartidosParaBracket(partidos))}
      ${autoFinalHint}
    </div>
  `;
}
```

---

## 4. Función a eliminar

Eliminar la función `_renderCruces` completa (bloque `// Render: lista de cruces`). Ya no la llama nadie.

---

## 5. Cleanup

Eliminar los archivos de prototipo:
- `public/proto-bracket.html`
- `docs/proto-bracket.html`

---

## Pasos finales obligatorios

1. `npm run build` — verificar que compila sin errores
2. Actualizar `docs/brainstorming-proximas-mejoras.md`: agregar **E4-bracket ✅** (Bracket gráfico) al ítem "Copa Approval v2" después de "E4b ✅"
3. `npm version patch` y `git push --follow-tags`

---

## Verificación

### Estado "por aprobar"
1. Admin → Tab Copas con grupos completos y sin copa creada
2. **4 equipos (SF→F)**: dos columnas — SF con nombres + grupo `(A 1°)`, Final con `⏳ pendiente`, 🏆
3. **8 equipos (QF→SF→F)**: tres columnas — QF con nombres, SF y Final con `⏳ pendiente`, 🏆
4. **2 equipos (direct)**: una columna — partido directo + 🏆
5. Líneas SVG conectoras visibles y alineadas con los matches
6. Si hay endógenos: borde izquierdo amarillo en los teams + `⚠️ mismo grupo` debajo del match
7. En mobile (375px): 4 equipos entra sin scroll; 8 equipos hace scroll horizontal suave

### Estado "en curso"
8. Aprobar copa → bracket muestra partidos existentes + placeholders para rondas futuras
9. Si un partido tiene resultado: ganador en **negrita + fondo verde**, perdedor normal
10. Rondas no generadas aún: aparecen como `⏳ pendiente`
11. Si hay 3P: sección separada debajo del bracket

### Modo edición (sin cambios)
12. "✏️ Editar cruces" → sigue mostrando selectores en lista (no cambia)
13. "↩ Volver a sugeridos" → vuelve al bracket gráfico
