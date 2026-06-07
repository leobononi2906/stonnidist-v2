// ═══════════════════════════════════════════════════════════════
// STONNI ATACADO CRM — crm.js
// ═══════════════════════════════════════════════════════════════

const SUPA_URL = 'https://vishxwdxqiygbxmtpfoy.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpc2h4d2R4cWl5Z2J4bXRwZm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0Njg2MjIsImV4cCI6MjA4ODA0NDYyMn0.J647m3ieDHahNQYBWMRESl0aPFXsT_zt_7ZcDvyB-SA';

// ── Globals injetados pelo index.html ──
// window.sb, window.getUsuario, window.fmt, window.fmtDate, window.setLastUpdate

// ── Estado local ──
let state = {
  mainTab: 'carteira', // 'carteira' | 'prospeccao'
  subFilter: 'todos',  // 'todos' | 'ativo' | 'atencao' | 'em_risco'
  prospSubTab: 'todos',// 'todos' | 'atencao'
  prospSort: 'nome_az',
  search: '',
  selectedId: null,
  selectedCliente: null,
  carteiraData: [],
  prospeccaoData: [],
  drawerOpen: false,
  vendedorId: null,     // filtro de vendedor (null = todos)
  overdueTasks: new Set(),
  umblerpendentes: [],
  notas: [],
  telefones: [],
  pedidos: [],
  vendedores: [],
  dimMap: new Map(),
};

// ── Formatadores ──
function fmt(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}
function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${dt.toLocaleDateString('pt-BR')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
}
function fmtPhone(p) {
  if (!p) return '—';
  const d = p.replace(/\D/g,'');
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return p;
}
function fmtCnpj(v) {
  if (!v) return '—';
  const d = v.replace(/\D/g,'');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');
  return v;
}
function shortName(n) {
  if (!n) return '—';
  const parts = n.trim().split(' ');
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length-1][0]}.`;
}
function daysSince(d) {
  if (!d) return 9999;
  return Math.floor((Date.now() - new Date(d+'T12:00:00').getTime()) / 86400000);
}
function getStatus(c) {
  const dias = c.dias_sem_compra ?? daysSince(c.ultima_compra) ?? 9999;
  if (dias < 30) return 'ATIVO';
  if (dias < 90) return 'ATENCAO';
  if (dias < 180) return 'PERDIDO';
  return 'PROSPECCAO';
}
function statusBadge(s) {
  const map = {
    ATIVO:      ['bg-emerald-500/20 text-emerald-400 border-emerald-500/30','Ativo'],
    ATENCAO:    ['bg-yellow-500/20 text-yellow-400 border-yellow-500/30','Atenção'],
    PERDIDO:    ['bg-red-500/20 text-red-400 border-red-500/30','Em Risco'],
    PROSPECCAO: ['bg-slate-500/20 text-slate-400 border-slate-500/30','Prospecção'],
  };
  const [cls, label] = map[s] || map.PROSPECCAO;
  return `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${cls}">${label}</span>`;
}
function tipoBadge(t) {
  const map = {
    OBSERVACAO: 'bg-blue-500/20 text-blue-400',
    TAREFA:     'bg-yellow-500/20 text-yellow-400',
    FOLLOWUP:   'bg-purple-500/20 text-purple-400',
    LIGACAO:    'bg-emerald-500/20 text-emerald-400',
  };
  return `<span class="rounded-full px-2 py-0.5 text-[10px] font-medium ${map[t]||'bg-slate-500/20 text-slate-400'}">${t}</span>`;
}

// ── Fetch helpers ──
async function sbFetch(table, params = '') {
  const session = await getSess();
  const token = session?.access_token || SUPA_KEY;
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}&limit=9999`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  return r.json();
}
async function sbPost(table, body) {
  const session = await getSess();
  const token = session?.access_token || SUPA_KEY;
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body)
  });
  return r;
}
async function sbPatch(table, id_field, id_val, body) {
  const session = await getSess();
  const token = session?.access_token || SUPA_KEY;
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${id_field}=eq.${encodeURIComponent(id_val)}`, {
    method: 'PATCH',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body)
  });
  return r;
}
async function getSess() {
  const raw = localStorage.getItem('sb-vishxwdxqiygbxmtpfoy-auth-token');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── Toast ──
function toast(msg, type='success') {
  const el = document.createElement('div');
  el.className = `fixed bottom-5 right-5 z-[9999] px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all duration-300 ${
    type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
  }`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2500);
}

