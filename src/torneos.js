/**
 * Entry point para torneos.html — Administración del sistema
 * Gestión de torneos: crear, activar, finalizar
 */

import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './auth/adminGuard.js';
import { injectVersion } from './utils/version.js';
import { invalidarCacheTorneo } from './utils/torneoActivo.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const listEl = document.getElementById('torneos-list');
const statusEl = document.getElementById('torneos-status');

function setStatus(txt) {
  if (statusEl) statusEl.textContent = txt;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Auto-slug desde nombre
const nombreInput = document.getElementById('torneo-nombre');
const slugInput = document.getElementById('torneo-slug');
let slugManual = false;

slugInput?.addEventListener('input', () => { slugManual = true; });
nombreInput?.addEventListener('input', () => {
  if (!slugManual && slugInput) {
    slugInput.value = slugify(nombreInput.value);
  }
});

const ESTADO_CONFIG = {
  borrador:   { label: 'Borrador',   color: '#6b7280', bg: '#f3f4f6' },
  activo:     { label: 'Activo',     color: '#16a34a', bg: '#dcfce7' },
  finalizado: { label: 'Finalizado', color: '#d97706', bg: '#fef3c7' },
};

function estadoBadge(estado) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.borrador;
  return `<span style="display:inline-block; padding:2px 10px; border-radius:12px; font-size:12px; font-weight:600; color:${cfg.color}; background:${cfg.bg};">${cfg.label}</span>`;
}

function formatFecha(fecha) {
  if (!fecha) return '';
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderTorneos(torneos) {
  if (!listEl) return;

  if (!torneos.length) {
    listEl.innerHTML = '<p style="color:var(--muted); text-align:center; padding:2rem;">No hay torneos. Crea el primero.</p>';
    return;
  }

  const html = torneos.map(t => {
    const acciones = renderAcciones(t, torneos);
    const info = [
      t.fecha ? formatFecha(t.fecha) : null,
      t.duracion || null,
      t.ubicacion_nombre || null,
    ].filter(Boolean).join(' · ');

    return `
      <div class="admin-grupo" style="margin-bottom:12px; padding:14px 16px;" data-torneo-id="${t.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap;">
          <div style="flex:1; min-width:200px;">
            <div style="font-weight:700; font-size:16px; margin-bottom:4px;">
              ${t.nombre} ${estadoBadge(t.estado)}
            </div>
            ${t.slug ? `<div style="font-size:12px; color:var(--muted); font-family:monospace;">/${t.slug}</div>` : ''}
            ${info ? `<div style="font-size:13px; color:var(--muted); margin-top:4px;">${info}</div>` : ''}
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${acciones}
          </div>
        </div>
      </div>
    `;
  }).join('');

  listEl.innerHTML = html;

  // Wire buttons
  listEl.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.id));
  });
}

function renderAcciones(torneo, todos) {
  const btns = [];
  const btnStyle = 'padding:6px 12px; font-size:13px; border-radius:6px; border:1px solid var(--border); background:var(--card); cursor:pointer; white-space:nowrap;';

  if (torneo.estado === 'borrador') {
    btns.push(`<button data-action="activar" data-id="${torneo.id}" style="${btnStyle} color:var(--success); border-color:var(--success);">Activar</button>`);
    btns.push(`<button data-action="eliminar" data-id="${torneo.id}" style="${btnStyle} color:var(--danger); border-color:var(--danger);">Eliminar</button>`);
  }
  if (torneo.estado === 'activo') {
    btns.push(`<a href="/admin" style="${btnStyle} display:inline-block; text-decoration:none; color:var(--primary-900); border-color:var(--primary-900);">Ir a Admin</a>`);
    btns.push(`<button data-action="finalizar" data-id="${torneo.id}" style="${btnStyle} color:var(--warning); border-color:var(--warning);">Finalizar</button>`);
    btns.push(`<button data-action="borrador" data-id="${torneo.id}" style="${btnStyle}">A borrador</button>`);
  }
  if (torneo.estado === 'finalizado') {
    btns.push(`<button data-action="activar" data-id="${torneo.id}" style="${btnStyle} color:var(--success); border-color:var(--success);">Activar</button>`);
    btns.push(`<button data-action="borrador" data-id="${torneo.id}" style="${btnStyle}">A borrador</button>`);
  }

  return btns.join('');
}

