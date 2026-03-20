/**
 * Bracket renderer compartido — genera bracket gráfico SVG para copas.
 * Usado por admin (statusView) y jugador (modalConsulta).
 *
 * Funciones principales:
 * - normalizarPartidosParaBracket(partidos) → matches normalizados
 * - normalizarCrucesParaBracket(cruces) → matches normalizados (para propuestas)
 * - renderBracket(matches, opts?) → HTML string
 */

import { labelRonda } from './copaRondas.js';
import { formatearResultado } from './formatoResultado.js';

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Normaliza cruces (propuestas client-side) al formato de bracket.
 */
export function normalizarCrucesParaBracket(cruces) {
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

/**
 * Normaliza partidos de BD al formato de bracket.
 */
export function normalizarPartidosParaBracket(partidos) {
  return (partidos || []).map(p => {
    const hayResultado = p.sets_a !== null && p.sets_b !== null;
    return {
      ronda:    p.ronda_copa,
      orden:    p.orden_copa || 0,
      teamA:    p.pareja_a ? {
        nombre:  p.pareja_a.nombre,
        id:      p.pareja_a.id,
        detalle: null,
        winner:  hayResultado && p.sets_a > p.sets_b
      } : null,
      teamB:    p.pareja_b ? {
        nombre:  p.pareja_b.nombre,
        id:      p.pareja_b.id,
        detalle: null,
        winner:  hayResultado && p.sets_b > p.sets_a
      } : null,
      resultado: hayResultado ? formatearResultado(p, { incluirSTB: true }) : null,
      endogeno:  false,
      estado:   p.estado,
      partidoId: p.id,
      copaId:   p.copa_id
    };
  });
}

/**
 * Renderiza un match individual del bracket.
 * @param {Object} m - Match normalizado
 * @param {Object} opts - Opciones: { showConfirmButton, highlightParejaId }
 */
function renderBracketMatch(m, opts = {}) {
  const needsNumber = !['F', 'direct', '3P'].includes(m.ronda);
  const rondaLabel  = labelRonda(m.ronda, true) + (needsNumber && m.orden ? ` ${m.orden}` : '');
  const highlightId = opts.highlightParejaId;

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
    if (highlightId && team.id === highlightId) cls.push('sb-highlight');
    return `<div class="${cls.join(' ')}">${_esc(team.nombre)}${detalleHtml}</div>`;
  };

  const resultHtml = m.resultado
    ? `<div class="sb-result">${_esc(m.resultado)}</div>`
    : '';

  const endogenoWarn = m.endogeno
    ? `<div style="font-size:10px; color:#d97706; margin-top:2px;">⚠️ mismo grupo</div>`
    : '';

  const confirmarHtml = opts.showConfirmButton && m.estado === 'a_confirmar' && m.partidoId
    ? `<button type="button" class="btn-confirmar-partido btn-sm"
         data-partido-id="${m.partidoId}" data-copa-id="${m.copaId || ''}"
         style="margin-top:4px; font-size:11px; padding:3px 8px; background:#16a34a; color:#fff; border:none; border-radius:6px; cursor:pointer;">
         ✅ Confirmar resultado
       </button>`
    : '';

  return `
    <div class="sb-match">
      <div class="sb-label">${_esc(rondaLabel)}</div>
      <div class="sb-teams">
        ${renderTeam(m.teamA, m.teamA?.winner)}
        ${renderTeam(m.teamB, m.teamB?.winner)}
      </div>
      ${resultHtml}
      ${confirmarHtml}
      ${endogenoWarn}
    </div>
  `;
}

/**
 * Renderiza conectores SVG entre rondas del bracket.
 */
function renderBracketConnector(inputCount) {
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

/**
 * Renderiza el bracket completo.
 * @param {Array} matches - Matches normalizados
 * @param {Object} opts - Opciones: { showConfirmButton, highlightParejaId }
 * @returns {string} HTML string
 */
export function renderBracket(matches, opts = {}) {
  if (!matches?.length) {
    return '<p style="font-size:13px; color:var(--muted);">Sin cruces calculados.</p>';
  }

  const byRound = {};
  for (const m of matches) {
    if (!byRound[m.ronda]) byRound[m.ronda] = [];
    byRound[m.ronda].push(m);
  }
  for (const arr of Object.values(byRound)) {
    arr.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }

  const addPlaceholder = (ronda, count) => {
    if (!byRound[ronda]) {
      byRound[ronda] = Array.from({ length: count }, (_, i) => ({
        ronda, orden: i + 1, teamA: null, teamB: null, resultado: null, endogeno: false
      }));
    }
  };
  if (byRound['QF'] && !byRound['SF']) addPlaceholder('SF', byRound['QF'].length / 2);
  if ((byRound['QF'] || byRound['SF']) && !byRound['F']) addPlaceholder('F', 1);

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
    html += roundMatches.map(m => renderBracketMatch(m, opts)).join('');
    html += `</div>`;

    if (i < rounds.length - 1) {
      html += renderBracketConnector(roundMatches.length);
    }
  }
  html += `<div class="sb-trophy">🏆</div>`;
  html += `</div>`;

  if (has3P) {
    const m3p = byRound['3P'][0];
    html += `
      <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);">
        <div style="font-size:11px; color:var(--muted); margin-bottom:4px; font-weight:600;">3ER PUESTO</div>
        ${renderBracketMatch(m3p, opts)}
      </div>
    `;
  }

  return html;
}
