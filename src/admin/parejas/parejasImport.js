import { supabase, TORNEO_ID, logMsg, el } from '../context.js';

function normGroup(raw) {
  let g = String(raw ?? '').trim();
  if (!g) return null;

  g = g.replace(/^grupo\s+/i, '').trim(); // acepta "Grupo A"
  g = g.toUpperCase();

  // si te pegan "a" o "A" o "A "
  if (g.length === 1 && g >= 'A' && g <= 'Z') return g;

  // si te pegan cosas tipo "A)" o "A-" o "A:"
  const m = g.match(/^([A-Z])\b/);
  return m ? m[1] : null;
}

function normNombrePareja(raw) {
  let s = String(raw ?? '').trim();
  // normaliza espacios alrededor del guion
  s = s.replace(/\s*-\s*/g, ' - ');
  // colapsa espacios repetidos
  s = s.replace(/\s+/g, ' ');
  return s;
}

function parsePaste(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const rows = [];
  const errors = [];

  lines.forEach((line, idx) => {
    // preferimos TAB (Excel). Si no hay TAB, tratamos "último token = grupo"
    let parts = line.split('\t');

    if (parts.length < 2) {
      // fallback: separo por 2+ espacios
      parts = line.split(/\s{2,}/);
    }

    if (parts.length < 2) {
      // fallback 2: ".... <espacio> a"
      const m = line.match(/^(.*)\s+([A-Za-z])$/);
      if (m) parts = [m[1], m[2]];
    }

    if (parts.length < 2) {
      errors.push(`Línea ${idx + 1}: no encuentro TAB o columna Grupo -> "${line}"`);
      return;
    }

    const parejaRaw = parts[0];
    const grupoRaw = parts[1];

    const nombre = normNombrePareja(parejaRaw);
    const grupo = normGroup(grupoRaw);

    if (!nombre) errors.push(`Línea ${idx + 1}: pareja vacía`);
    if (!grupo) errors.push(`Línea ${idx + 1}: grupo inválido ("${grupoRaw}")`);

    if (nombre && grupo) rows.push({ nombre, grupo, _line: idx + 1 });
  });

  // validaciones livianas (no queremos policía, queremos salvarte de tiros en el pie)
  const dup = new Map();
  rows.forEach(r => {
    const key = r.nombre.toUpperCase();
    dup.set(key, (dup.get(key) ?? 0) + 1);
  });
  for (const [k, n] of dup.entries()) {
    if (n > 1) errors.push(`Pareja duplicada: "${k}" (aparece ${n} veces)`);
  }

  return { ok: errors.length === 0, rows, errors };
}

function groupSort(a, b) {
  return String(a).localeCompare(String(b));
}

