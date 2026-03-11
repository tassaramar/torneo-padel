const seedCases = [
  {
    id: 'P17',
    rival: 'Verde Norte',
    ronda: 'R2',
    cancha: 'C3',
    estado: 'Pendiente',
    badge: 'Turno medio',
    horario: '19:10',
    nota: 'Pelota nueva. Confirmar marcador apenas termine.',
    score: 'Sin cargar',
    codigoInterno: 'A17-480',
    arbitro: 'Lia',
    color: 'Verde salvia',
    contexto: 'La pareja rival pidio jugar rapido si se libera la cancha 3.'
  },
  {
    id: 'P71',
    rival: 'Verde Sur',
    ronda: 'R2',
    cancha: 'C4',
    estado: 'Pendiente',
    badge: 'Turno medio',
    horario: '19:14',
    nota: 'Pelota semi nueva. Revisar si la red ya fue ajustada.',
    score: 'Sin cargar',
    codigoInterno: 'A71-408',
    arbitro: 'Mia',
    color: 'Verde petroleo',
    contexto: 'La pareja rival dijo que podria ir a una cancha libre si se abre antes.'
  },
  {
    id: 'P19',
    rival: 'Azul Norte',
    ronda: 'R3',
    cancha: 'C3',
    estado: 'Por confirmar',
    badge: 'Atencion',
    horario: '19:32',
    nota: 'Una pareja ya cargo resultado. La otra todavia no respondio.',
    score: '6-4 3-6 6-2',
    codigoInterno: 'B19-512',
    arbitro: 'Simo',
    color: 'Azul acero',
    contexto: 'El resultado aparece consistente, pero falta la validacion rival.'
  },
  {
    id: 'P91',
    rival: 'Azul Sur',
    ronda: 'R3',
    cancha: 'C4',
    estado: 'En revision',
    badge: 'Conflicto',
    horario: '19:36',
    nota: 'Las dos parejas cargaron resultados distintos.',
    score: '6-3 4-6 7-5',
    codigoInterno: 'B91-521',
    arbitro: 'Santi',
    color: 'Azul tinta',
    contexto: 'Hay una nota pidiendo revisar si el ultimo set fue 7-5 o 7-6.'
  }
];

const actionConfig = {
  Pendiente: [
    { id: 'cargar', label: 'Cargar resultado', className: 'btn-primary' },
    { id: 'marcar', label: 'Marcar en juego', className: 'btn-ghost' }
  ],
  'Por confirmar': [
    { id: 'confirmar', label: 'Confirmar', className: 'btn-primary' },
    { id: 'disputar', label: 'Disputar', className: 'btn-danger' }
  ],
  'En revision': [
    { id: 'aceptar', label: 'Aceptar resultado', className: 'btn-primary' },
    { id: 'recargar', label: 'Recargar mi version', className: 'btn-secondary' }
  ],
  Confirmado: [
    { id: 'resetear', label: 'Reabrir caso', className: 'btn-ghost' }
  ],
  'En juego': [
    { id: 'cargar', label: 'Cargar resultado', className: 'btn-primary' },
    { id: 'resetear', label: 'Volver a pendiente', className: 'btn-ghost' }
  ]
};

const state = {
  cases: structuredClone(seedCases),
  selectedId: 'P17',
  log: [
    {
      title: 'Escenario inicial listo',
      meta: 'Todos los cambios se ven solo en esta interfaz. No hay backend ni sesiones separadas.'
    }
  ]
};

const listEl = document.getElementById('cases-list');
const detailEl = document.getElementById('case-detail');
const helperEl = document.getElementById('detail-helper');
const logEl = document.getElementById('activity-log');
const resetBtn = document.getElementById('reset-lab');

function getCaseById(id) {
  return state.cases.find((item) => item.id === id);
}

