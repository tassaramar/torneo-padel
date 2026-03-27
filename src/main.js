import { supabase, TORNEO_ID, initTorneo } from './carga/context.js';
import { injectVersion } from './utils/version.js';
import { initCargaLayout, wireModoToggle, pintarModoToggle, actualizarCounters } from './carga/layout.js';
import { cargarPartidosGrupos } from './carga/partidosGrupos.js';
import { cargarPosiciones } from './carga/posiciones.js';
import { cargarCopas } from './carga/copas.js';
import { initSearchUI, applySearchToPartidos } from './carga/search.js';

console.log('MAIN DE VITE (carga)');

function initCarga() {
  const dom = initCargaLayout();

  function aplicarFiltro() {
    applySearchToPartidos({ listCont: dom.listCont, msgCont: dom.msgCont });
  }

  async function refreshPartidosYCopas() {
    await cargarPartidosGrupos({
      supabase,
      torneoId: TORNEO_ID,
      msgCont: dom.msgCont,
      listCont: dom.listCont,
      onAfterSave: refreshAfterGroupSave
    });

    aplicarFiltro();

    await cargarCopas({
      supabase,
      torneoId: TORNEO_ID,
      copasCont: dom.copasCont,
      onAfterSave: refreshCopasOnly
    });

    actualizarCounters(supabase, dom, TORNEO_ID);
  }

  async function refreshAfterGroupSave() {
    await cargarPartidosGrupos({
      supabase,
      torneoId: TORNEO_ID,
      msgCont: dom.msgCont,
      listCont: dom.listCont,
      onAfterSave: refreshAfterGroupSave
    });

    aplicarFiltro();

    await cargarPosiciones({
      supabase,
      torneoId: TORNEO_ID,
      posicionesCont: dom.posicionesCont
    });

    actualizarCounters(supabase, dom, TORNEO_ID);
  }

  async function refreshCopasOnly() {
    await cargarCopas({
      supabase,
      torneoId: TORNEO_ID,
      copasCont: dom.copasCont,
      onAfterSave: refreshCopasOnly
    });

    actualizarCounters(supabase, dom, TORNEO_ID);
  }

  async function init() {
    await initTorneo();
    pintarModoToggle(dom);

    initSearchUI({
      input: dom.searchInput,
      clearBtn: dom.searchClearBtn,
      onChange: aplicarFiltro
    });

    wireModoToggle(dom, async () => {
      pintarModoToggle(dom);
      await refreshPartidosYCopas();
    });

    await refreshPartidosYCopas();

    await cargarPosiciones({
      supabase,
      torneoId: TORNEO_ID,
      posicionesCont: dom.posicionesCont
    });

    aplicarFiltro();
  }

  init();
}

injectVersion();
initCarga();