function renderPreview(outEl, parsed) {
  outEl.innerHTML = '';

  if (!parsed.ok) {
    const ul = el('ul');
    parsed.errors.forEach(e => ul.appendChild(el('li', {}, e)));
    outEl.appendChild(el('div', { style: 'padding:10px; border:1px solid #933; background:#2a1212; border-radius:10px;' },
      '<b>Errores en el pegado</b>'
    ));
    outEl.appendChild(ul);
    return;
  }

  const groups = [...new Set(parsed.rows.map(r => r.grupo))].sort(groupSort);

  const info = el('div', { style: 'padding:10px; border:1px solid #2a6; background:#102a16; border-radius:10px;' },
    `<b>OK</b> · ${parsed.rows.length} parejas · ${groups.length} grupos (${groups.join(', ')})`
  );
  outEl.appendChild(info);

  // tabla simple
  const table = el('table', { style: 'width:100%; margin-top:10px; border-collapse:collapse;' });
  table.innerHTML = `
    <thead>
      <tr>
        <th style="text-align:left; border-bottom:1px solid #333; padding:6px;">Grupo</th>
        <th style="text-align:left; border-bottom:1px solid #333; padding:6px;">Pareja</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tb = table.querySelector('tbody');

  const ordered = [];
  for (const g of groups) {
    parsed.rows.filter(r => r.grupo === g).forEach(r => ordered.push(r));
  }

  ordered.forEach(r => {
    const tr = el('tr');
    tr.innerHTML = `
      <td style="padding:6px; border-bottom:1px solid #222;"><b>${r.grupo}</b></td>
      <td style="padding:6px; border-bottom:1px solid #222;">${r.nombre}</td>
    `;
    tb.appendChild(tr);
  });

  outEl.appendChild(table);
}

async function fetchEstadoActual() {
  const { data: grupos, error: eg } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (eg) return { ok: false, msg: 'Error leyendo grupos', grupos: [], parejas: [] };

  const { data: parejas, error: ep } = await supabase
    .from('parejas')
    .select('id, nombre, orden')
    .eq('torneo_id', TORNEO_ID)
    .order('orden');

  if (ep) return { ok: false, msg: 'Error leyendo parejas', grupos: grupos ?? [], parejas: [] };

  return { ok: true, grupos: grupos ?? [], parejas: parejas ?? [] };
}

function renderEstadoActual(outEl, estado) {
  outEl.appendChild(el('hr'));

  if (!estado.ok) {
    outEl.appendChild(el('div', { style: 'opacity:.9;' }, `Estado actual: ${estado.msg}`));
    return;
  }

  outEl.appendChild(el('div', { style: 'opacity:.9; margin:6px 0;' },
    `Estado actual en DB: ${estado.parejas.length} parejas · ${estado.grupos.length} grupos`
  ));

  if (!estado.grupos.length || !estado.parejas.length) return;

  const parejasPorGrupo =
    estado.grupos.length ? (estado.parejas.length / estado.grupos.length) : 0;

  if (!Number.isInteger(parejasPorGrupo)) {
    outEl.appendChild(el('div', { style: 'color:#f88;' },
      `⚠️ No se puede “cortar” parejas por grupo: ${estado.parejas.length}/${estado.grupos.length} no da entero`
    ));
    return;
  }

  let cursor = 0;
  for (const g of estado.grupos) {
    const slice = estado.parejas.slice(cursor, cursor + parejasPorGrupo);
    cursor += parejasPorGrupo;

    const card = el('div', { style: 'margin-top:10px; padding:10px; border:1px solid #333; border-radius:10px;' });
    card.appendChild(el('div', { style: 'font-weight:700; margin-bottom:6px;' }, `Grupo ${g.nombre}`));

    const ul = el('ul', { style: 'margin:0; padding-left:18px;' });
    slice.forEach(p => ul.appendChild(el('li', {}, `${p.orden}. ${p.nombre}`)));
    card.appendChild(ul);
    outEl.appendChild(card);
  }
}

async function borrarTodoTorneo() {
  // orden importante por FKs
  const steps = [
    { table: 'partidos', msg: '🧹 Eliminando partidos…' },
    { table: 'copas', msg: '🧹 Eliminando copas…' },
    { table: 'posiciones_manual', msg: '🧹 Eliminando overrides…' },
    { table: 'parejas', msg: '🧹 Eliminando parejas…' },
    { table: 'grupos', msg: '🧹 Eliminando grupos…' }
  ];

  for (const s of steps) {
    logMsg(s.msg);
    const { error } = await supabase.from(s.table).delete().eq('torneo_id', TORNEO_ID);
    if (error) {
      console.error(error);
      logMsg(`❌ Error eliminando ${s.table} (ver consola)`);
      return false;
    }
  }

  logMsg('✅ Limpieza completa');
  return true;
}

async function crearGruposYparejas(parsed) {
  const groups = [...new Set(parsed.rows.map(r => r.grupo))].sort(groupSort);

  logMsg(`➕ Creando grupos: ${groups.join(', ')}`);
  const { error: eg } = await supabase
    .from('grupos')
    .insert(groups.map(nombre => ({ torneo_id: TORNEO_ID, nombre })));

  if (eg) {
    console.error(eg);
    logMsg('❌ Error creando grupos (ver consola)');
    return false;
  }

  // parejas en orden determinístico: A..D, respetando orden dentro del grupo
  const ordered = [];
  for (const g of groups) {
    parsed.rows.filter(r => r.grupo === g).forEach(r => ordered.push(r));
  }

  const payload = ordered.map((r, i) => ({
    torneo_id: TORNEO_ID,
    nombre: r.nombre,
    orden: i + 1
  }));

  logMsg(`➕ Creando parejas: ${payload.length}`);
  const { error: ep } = await supabase.from('parejas').insert(payload);

  if (ep) {
    console.error(ep);
    logMsg('❌ Error creando parejas (ver consola)');
    return false;
  }

  logMsg('✅ Grupos y parejas creados');
  return true;
}

export function initParejasImport() {
  const root = document.getElementById('parejas-admin');
  if (!root) return;

  const ta = document.getElementById('parejas-paste');
  const btnPrev = document.getElementById('parejas-preview');
  const btnImp = document.getElementById('parejas-import');
  const out = document.getElementById('parejas-preview-out');

  let lastParsed = null;

  btnPrev?.addEventListener('click', async () => {
    out.innerHTML = '';
    lastParsed = parsePaste(ta?.value ?? '');
    renderPreview(out, lastParsed);

    btnImp.disabled = !(lastParsed && lastParsed.ok && lastParsed.rows.length >= 2);

    const estado = await fetchEstadoActual();
    renderEstadoActual(out, estado);
  });

  btnImp?.addEventListener('click', async () => {
    if (!lastParsed?.ok) return;

    const ok = confirm(
      'IMPORTANTE:\n' +
      'Esto borra y recrea TODO para el torneo actual:\n' +
      '- partidos\n- copas\n- overrides\n- grupos\n- parejas\n\n' +
      '¿Seguro?'
    );
    if (!ok) return;

    const okDel = await borrarTodoTorneo();
    if (!okDel) return;

    const okIns = await crearGruposYparejas(lastParsed);
    if (!okIns) return;

    // refresco rápido
    const estado = await fetchEstadoActual();
    out.innerHTML = '';
    out.appendChild(el('div', { style: 'padding:10px; border:1px solid #2a6; background:#102a16; border-radius:10px;' },
      '<b>Import terminado.</b> Ahora podés ir a “Generar partidos de grupos”.'
    ));
    renderEstadoActual(out, estado);

    // Para evitar UI vieja en admin (posiciones/copas renderizadas antes del import)
    setTimeout(() => window.location.reload(), 400);
  });
}