function getStatusClass(status) {
  if (status === 'Pendiente' || status === 'En juego') return 'chip-pending';
  if (status === 'Por confirmar') return 'chip-confirm';
  if (status === 'En revision') return 'chip-review';
  return 'chip-done';
}

function addLog(title, meta) {
  state.log.unshift({ title, meta });
  state.log = state.log.slice(0, 8);
}

function updateCase(id, updater) {
  state.cases = state.cases.map((item) => {
    if (item.id !== id) return item;
    return { ...item, ...updater(item) };
  });
}

function handleAction(caseId, actionId) {
  const item = getCaseById(caseId);
  if (!item) return;

  if (actionId === 'cargar') {
    updateCase(caseId, () => ({
      estado: 'Por confirmar',
      score: caseId === 'P17' ? '6-4 3-6 6-2' : '7-5 4-6 6-4',
      nota: 'Resultado cargado. Ahora la otra pareja debe confirmar o corregir.',
      contexto: 'La interfaz muestra un estado intermedio para que otro actor decida.'
    }));
    addLog(`${caseId} -> resultado cargado`, 'El partido paso a "Por confirmar" y ahora expone un score visible.');
  }

  if (actionId === 'marcar') {
    updateCase(caseId, () => ({
      estado: 'En juego',
      nota: 'El partido fue marcado en juego. Todavia no hay resultado definitivo.',
      contexto: 'La cancha aparece ocupada y el caso sigue esperando una carga.'
    }));
    addLog(`${caseId} -> marcado en juego`, 'El estado cambio visualmente pero no hay score cargado.');
  }

  if (actionId === 'confirmar') {
    updateCase(caseId, () => ({
      estado: 'Confirmado',
      badge: 'Cerrado',
      nota: 'Las dos partes coinciden. El resultado quedo confirmado.',
      contexto: 'Este caso ya no ofrece acciones de disputa desde la vista principal.'
    }));
    addLog(`${caseId} -> resultado confirmado`, 'La vista ahora muestra un cierre verde y quita la tension del caso.');
  }

  if (actionId === 'disputar') {
    updateCase(caseId, () => ({
      estado: 'En revision',
      badge: 'Conflicto',
      nota: 'Se cargo una version distinta del resultado. Hace falta resolverla.',
      contexto: 'La interfaz destaca que hay dos lecturas distintas del mismo partido.'
    }));
    addLog(`${caseId} -> disputa abierta`, 'El partido paso a "En revision" y quedo con mayor urgencia visual.');
  }

  if (actionId === 'aceptar') {
    updateCase(caseId, () => ({
      estado: 'Confirmado',
      badge: 'Cerrado',
      nota: 'Se acepto una de las versiones y el caso quedo resuelto.',
      contexto: 'La disputa desaparecio y el resultado final queda estable.'
    }));
    addLog(`${caseId} -> disputa resuelta`, 'La interfaz ya no muestra conflicto activo.');
  }

  if (actionId === 'recargar') {
    updateCase(caseId, () => ({
      estado: 'En revision',
      score: caseId === 'P91' ? '6-3 4-6 7-6' : '6-4 2-6 6-3',
      nota: 'Se cargo una nueva version del marcador. El conflicto sigue abierto.',
      contexto: 'El caso mantiene el estado conflictivo pero cambia un dato fino del score.'
    }));
    addLog(`${caseId} -> score actualizado en revision`, 'El estado no cambio, pero si cambio el marcador visible.');
  }

  if (actionId === 'resetear') {
    const original = seedCases.find((seed) => seed.id === caseId);
    if (original) {
      updateCase(caseId, () => ({ ...original }));
      addLog(`${caseId} -> restaurado`, 'El caso volvio a su estado inicial para repetir la prueba.');
    }
  }

  render();
}