async function handleAction(action, torneoId) {
  try {
    if (action === 'activar') {
      // Verificar si hay otro torneo activo
      const { data: activo } = await supabase
        .from('torneos')
        .select('id, nombre')
        .eq('estado', 'activo')
        .maybeSingle();

      if (activo && activo.id !== torneoId) {
        if (!confirm(`El torneo "${activo.nombre}" esta activo y pasara a Finalizado. ¿Continuar?`)) return;
        await supabase.from('torneos').update({ estado: 'finalizado' }).eq('id', activo.id);
      }
      await supabase.from('torneos').update({ estado: 'activo' }).eq('id', torneoId);
      invalidarCacheTorneo();

    } else if (action === 'finalizar') {
      if (!confirm('¿Finalizar este torneo? Los jugadores veran "No hay torneo en curso" hasta que actives otro.')) return;
      await supabase.from('torneos').update({ estado: 'finalizado' }).eq('id', torneoId);
      invalidarCacheTorneo();

    } else if (action === 'borrador') {
      await supabase.from('torneos').update({ estado: 'borrador' }).eq('id', torneoId);
      invalidarCacheTorneo();

    } else if (action === 'eliminar') {
      if (!confirm('¿Eliminar este torneo? Esta accion no se puede deshacer.')) return;
      await supabase.from('torneos').delete().eq('id', torneoId);
    }

    await cargarTorneos();
  } catch (err) {
    console.error('Error en accion:', err);
    setStatus('Error: ' + (err.message || err));
  }
}

async function crearTorneo() {
  const nombre = nombreInput?.value.trim();
  if (!nombre) {
    alert('El nombre es obligatorio');
    return;
  }

  const slug = slugInput?.value.trim() || slugify(nombre);
  const fecha = document.getElementById('torneo-fecha')?.value || null;
  const duracion = document.getElementById('torneo-duracion')?.value.trim() || null;
  const ubicacion_nombre = document.getElementById('torneo-ubicacion')?.value.trim() || null;

  const { error } = await supabase.from('torneos').insert({
    nombre,
    slug: slug || null,
    fecha: fecha || null,
    duracion,
    ubicacion_nombre,
    estado: 'borrador',
  });

  if (error) {
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      alert('Ya existe un torneo con ese slug. Elegi otro.');
    } else {
      console.error(error);
      alert('Error creando torneo: ' + error.message);
    }
    return;
  }

  // Limpiar formulario
  if (nombreInput) nombreInput.value = '';
  if (slugInput) { slugInput.value = ''; slugManual = false; }
  document.getElementById('torneo-fecha').value = '';
  document.getElementById('torneo-duracion').value = '';
  document.getElementById('torneo-ubicacion').value = '';
  document.getElementById('crear-torneo-details').removeAttribute('open');

  await cargarTorneos();
}

async function cargarTorneos() {
  setStatus('Cargando...');

  const { data, error } = await supabase
    .from('torneos')
    .select('id, nombre, slug, estado, fecha, duracion, ubicacion_nombre, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    setStatus('Error cargando torneos');
    return;
  }

  renderTorneos(data || []);
  setStatus(`${data?.length || 0} torneo(s) · Actualizado ${new Date().toLocaleTimeString()}`);
}

// Wire crear button
document.getElementById('btn-crear-torneo')?.addEventListener('click', crearTorneo);

// Init
injectVersion();
requireAdmin(supabase, { onReady: () => cargarTorneos() });