// ── INICIALIZAÇÃO ──
async function initCRM() {
  // carrega dados em paralelo
  await Promise.all([
    loadVendedores(),
    loadDimMap(),
  ]);
  await Promise.all([
    loadCarteira(),
    loadProspeccao(),
    loadUmblerPendentes(),
    loadOverdueTasks(),
    loadTodayTasks(),
  ]);
  renderAll();

  // filtro de vendedor — detectar usuário logado
  const sess = await getSess();
  if (sess?.user?.user_metadata) {
    const meta = sess.user.user_metadata;
    // se tiver id_vendedor_erp na metadata, filtra automaticamente (vendedor)
    if (meta.id_vendedor_erp && !meta.admin) {
      state.vendedorId = meta.id_vendedor_erp;
    }
  }
}

// ── LOAD FUNCTIONS ──
async function loadVendedores() {
  const data = await sbFetch('vw_dim_vendedor', 'select=id_vendedor,nome_vendedor&departamento=in.(DISTRIBUIDOR,"DISTRIBUICAO REPRESENTANTES")&order=nome_vendedor.asc');
  state.vendedores = Array.isArray(data) ? data : [];
}

async function loadDimMap() {
  const data = await sbFetch('atac_clientes', 'select=id_cliente,cnpj_cpf,cidade,uf,telefone1,email&situacao=eq.A');
  state.dimMap = new Map();
  if (Array.isArray(data)) data.forEach(d => state.dimMap.set(d.id_cliente, d));
}

async function loadCarteira() {
  let url = 'atac_crm_clientes?select=*&order=dias_sem_interacao.desc';
  if (state.vendedorId) url += `&id_vendedor_responsavel=eq.${state.vendedorId}`;
  const data = await sbFetch('atac_crm_clientes', `select=*&order=dias_sem_interacao.desc${state.vendedorId ? `&id_vendedor_responsavel=eq.${state.vendedorId}` : ''}`);
  if (Array.isArray(data)) {
    state.carteiraData = data.filter(c => {
      const s = getStatus(c);
      return s !== 'PROSPECCAO';
    });
  }
}

async function loadProspeccao() {
  const params = `select=*&status_crm=eq.PROSPECCAO&order=dias_sem_interacao.desc${state.vendedorId ? `&id_vendedor_responsavel=eq.${state.vendedorId}` : ''}`;
  const data = await sbFetch('atac_crm_clientes', params);
  state.prospeccaoData = Array.isArray(data) ? data : [];
}

async function loadUmblerPendentes() {
  // Contatos sem vínculo (nao_comercial=false, sem id_cliente em atac_cliente_telefones)
  const data = await sbFetch('atac_umbler_contatos', 'select=telefone,nome_contato,nome_atendente,ultimo_contato,nao_comercial&nao_comercial=eq.false&order=ultimo_contato.desc');
  if (!Array.isArray(data)) { state.umblerpendentes = []; return; }
  // Buscar telefones já vinculados
  const tels = await sbFetch('atac_cliente_telefones', 'select=telefone');
  const vinculados = new Set(Array.isArray(tels) ? tels.map(t => t.telefone) : []);
  state.umblerpendentes = data.filter(c => !vinculados.has(c.telefone));
}

async function loadOverdueTasks() {
  const today = new Date().toISOString().split('T')[0];
  const params = `select=id_cliente&resolvido=eq.false&data_prevista=lt.${today}${state.vendedorId ? `&id_vendedor_responsavel=eq.${state.vendedorId}` : ''}`;
  const data = await sbFetch('atac_crm_notas', params);
  state.overdueTasks = new Set(Array.isArray(data) ? data.map(d => d.id_cliente) : []);
}

async function loadTodayTasks() {
  const today = new Date().toISOString().split('T')[0];
  const params = `select=id,tipo,nome_cliente,texto,nome_vendedor_responsavel&resolvido=eq.false&data_prevista=eq.${today}&order=nome_cliente.asc`;
  const data = await sbFetch('atac_crm_notas', params + (state.vendedorId ? `&id_vendedor_responsavel=eq.${state.vendedorId}` : ''));
  renderTodayPanel(Array.isArray(data) ? data : []);
}