function renderList() {
  listEl.innerHTML = state.cases.map((item) => `
    <article class="case-card ${item.id === state.selectedId ? 'is-active' : ''}" data-case-id="${item.id}">
      <div class="case-topline">
        <div>
          <div class="case-code">${item.id}</div>
          <div class="case-rival">vs ${item.rival}</div>
        </div>
        <span class="chip ${getStatusClass(item.estado)}">${item.estado}</span>
      </div>
      <div class="case-subline">
        <span class="case-meta-item">${item.ronda}</span>
        <span class="case-meta-item">${item.cancha}</span>
        <span class="case-meta-item">${item.horario}</span>
        <span class="case-meta-item">${item.badge}</span>
      </div>
      <div class="case-note">${item.nota}</div>
    </article>
  `).join('');

  listEl.querySelectorAll('[data-case-id]').forEach((node) => {
    node.addEventListener('click', () => {
      state.selectedId = node.dataset.caseId;
      render();
    });
  });
}

function renderDetail() {
  const item = getCaseById(state.selectedId);
  if (!item) {
    detailEl.className = 'case-detail empty-state';
    detailEl.textContent = 'Todavia no hay ningun partido seleccionado.';
    helperEl.textContent = 'Selecciona un partido para ver su detalle.';
    return;
  }

  helperEl.textContent = `Detalle activo: ${item.id} vs ${item.rival}`;
  detailEl.className = 'case-detail';

  const actions = actionConfig[item.estado] || [];
  const noteTone = item.estado === 'En revision'
    ? 'is-danger'
    : item.estado === 'Confirmado'
      ? 'is-success'
      : 'is-warning';

  detailEl.innerHTML = `
    <article class="detail-card">
      <div class="detail-headline">
        <div>
          <div class="detail-code">${item.id} · ${item.codigoInterno}</div>
          <div class="detail-rival">vs ${item.rival}</div>
          <p class="detail-copy">${item.contexto}</p>
        </div>
        <span class="chip ${getStatusClass(item.estado)}">${item.estado}</span>
      </div>

      <div class="detail-grid">
        <div class="detail-fact">
          <p class="detail-label">Ronda</p>
          <p class="detail-value">${item.ronda}</p>
        </div>
        <div class="detail-fact">
          <p class="detail-label">Cancha</p>
          <p class="detail-value">${item.cancha}</p>
        </div>
        <div class="detail-fact">
          <p class="detail-label">Horario</p>
          <p class="detail-value">${item.horario}</p>
        </div>
        <div class="detail-fact">
          <p class="detail-label">Color guia</p>
          <p class="detail-value">${item.color}</p>
        </div>
        <div class="detail-fact">
          <p class="detail-label">Arbitro</p>
          <p class="detail-value">${item.arbitro}</p>
        </div>
        <div class="detail-fact">
          <p class="detail-label">Score visible</p>
          <p class="detail-value">${item.score}</p>
        </div>
      </div>

      <div class="detail-system-note ${noteTone}">
        ${item.nota}
      </div>

      <div class="detail-actions">
        ${actions.map((action) => `
          <button type="button" class="btn ${action.className}" data-action-id="${action.id}">
            ${action.label}
          </button>
        `).join('')}
      </div>
    </article>
  `;

  detailEl.querySelectorAll('[data-action-id]').forEach((node) => {
    node.addEventListener('click', () => handleAction(item.id, node.dataset.actionId));
  });
}

function renderLog() {
  logEl.innerHTML = state.log.map((entry, index) => `
    <li class="log-item">
      <div class="log-index">${index + 1}</div>
      <div class="log-body">
        <div class="log-title">${entry.title}</div>
        <div class="log-meta">${entry.meta}</div>
      </div>
    </li>
  `).join('');
}

function render() {
  renderList();
  renderDetail();
  renderLog();
}

resetBtn.addEventListener('click', () => {
  state.cases = structuredClone(seedCases);
  state.selectedId = 'P17';
  state.log = [
    {
      title: 'Escenario reiniciado',
      meta: 'Todos los casos volvieron a su estado original para repetir la prueba.'
    }
  ];
  render();
});

render();