async function loadClienteDetail(id) {
  const [notas, tels, pedidos] = await Promise.all([
    sbFetch('atac_crm_notas', `select=*&id_cliente=eq.${id}&order=data_criacao.desc`),
    sbFetch('atac_cliente_telefones', `select=*&id_cliente=eq.${id}&order=principal.desc`),
    sbFetch('vw_comercial_docs_faturados', `select=data_faturamento,faturamento_doc,faturamento_liquido,qtd_itens_doc&tipo_saida=eq.DISTRIBUICAO&id_cliente=eq.${id}&order=data_faturamento.desc&limit=10`)
  ]);
  state.notas = Array.isArray(notas) ? notas : [];
  state.telefones = Array.isArray(tels) ? tels : [];
  state.pedidos = Array.isArray(pedidos) ? pedidos : [];
}

// ── RENDER PRINCIPAL ──
function renderAll() {
  renderUmblerPendentes();
  renderLista();
  if (state.selectedId && state.drawerOpen) {
    renderDrawer();
  }
}

function renderTodayPanel(tasks) {
  const el = document.getElementById('today-panel');
  if (!el) return;
  if (!tasks.length) {
    el.innerHTML = `<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm text-slate-400">Nenhuma atividade para hoje ✓</div>`;
    return;
  }
  el.innerHTML = `
    <div class="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
      <h3 class="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1.5">
        📋 Atividades de Hoje (${tasks.length})
      </h3>
      <div class="space-y-1.5 max-h-40 overflow-y-auto">
        ${tasks.map(t => `
          <div class="flex items-center justify-between rounded bg-slate-800 px-2.5 py-2 gap-2">
            <div class="flex items-center gap-2 min-w-0">
              ${tipoBadge(t.tipo)}
              <span class="text-sm font-medium truncate">${t.nome_cliente}</span>
              <span class="text-xs text-slate-400 truncate">${t.texto||''}</span>
            </div>
            <button onclick="resolverTarefa('${t.id}')" class="shrink-0 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              ✓ Resolver
            </button>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function renderUmblerPendentes() {
  const el = document.getElementById('umbler-pendentes');
  if (!el) return;
  const pendentes = state.umblerpendentes;
  if (!pendentes.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="rounded-lg border border-red-500/20 bg-red-500/5 mb-3">
      <button onclick="toggleUmbler()" class="w-full flex items-center gap-2 p-3 text-left">
        <span id="umbler-arrow" class="text-red-400">▼</span>
        <span class="text-sm font-bold text-red-400">📲 Contatos Aguardando Tratativa</span>
        <span class="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">${pendentes.length}</span>
      </button>
      <div id="umbler-list" class="px-3 pb-3 space-y-2">
        ${pendentes.slice(0,10).map(c => `
          <div class="rounded-lg bg-slate-800 border border-slate-700 p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold truncate">${c.nome_contato||'Sem nome'}</p>
                <div class="flex gap-3 mt-0.5 flex-wrap">
                  <span class="text-xs font-mono text-slate-400">${fmtPhone(c.telefone)}</span>
                  <span class="text-xs text-slate-400">${shortName(c.nome_atendente)}</span>
                  <span class="text-xs text-slate-400">${fmtDateTime(c.ultimo_contato)}</span>
                </div>
              </div>
              <div class="flex gap-1 shrink-0 flex-wrap justify-end">
                <button onclick="openVincularModal('${c.telefone}','${(c.nome_contato||'').replace(/'/g,"\\'")}','${(c.nome_atendente||'').replace(/'/g,"\\'")}')
                " class="text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-700">🔗 Vincular</button>
                <button onclick="marcarNaoComercial('${c.telefone}')" class="text-xs px-2 py-1 rounded text-red-400 hover:text-red-300">✕ Não Comercial</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

let umblerCollapsed = false;
function toggleUmbler() {
  umblerCollapsed = !umblerCollapsed;
  const list = document.getElementById('umbler-list');
  const arrow = document.getElementById('umbler-arrow');
  if (list) list.style.display = umblerCollapsed ? 'none' : '';
  if (arrow) arrow.textContent = umblerCollapsed ? '▶' : '▼';
}

function renderLista() {
  const el = document.getElementById('crm-lista');
  if (!el) return;

  const data = state.mainTab === 'carteira' ? getCarteiraFiltered() : getProspFiltered();

  if (!data.length) {
    el.innerHTML = `<p class="text-sm text-slate-400 text-center py-8">Nenhum cliente encontrado</p>`;
    return;
  }

  el.innerHTML = data.map(c => {
    const status = getStatus(c);
    const dim = state.dimMap.get(c.id_cliente) || {};
    const overdue = state.overdueTasks.has(c.id_cliente);
    const selected = state.selectedId === c.id_cliente;
    const diasCompra = c.dias_sem_compra ?? daysSince(c.ultima_compra);

    return `
      <button onclick="selectCliente(${c.id_cliente})" class="w-full text-left px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors ${selected ? 'bg-slate-700/60 border-l-2 border-l-blue-500' : ''}">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-sm font-semibold text-slate-100 truncate">${c.nome_cliente}</span>
            ${statusBadge(status)}
            ${diasCompra >= 30 ? '<span class="text-yellow-500 text-xs shrink-0" title="Atenção">⚠</span>' : ''}
          </div>
          <div class="flex items-center gap-1 shrink-0">
            ${overdue ? '<span class="text-red-400 text-xs" title="Tarefa atrasada">🔔</span>' : ''}
          </div>
        </div>
        <p class="text-xs text-slate-400">${shortName(c.nome_vendedor_responsavel)}</p>
        <div class="flex items-center justify-between mt-0.5 gap-2">
          <p class="text-xs text-slate-500 truncate">
            ${dim.cidade ? dim.cidade + (dim.uf ? ` - ${dim.uf}` : '') + ' · ' : ''}
            Últ. compra: ${c.ultima_compra ? fmtDate(c.ultima_compra) : '—'}
          </p>
          ${dim.cnpj_cpf ? `<span class="text-[10px] text-slate-500 shrink-0 font-mono">${fmtCnpj(dim.cnpj_cpf)}</span>` : ''}
        </div>
      </button>`;
  }).join('');
}

function getCarteiraFiltered() {
  let data = state.carteiraData;
  if (state.search) {
    const s = state.search.toLowerCase();
    data = data.filter(c => {
      if ((c.nome_cliente||'').toLowerCase().includes(s)) return true;
      const dim = state.dimMap.get(c.id_cliente)||{};
      if ((dim.cidade||'').toLowerCase().includes(s)) return true;
      if ((dim.cnpj_cpf||'').replace(/\D/g,'').includes(s.replace(/\D/g,''))) return true;
      if (String(c.id_cliente).includes(s)) return true;
      return false;
    });
  }
  if (state.subFilter !== 'todos') {
    data = data.filter(c => {
      const st = getStatus(c);
      if (state.subFilter === 'ativo') return st === 'ATIVO';
      if (state.subFilter === 'atencao') return st === 'ATENCAO';
      if (state.subFilter === 'em_risco') return st === 'PERDIDO';
      return true;
    });
  }
  return data;
}

function getProspFiltered() {
  let data = state.prospeccaoData;
  if (state.search) {
    const s = state.search.toLowerCase();
    data = data.filter(c => {
      if ((c.nome_cliente||'').toLowerCase().includes(s)) return true;
      const dim = state.dimMap.get(c.id_cliente)||{};
      if ((dim.cidade||'').toLowerCase().includes(s)) return true;
      return false;
    });
  }
  if (state.prospSubTab === 'atencao') {
    data = data.filter(c => (c.dias_sem_interacao||0) > 30);
  }
  // sort
  data = [...data].sort((a,b) => {
    if (state.prospSort === 'nome_az') return (a.nome_cliente||'').localeCompare(b.nome_cliente||'');
    if (state.prospSort === 'mais_antigo') return (b.dias_sem_interacao||0) - (a.dias_sem_interacao||0);
    if (state.prospSort === 'vendedor_az') return (a.nome_vendedor_responsavel||'zzz').localeCompare(b.nome_vendedor_responsavel||'zzz');
    return 0;
  });
  return data;
}

// ── DRAWER ──
async function selectCliente(id) {
  state.selectedId = id;
  // encontrar cliente nos dados
  const lista = state.mainTab === 'carteira' ? state.carteiraData : state.prospeccaoData;
  state.selectedCliente = lista.find(c => c.id_cliente === id) || null;
  state.drawerOpen = true;

  // marcar selecionado na lista
  renderLista();

  // abrir drawer e mostrar loading
  openDrawer();
  document.getElementById('drawer-content').innerHTML = `
    <div class="flex items-center justify-center h-40 text-slate-400">
      <div class="text-center"><div class="animate-spin text-2xl mb-2">⟳</div><p class="text-sm">Carregando...</p></div>
    </div>`;

  await loadClienteDetail(id);
  renderDrawer();
}

function openDrawer() {
  const drawer = document.getElementById('crm-drawer');
  if (drawer) {
    drawer.classList.remove('translate-x-full');
    drawer.classList.add('translate-x-0');
  }
}

function closeDrawer() {
  const drawer = document.getElementById('crm-drawer');
  if (drawer) {
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('translate-x-full');
  }
  state.drawerOpen = false;
  state.selectedId = null;
  state.selectedCliente = null;
  renderLista();
}

function renderDrawer() {
  const el = document.getElementById('drawer-content');
  if (!el || !state.selectedCliente) return;
  const c = state.selectedCliente;
  const dim = state.dimMap.get(c.id_cliente) || {};
  const status = getStatus(c);
  const diasCompra = c.dias_sem_compra ?? daysSince(c.ultima_compra);

  const kpiFat = state.pedidos.reduce((s,p) => s + (p.faturamento_liquido ?? p.faturamento_doc ?? 0), 0);
  const kpiQtd = state.pedidos.length;
  const kpiTicket = kpiQtd ? kpiFat / kpiQtd : 0;

  el.innerHTML = `
    <!-- HEADER CLIENTE -->
    <div class="space-y-3">
      <div>
        <h3 class="text-lg font-bold text-slate-100 leading-tight">${c.nome_cliente}</h3>
        <div class="flex items-center gap-2 mt-1.5 flex-wrap">
          ${statusBadge(status)}
          <span class="text-xs text-slate-400">${diasCompra < 9999 ? diasCompra + ' dias sem compra' : 'Sem compras'}</span>
          ${c.dias_sem_interacao != null ? `<span class="text-xs text-slate-500">· ${c.dias_sem_interacao} dias sem interação</span>` : ''}
        </div>
        <div class="mt-2 space-y-1">
          ${(dim.cnpj_cpf||c.cnpj_cpf) ? `<p class="text-sm text-slate-300 font-mono">${fmtCnpj(dim.cnpj_cpf||c.cnpj_cpf)}</p>` : ''}
          ${(dim.cidade||c.cidade) ? `<p class="text-sm text-slate-400">${dim.cidade||c.cidade}${(dim.uf||c.uf) ? ` - ${dim.uf||c.uf}` : ''}</p>` : ''}
          ${dim.email ? `<p class="text-xs text-slate-500">✉ ${dim.email}</p>` : ''}
          <p class="text-xs text-slate-500">Cód. ERP: ${c.id_cliente}</p>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <span class="text-xs text-slate-400">Vendedor: <span class="text-slate-200 font-medium">${shortName(c.nome_vendedor_responsavel)}</span></span>
          <button onclick="openEditVendorModal()" class="text-xs text-slate-500 hover:text-blue-400">✎</button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-lg bg-slate-700/50 p-3 text-center">
          <p class="text-[10px] text-slate-400 mb-0.5">Faturamento</p>
          <p class="text-sm font-bold text-slate-100">${fmt(kpiFat)}</p>
        </div>
        <div class="rounded-lg bg-slate-700/50 p-3 text-center">
          <p class="text-[10px] text-slate-400 mb-0.5">Pedidos</p>
          <p class="text-sm font-bold text-slate-100">${kpiQtd}</p>
        </div>
        <div class="rounded-lg bg-slate-700/50 p-3 text-center">
          <p class="text-[10px] text-slate-400 mb-0.5">Ticket Médio</p>
          <p class="text-sm font-bold text-slate-100">${fmt(kpiTicket)}</p>
        </div>
      </div>

      <!-- TELEFONES -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wide">📞 Telefones</h4>
          <button onclick="toggleAddPhone()" class="text-xs text-blue-400 hover:text-blue-300">+ Adicionar</button>
        </div>
        <div id="phone-form" class="hidden mb-2 space-y-2 rounded-lg border border-slate-700 p-3">
          <input id="new-phone" placeholder="Telefone" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500" />
          <input id="new-phone-nome" placeholder="Nome do contato" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500" />
          <input id="new-phone-desc" placeholder="Descrição (ex: Compras)" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500" />
          <div class="flex gap-2">
            <button onclick="savePhone(${c.id_cliente},'${c.nome_cliente.replace(/'/g,"\\'")}')" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded">Salvar</button>
            <button onclick="toggleAddPhone()" class="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5">Cancelar</button>
          </div>
        </div>
        <div class="space-y-1">
          ${state.telefones.map(t => `
            <div class="flex items-center justify-between rounded bg-slate-700/50 px-3 py-2 gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-mono text-sm text-slate-200">${fmtPhone(t.telefone)}</span>
                ${t.nome_contato ? `<span class="text-xs text-slate-400">${t.nome_contato}${t.cargo ? ` · ${t.cargo}` : ''}</span>` : ''}
                ${!t.nome_contato && t.descricao ? `<span class="text-xs text-slate-500">(${t.descricao})</span>` : ''}
                ${t.principal ? '<span class="text-[10px] text-blue-400 font-medium bg-blue-500/10 px-1.5 rounded">Principal</span>' : ''}
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <a href="https://wa.me/${(t.telefone||'').replace(/\D/g,'')}" target="_blank" class="text-emerald-400 hover:text-emerald-300 text-sm" title="WhatsApp">💬</a>
                <button onclick="deletePhone('${t.id}')" class="text-slate-500 hover:text-red-400 text-xs px-1">✕</button>
              </div>
            </div>
          `).join('') || '<p class="text-xs text-slate-500">Nenhum telefone</p>'}
        </div>
      </div>

      <!-- ÚLTIMOS PEDIDOS -->
      <div>
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">📦 Últimos Pedidos</h4>
        ${state.pedidos.length ? `
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-slate-700 text-slate-500">
                <th class="pb-1.5 text-left">Data</th>
                <th class="pb-1.5 text-right">Valor</th>
                <th class="pb-1.5 text-right">Itens</th>
              </tr>
            </thead>
            <tbody>
              ${state.pedidos.map(p => `
                <tr class="border-b border-slate-700/30">
                  <td class="py-1.5">${fmtDate(p.data_faturamento)}</td>
                  <td class="py-1.5 text-right">${fmt(p.faturamento_liquido??p.faturamento_doc)}</td>
                  <td class="py-1.5 text-right">${p.qtd_itens_doc||0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : '<p class="text-xs text-slate-500">Sem pedidos</p>'}
      </div>

      <!-- NOTAS / TAREFAS -->
      <div>
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">📝 Tarefas e Notas</h4>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          ${state.notas.map(n => `
            <div class="rounded-lg border ${n.resolvido ? 'border-slate-700/30 opacity-50' : 'border-slate-700'} p-3">
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-2">
                  ${tipoBadge(n.tipo)}
                  <span class="text-[10px] text-slate-500">${fmtDate(n.data_criacao)}${n.criado_por ? ` · ${n.criado_por}` : ''}</span>
                </div>
                ${!n.resolvido ? `<button onclick="resolverTarefa('${n.id}')" class="text-xs text-emerald-400 hover:text-emerald-300">✓ Resolver</button>` : '<span class="text-[10px] text-slate-600">Resolvido</span>'}
              </div>
              <p class="text-sm text-slate-200">${n.texto}</p>
              ${n.data_prevista ? `<p class="text-[10px] text-slate-500 mt-1">📅 Prevista: ${fmtDate(n.data_prevista)}</p>` : ''}
            </div>
          `).join('') || '<p class="text-xs text-slate-500">Nenhuma nota</p>'}
        </div>
      </div>

      <!-- NOVO REGISTRO -->
      <div class="rounded-lg border border-slate-700 p-4 space-y-3">
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Novo Registro</h4>
        <div class="flex gap-2">
          <select id="nota-tipo" class="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100">
            <option value="OBSERVACAO">Observação</option>
            <option value="TAREFA">Tarefa</option>
            <option value="FOLLOWUP">Follow-up</option>
            <option value="LIGACAO">Ligação</option>
          </select>
          <input id="nota-criado" placeholder="Criado por" class="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500" />
        </div>
        <textarea id="nota-texto" placeholder="Texto da nota..." rows="3" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 resize-none"></textarea>
        <input id="nota-data" type="date" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100" style="display:none" />
        <button onclick="salvarNota(${c.id_cliente},'${c.nome_cliente.replace(/'/g,"\\'")}',${c.id_vendedor_responsavel||'null'},'${c.nome_vendedor_responsavel||''}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
          Salvar Registro
        </button>
      </div>
    </div>`;

  // Toggle data field com tipo
  document.getElementById('nota-tipo')?.addEventListener('change', function() {
    const dateEl = document.getElementById('nota-data');
    if (dateEl) dateEl.style.display = ['TAREFA','FOLLOWUP'].includes(this.value) ? '' : 'none';
  });
}

// ── ACTIONS ──
async function resolverTarefa(id) {
  await sbPatch('atac_crm_notas', 'id', id, { resolvido: true, data_resolucao: new Date().toISOString() });
  toast('Resolvido!');
  await loadTodayTasks();
  if (state.selectedId) await loadClienteDetail(state.selectedId);
  renderDrawer();
  await loadOverdueTasks();
  renderLista();
}

async function salvarNota(clienteId, nomeCliente, vendedorId, nomeVendedor) {
  const tipo = document.getElementById('nota-tipo')?.value;
  const texto = document.getElementById('nota-texto')?.value?.trim();
  const criadoPor = document.getElementById('nota-criado')?.value?.trim();
  const dataPrevista = document.getElementById('nota-data')?.value;

  if (!texto || !criadoPor) { toast('Preencha texto e criado por', 'error'); return; }
  if (['TAREFA','FOLLOWUP'].includes(tipo) && !dataPrevista) { toast('Informe a data prevista', 'error'); return; }

  await sbPost('atac_crm_notas', {
    id_cliente: clienteId,
    nome_cliente: nomeCliente,
    tipo, texto,
    criado_por: criadoPor,
    data_prevista: dataPrevista || null,
    id_vendedor_responsavel: vendedorId || null,
    nome_vendedor_responsavel: nomeVendedor || null,
  });
  toast('Registro salvo!');
  await loadClienteDetail(clienteId);
  renderDrawer();
}

function toggleAddPhone() {
  const el = document.getElementById('phone-form');
  if (el) el.classList.toggle('hidden');
}

async function savePhone(clienteId, nomeCliente) {
  const telefone = document.getElementById('new-phone')?.value?.trim();
  const nome = document.getElementById('new-phone-nome')?.value?.trim();
  const desc = document.getElementById('new-phone-desc')?.value?.trim();
  if (!telefone) { toast('Informe o telefone', 'error'); return; }
  await sbPost('atac_cliente_telefones', { id_cliente: clienteId, nome_cliente: nomeCliente, telefone, nome_contato: nome||null, descricao: desc||null, principal: false });
  toast('Telefone adicionado!');
  await loadClienteDetail(clienteId);
  renderDrawer();
}

async function deletePhone(phoneId) {
  if (!confirm('Remover telefone?')) return;
  const sess = await getSess();
  await fetch(`${SUPA_URL}/rest/v1/atac_cliente_telefones?id=eq.${phoneId}`, {
    method: 'DELETE',
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${sess?.access_token||SUPA_KEY}` }
  });
  toast('Telefone removido!');
  await loadClienteDetail(state.selectedId);
  renderDrawer();
}

async function marcarNaoComercial(telefone) {
  const motivo = prompt('Motivo (obrigatório):');
  if (!motivo?.trim()) return;
  await sbPatch('atac_umbler_contatos', 'telefone', telefone, { nao_comercial: true, motivo_nao_comercial: motivo });
  toast('Marcado como não comercial');
  await loadUmblerPendentes();
  renderUmblerPendentes();
}

// ── MODAL VINCULAR ──
function openVincularModal(telefone, nome, atendente) {
  const modal = document.getElementById('modal-vincular');
  if (!modal) return;
  modal.dataset.telefone = telefone;
  modal.dataset.nome = nome;
  modal.dataset.atendente = atendente;
  modal.classList.remove('hidden');
  document.getElementById('vincular-search').value = '';
  document.getElementById('vincular-results').innerHTML = '';
}

function closeVincularModal() {
  document.getElementById('modal-vincular')?.classList.add('hidden');
}

async function searchVincular() {
  const q = document.getElementById('vincular-search')?.value?.trim();
  if (!q || q.length < 2) return;
  const data = await sbFetch('atac_clientes', `select=id_cliente,nome_cliente,cnpj_cpf,cidade,uf,origem&or=(nome_cliente.ilike.*${encodeURIComponent(q)}*,cnpj_cpf.ilike.*${q.replace(/\D/g,'')}*)`);
  const results = Array.isArray(data) ? data.slice(0,10) : [];
  const el = document.getElementById('vincular-results');
  if (!el) return;
  if (!results.length) { el.innerHTML = '<p class="text-xs text-slate-500 text-center py-3">Nenhum cliente encontrado</p>'; return; }
  el.innerHTML = results.map(c => `
    <button onclick="confirmarVincular(${c.id_cliente},'${(c.nome_cliente||'').replace(/'/g,"\\'")}','${c.origem||''}')"
      class="w-full text-left px-3 py-2 rounded hover:bg-slate-700/50 text-sm border border-slate-700/30 mb-1">
      <div class="flex items-center justify-between">
        <span class="font-medium text-slate-200">${c.nome_cliente}</span>
        <span class="text-xs text-slate-500">#${c.id_cliente}</span>
      </div>
      ${(c.cnpj_cpf||c.cidade) ? `<p class="text-xs text-slate-500">${c.cnpj_cpf ? fmtCnpj(c.cnpj_cpf)+' · ' : ''}${c.cidade||''}</p>` : ''}
    </button>
  `).join('');
}

async function confirmarVincular(clienteId, nomeCliente, origem) {
  const modal = document.getElementById('modal-vincular');
  if (!modal) return;
  const telefone = modal.dataset.telefone;

  // Salvar telefone
  await sbPost('atac_cliente_telefones', {
    id_cliente: clienteId, nome_cliente: nomeCliente, telefone,
    descricao: 'Umbler', principal: true
  });

  toast(`Cliente vinculado → ${nomeCliente}`);
  closeVincularModal();
  await loadUmblerPendentes();
  await loadCarteira();
  await loadProspeccao();
  renderAll();
}

function openEditVendorModal() {
  toast('Em breve: modal de troca de vendedor', 'error');
}

// ── UI CONTROLS ──
function setMainTab(tab) {
  state.mainTab = tab;
  state.selectedId = null;
  state.drawerOpen = false;
  closeDrawer();
  renderLista();
  // atualizar botões
  ['tab-carteira','tab-prospeccao'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isActive = (id === `tab-${tab}`);
    el.className = `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`;
  });
  // mostrar/ocultar controles de prospecção
  const prospControls = document.getElementById('prosp-controls');
  const cartControls = document.getElementById('cart-controls');
  if (prospControls) prospControls.style.display = tab === 'prospeccao' ? '' : 'none';
  if (cartControls) cartControls.style.display = tab === 'carteira' ? '' : 'none';
}

function setSubFilter(f) {
  state.subFilter = f;
  renderLista();
  document.querySelectorAll('[data-subflt]').forEach(el => {
    const active = el.dataset.subflt === f;
    el.className = `rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${active ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`;
  });
}

function setProspSub(s) {
  state.prospSubTab = s;
  renderLista();
}

function setProspSort(s) {
  state.prospSort = s;
  renderLista();
}

function handleSearch(v) {
  state.search = v;
  renderLista();
}

// ── WINDOW EXPORTS ──
window.CRMModule = { init: initCRM };
window.selectCliente = selectCliente;
window.closeDrawer = closeDrawer;
window.setMainTab = setMainTab;
window.setSubFilter = setSubFilter;
window.setProspSub = setProspSub;
window.setProspSort = setProspSort;
window.handleSearch = handleSearch;
window.resolverTarefa = resolverTarefa;
window.salvarNota = salvarNota;
window.toggleAddPhone = toggleAddPhone;
window.savePhone = savePhone;
window.deletePhone = deletePhone;
window.marcarNaoComercial = marcarNaoComercial;
window.openVincularModal = openVincularModal;
window.closeVincularModal = closeVincularModal;
window.searchVincular = searchVincular;
window.confirmarVincular = confirmarVincular;
window.openEditVendorModal = openEditVendorModal;
window.toggleUmbler = toggleUmbler;
