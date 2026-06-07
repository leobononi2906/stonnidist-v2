// ═══════════════════════════════════════════════════════════
// STONNI ATACADO — crm.js  (CRM completo)
// ═══════════════════════════════════════════════════════════
const SUPA_URL = 'https://vishxwdxqiygbxmtpfoy.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpc2h4d2R4cWl5Z2J4bXRwZm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0Njg2MjIsImV4cCI6MjA4ODA0NDYyMn0.J647m3ieDHahNQYBWMRESl0aPFXsT_zt_7ZcDvyB-SA';

// ── ESTADO GLOBAL ──
const ST = {
  // filtros
  dateStart: '', dateEnd: '', vendedorId: null,
  // dados
  docs: [], vendedores: [], dimMap: new Map(),
  carteiraData: [], prospeccaoData: [],
  umblerpendentes: [], overdueTasks: new Set(),
  notas: [], telefones: [], pedidos: [],
  // CRM
  mainTab: 'carteira', subFilter: 'todos',
  prospSubTab: 'todos', prospSort: 'nome_az',
  search: '', selectedId: null, selectedCliente: null, drawerOpen: false,
  // vendedores expand
  expandedVendedor: null,
};

// ── PERÍODO PADRÃO: mês atual ──
function initDates() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,'0');
  ST.dateStart = `${y}-${m}-01`;
  const lastDay = new Date(y, now.getMonth()+1, 0).getDate();
  ST.dateEnd = `${y}-${m}-${lastDay}`;
  const sel = document.getElementById('period-select');
  if (sel) sel.value = 'mes_atual';
}

// ── FORMATADORES ──
const fmt = v => v == null ? '—' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const fmtK = v => { if (v == null) return '—'; if (Math.abs(v)>=1e6) return `R$${(v/1e6).toFixed(1)}M`; if (Math.abs(v)>=1e3) return `R$${(v/1e3).toFixed(0)}k`; return fmt(v); };
const fmtDate = d => { if (!d) return '—'; return new Date(d+'T12:00:00').toLocaleDateString('pt-BR'); };
const fmtDateTime = d => { if (!d) return '—'; const dt = new Date(d); return `${dt.toLocaleDateString('pt-BR')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`; };
const fmtPhone = p => { if (!p) return '—'; const d = p.replace(/\D/g,''); if(d.length===13)return`+${d.slice(0,2)}(${d.slice(2,4)})${d.slice(4,9)}-${d.slice(9)}`; if(d.length===11)return`(${d.slice(0,2)})${d.slice(2,7)}-${d.slice(7)}`; if(d.length===10)return`(${d.slice(0,2)})${d.slice(2,6)}-${d.slice(6)}`; return p; };
const fmtCnpj = v => { if (!v) return '—'; const d = v.replace(/\D/g,''); if(d.length===14)return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'); if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'); return v; };
const shortName = n => { if(!n)return'—'; const p=n.trim().split(' '); if(p.length===1)return p[0]; return`${p[0]} ${p[p.length-1][0]}.`; };
const daysSince = d => { if(!d)return 9999; return Math.floor((Date.now()-new Date(d+'T12:00:00').getTime())/86400000); };
const docFat = d => d?.faturamento_liquido ?? d?.faturamento_doc ?? 0;

function getStatus(c) {
  const dias = c.dias_sem_compra ?? daysSince(c.ultima_compra) ?? 9999;
  if (dias < 30) return 'ATIVO';
  if (dias < 90) return 'ATENCAO';
  if (dias < 180) return 'PERDIDO';
  return 'PROSPECCAO';
}
function statusBadge(s) {
  const m = { ATIVO:['bg-emerald-500/20 text-emerald-400 border-emerald-500/30','Ativo'], ATENCAO:['bg-yellow-500/20 text-yellow-400 border-yellow-500/30','Atenção'], PERDIDO:['bg-red-500/20 text-red-400 border-red-500/30','Em Risco'], PROSPECCAO:['bg-slate-500/20 text-slate-400 border-slate-500/30','Prospecção'] };
  const [cls,label] = m[s]||m.PROSPECCAO;
  return `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${cls}">${label}</span>`;
}
function tipoBadge(t) {
  const m = { OBSERVACAO:'bg-blue-500/20 text-blue-400', TAREFA:'bg-yellow-500/20 text-yellow-400', FOLLOWUP:'bg-purple-500/20 text-purple-400', LIGACAO:'bg-emerald-500/20 text-emerald-400' };
  return `<span class="rounded-full px-2 py-0.5 text-[10px] font-medium ${m[t]||'bg-slate-500/20 text-slate-400'}">${t}</span>`;
}

// ── SUPABASE FETCH ──
async function getSess() {
  const raw = localStorage.getItem('sb-vishxwdxqiygbxmtpfoy-auth-token');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
async function sbFetch(table, params='') {
  const sess = await getSess();
  const token = sess?.access_token || SUPA_KEY;
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}&limit=9999`, {
    headers: { apikey: SUPA_KEY, Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }
  });
  return r.json();
}
async function sbPost(table, body) {
  const sess = await getSess();
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method:'POST',
    headers:{apikey:SUPA_KEY,Authorization:`Bearer ${sess?.access_token||SUPA_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify(body)
  });
  return r;
}
async function sbPatch(table, field, val, body) {
  const sess = await getSess();
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${field}=eq.${encodeURIComponent(val)}`, {
    method:'PATCH',
    headers:{apikey:SUPA_KEY,Authorization:`Bearer ${sess?.access_token||SUPA_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify(body)
  });
  return r;
}
async function sbDelete(table, field, val) {
  const sess = await getSess();
  await fetch(`${SUPA_URL}/rest/v1/${table}?${field}=eq.${encodeURIComponent(val)}`, {
    method:'DELETE', headers:{apikey:SUPA_KEY,Authorization:`Bearer ${sess?.access_token||SUPA_KEY}`}
  });
}

function toast(msg, type='success') {
  const el = document.createElement('div');
  el.className = `fixed bottom-5 right-5 z-[9999] px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-opacity duration-300 ${type==='error'?'bg-red-600':'bg-emerald-600'} text-white`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); },2500);
}

// ════════════════════════════════════════
// INIT
// ════════════════════════════════════════
async function initCRM() {
  initDates();
  buildPeriodOptions();
  await Promise.all([loadVendedores(), loadDimMap()]);
  await Promise.all([loadDocs(), loadCarteira(), loadProspeccao(), loadUmblerPendentes(), loadOverdueTasks()]);
  await loadTodayTasks();
  // aba padrão = CRM
  switchTab('crm');
}

function buildPeriodOptions() {
  const sel = document.getElementById('period-select');
  if (!sel) return;
  const now = new Date();
  const options = [
    ['mes_atual', 'Mês Atual'],
    ['mes_anterior', 'Mês Anterior'],
    ['ultimos_3m', 'Últimos 3 Meses'],
    ['ultimos_6m', 'Últimos 6 Meses'],
    ['ano_atual', 'Ano Atual'],
  ];
  sel.innerHTML = options.map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
  sel.value = 'mes_atual';
}

function applyPeriod(v) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  let start, end;
  if (v === 'mes_atual') {
    start = new Date(y, m, 1); end = new Date(y, m+1, 0);
  } else if (v === 'mes_anterior') {
    start = new Date(y, m-1, 1); end = new Date(y, m, 0);
  } else if (v === 'ultimos_3m') {
    start = new Date(y, m-2, 1); end = new Date(y, m+1, 0);
  } else if (v === 'ultimos_6m') {
    start = new Date(y, m-5, 1); end = new Date(y, m+1, 0);
  } else if (v === 'ano_atual') {
    start = new Date(y, 0, 1); end = new Date(y, 11, 31);
  }
  const pad = n => String(n).padStart(2,'0');
  ST.dateStart = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`;
  ST.dateEnd   = `${end.getFullYear()}-${pad(end.getMonth()+1)}-${pad(end.getDate())}`;
  Promise.all([loadDocs(), loadCarteira(), loadProspeccao()]).then(() => {
    const active = document.querySelector('[data-tab].tab-active')?.dataset.tab;
    if (active === 'home') renderHome();
    if (active === 'vendedores') renderVendedores();
    if (active === 'crm') renderCRM();
  });
}

// ════════════════════════════════════════
// LOAD DATA
// ════════════════════════════════════════
async function loadVendedores() {
  const data = await sbFetch('vw_dim_vendedor', 'select=id_vendedor,nome_vendedor,departamento');
  ST.vendedores = (Array.isArray(data) ? data : []).filter(v => {
    const d = (v.departamento||'').trim().toUpperCase();
    return d === 'DISTRIBUIDOR' || d === 'DISTRIBUICAO REPRESENTANTES';
  });
}

async function loadDimMap() {
  const data = await sbFetch('atac_clientes', 'select=id_cliente,cnpj_cpf,cidade,uf,telefone1,email&situacao=eq.A');
  ST.dimMap = new Map();
  if (Array.isArray(data)) data.forEach(d => ST.dimMap.set(d.id_cliente, d));
}

async function loadDocs() {
  const params = `select=id_doc,id_vendedor,nome_vendedor,id_cliente,nome_cliente,id_empresa,empresa,data_faturamento,faturamento_doc,faturamento_liquido,margem_doc,margem_liquida,qtd_itens_doc&tipo_saida=eq.DISTRIBUICAO&data_faturamento=gte.${ST.dateStart}&data_faturamento=lte.${ST.dateEnd}&order=data_faturamento.desc`;
  const data = await sbFetch('vw_comercial_docs_faturados', params);
  // dedup por id_doc
  const seen = new Set();
  ST.docs = (Array.isArray(data) ? data : []).filter(d => { if (!d.id_doc || seen.has(d.id_doc)) return false; seen.add(d.id_doc); return true; });
}

async function loadCarteira() {
  const params = `select=*&order=dias_sem_interacao.desc${ST.vendedorId ? `&id_vendedor_responsavel=eq.${ST.vendedorId}` : ''}`;
  const data = await sbFetch('atac_crm_clientes', params);
  ST.carteiraData = (Array.isArray(data) ? data : []).filter(c => getStatus(c) !== 'PROSPECCAO');
}

async function loadProspeccao() {
  const params = `select=*&status_crm=eq.PROSPECCAO&order=dias_sem_interacao.desc${ST.vendedorId ? `&id_vendedor_responsavel=eq.${ST.vendedorId}` : ''}`;
  const data = await sbFetch('atac_crm_clientes', params);
  ST.prospeccaoData = Array.isArray(data) ? data : [];
}

async function loadUmblerPendentes() {
  const data = await sbFetch('atac_umbler_contatos', 'select=telefone,nome_contato,nome_atendente,ultimo_contato&nao_comercial=eq.false&order=ultimo_contato.desc');
  if (!Array.isArray(data)) { ST.umblerpendentes = []; return; }
  const tels = await sbFetch('atac_cliente_telefones', 'select=telefone');
  const vinculados = new Set(Array.isArray(tels) ? tels.map(t => t.telefone) : []);
  ST.umblerpendentes = data.filter(c => !vinculados.has(c.telefone));
}

async function loadOverdueTasks() {
  const today = new Date().toISOString().split('T')[0];
  const params = `select=id_cliente&resolvido=eq.false&data_prevista=lt.${today}${ST.vendedorId ? `&id_vendedor_responsavel=eq.${ST.vendedorId}` : ''}`;
  const data = await sbFetch('atac_crm_notas', params);
  ST.overdueTasks = new Set(Array.isArray(data) ? data.map(d => d.id_cliente) : []);
}

async function loadTodayTasks() {
  const today = new Date().toISOString().split('T')[0];
  const params = `select=id,tipo,nome_cliente,texto,nome_vendedor_responsavel&resolvido=eq.false&data_prevista=eq.${today}${ST.vendedorId ? `&id_vendedor_responsavel=eq.${ST.vendedorId}` : ''}`;
  const data = await sbFetch('atac_crm_notas', params);
  renderTodayPanel(Array.isArray(data) ? data : []);
}

async function loadClienteDetail(id) {
  const [notas, tels, pedidos] = await Promise.all([
    sbFetch('atac_crm_notas', `select=*&id_cliente=eq.${id}&order=data_criacao.desc`),
    sbFetch('atac_cliente_telefones', `select=*&id_cliente=eq.${id}&order=principal.desc`),
    sbFetch('vw_comercial_docs_faturados', `select=data_faturamento,faturamento_doc,faturamento_liquido,qtd_itens_doc&tipo_saida=eq.DISTRIBUICAO&id_cliente=eq.${id}&order=data_faturamento.desc&limit=10`)
  ]);
  ST.notas = Array.isArray(notas) ? notas : [];
  ST.telefones = Array.isArray(tels) ? tels : [];
  ST.pedidos = Array.isArray(pedidos) ? pedidos : [];
}

// ════════════════════════════════════════
// NAVEGAÇÃO POR ABAS
// ════════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('[data-tab]').forEach(el => {
    const active = el.dataset.tab === tab;
    el.classList.toggle('tab-active', active);
    el.classList.toggle('bg-slate-700', active);
    el.classList.toggle('text-slate-100', active);
    el.classList.toggle('text-slate-400', !active);
  });
  ['home-page','vendedores-page','crm-page','config-page'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !id.startsWith(tab));
  });
  if (tab === 'home') renderHome();
  if (tab === 'vendedores') renderVendedores();
  if (tab === 'crm') renderCRM();
  if (tab === 'config') renderConfig();
}

// ════════════════════════════════════════
// ABA HOME
// ════════════════════════════════════════
function renderHome() {
  const el = document.getElementById('home-page');
  if (!el) return;

  const docs = ST.docs;
  const fat = docs.reduce((s,d) => s+docFat(d), 0);
  const ped = new Set(docs.map(d => d.id_doc)).size;
  const cli = new Set(docs.map(d => d.id_cliente)).size;
  const ticket = ped ? fat/ped : 0;

  // por canal (DISTRIBUIDOR vs REPRESENTANTE)
  const vdeptMap = new Map(ST.vendedores.map(v => [v.id_vendedor, (v.departamento||'').trim().toUpperCase()]));
  let fatDist=0, fatRep=0, pedDist=0, pedRep=0;
  docs.forEach(d => {
    const dept = vdeptMap.get(d.id_vendedor)||'';
    if(dept==='DISTRIBUIDOR'){fatDist+=docFat(d);pedDist++;}
    else if(dept==='DISTRIBUICAO REPRESENTANTES'){fatRep+=docFat(d);pedRep++;}
  });

  // gráfico diário
  const dailyMap = new Map();
  docs.forEach(d => {
    const dt = (d.data_faturamento||'').split('T')[0];
    if(dt) dailyMap.set(dt, (dailyMap.get(dt)||0)+docFat(d));
  });
  const daily = [...dailyMap.entries()].sort(([a],[b])=>a.localeCompare(b));
  const maxVal = Math.max(...daily.map(([,v])=>v), 1);

  // top 10 clientes
  const cliMap = new Map();
  docs.forEach(d => {
    if(!d.id_cliente) return;
    if(!cliMap.has(d.id_cliente)) cliMap.set(d.id_cliente,{nome:d.nome_cliente,fat:0,ped:0});
    const c=cliMap.get(d.id_cliente); c.fat+=docFat(d); c.ped++;
  });
  const topCli = [...cliMap.values()].sort((a,b)=>b.fat-a.fat).slice(0,10);

  // últimos 8 pedidos
  const ultimosPed = docs.slice(0,8);

  el.innerHTML = `
    <!-- KPI cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${kpiCard('💰','Faturamento',fmtK(fat),'text-blue-400')}
      ${kpiCard('🛒','Pedidos',ped,'text-purple-400')}
      ${kpiCard('👥','Clientes',cli,'text-emerald-400')}
      ${kpiCard('🎯','Ticket Médio',fmtK(ticket),'text-yellow-400')}
    </div>

    <!-- Canais -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
      <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <p class="text-xs text-slate-400 mb-1">🏢 Distribuidor (Internos)</p>
        <p class="text-xl font-bold text-slate-100">${fmtK(fatDist)}</p>
        <p class="text-xs text-slate-500 mt-0.5">${pedDist} pedidos</p>
      </div>
      <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <p class="text-xs text-slate-400 mb-1">🤝 Representantes</p>
        <p class="text-xl font-bold text-slate-100">${fmtK(fatRep)}</p>
        <p class="text-xs text-slate-500 mt-0.5">${pedRep} pedidos</p>
      </div>
    </div>

    <!-- Gráfico diário + Top clientes -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
      <!-- Gráfico -->
      <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <p class="text-xs text-slate-400 mb-3">📈 Faturamento Diário</p>
        ${daily.length ? `
        <div class="space-y-1">
          ${daily.map(([dt,v]) => `
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-slate-500 w-16 shrink-0">${fmtDate(dt)}</span>
              <div class="flex-1 bg-slate-700 rounded-full h-1.5">
                <div class="bg-blue-500 h-1.5 rounded-full" style="width:${Math.round(v/maxVal*100)}%"></div>
              </div>
              <span class="text-[10px] text-slate-300 w-14 text-right shrink-0">${fmtK(v)}</span>
            </div>
          `).join('')}
        </div>` : '<p class="text-sm text-slate-500">Sem dados no período</p>'}
      </div>

      <!-- Top Clientes -->
      <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <p class="text-xs text-slate-400 mb-3">🏆 Top 10 Clientes</p>
        ${topCli.length ? `
        <div class="space-y-1.5">
          ${topCli.map((c,i) => `
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-slate-600 w-4">${i+1}</span>
              <div class="flex-1 min-w-0">
                <span class="text-xs text-slate-200 truncate block">${c.nome}</span>
              </div>
              <span class="text-xs font-medium text-slate-300 shrink-0">${fmtK(c.fat)}</span>
            </div>
          `).join('')}
        </div>` : '<p class="text-sm text-slate-500">Sem dados</p>'}
      </div>
    </div>

    <!-- Últimos pedidos -->
    <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <p class="text-xs text-slate-400 mb-3">📦 Últimos Pedidos</p>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-slate-700 text-slate-500">
              <th class="pb-2 text-left">Data</th>
              <th class="pb-2 text-right">Valor</th>
              <th class="pb-2 text-left pl-3">Cliente</th>
              <th class="pb-2 text-left pl-3 hidden sm:table-cell">Vendedor</th>
            </tr>
          </thead>
          <tbody>
            ${ultimosPed.map(p => `
              <tr class="border-b border-slate-700/40">
                <td class="py-2">${fmtDate(p.data_faturamento)}</td>
                <td class="py-2 text-right font-medium text-slate-200">${fmt(docFat(p))}</td>
                <td class="py-2 pl-3 text-slate-300 max-w-[150px] truncate">${p.nome_cliente||'—'}</td>
                <td class="py-2 pl-3 text-slate-400 hidden sm:table-cell">${shortName(p.nome_vendedor)}</td>
              </tr>
            `).join('') || `<tr><td colspan="4" class="py-6 text-center text-slate-500">Sem pedidos no período</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function kpiCard(icon, label, value, colorClass) {
  return `
    <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <p class="text-[10px] text-slate-500 mb-1">${icon} ${label}</p>
      <p class="text-lg font-bold ${colorClass}">${value}</p>
    </div>`;
}

// ════════════════════════════════════════
// ABA VENDEDORES
// ════════════════════════════════════════
function renderVendedores() {
  const el = document.getElementById('vendedores-page');
  if (!el) return;

  const allowedIds = new Set(ST.vendedores.map(v => v.id_vendedor));
  const vmap = new Map();
  ST.docs.forEach(d => {
    if (!allowedIds.has(d.id_vendedor)) return;
    if (!vmap.has(d.id_vendedor)) vmap.set(d.id_vendedor, { id:d.id_vendedor, nome:d.nome_vendedor||'', fat:0, cli:new Set(), ped:new Set() });
    const v = vmap.get(d.id_vendedor);
    v.fat += docFat(d);
    if(d.id_cliente) v.cli.add(d.id_cliente);
    if(d.id_doc) v.ped.add(d.id_doc);
  });

  const vendedores = [...vmap.values()]
    .map(v => ({...v, clientes:v.cli.size, pedidos:v.ped.size, ticket: v.ped.size ? v.fat/v.ped.size : 0}))
    .sort((a,b) => b.fat-a.fat);

  const fatTotal = vendedores.reduce((s,v)=>s+v.fat,0);
  const maxFat = Math.max(...vendedores.map(v=>v.fat),1);

  // saúde carteira por vendedor (de atac_crm_clientes)
  const crmMap = new Map();
  ST.carteiraData.forEach(c => {
    const vid = c.id_vendedor_responsavel;
    if (!vid) return;
    if (!crmMap.has(vid)) crmMap.set(vid, {total:0,ativos:0,atencao:0,risco:0});
    const m = crmMap.get(vid);
    m.total++;
    const s = getStatus(c);
    if(s==='ATIVO')m.ativos++; else if(s==='ATENCAO')m.atencao++; else if(s==='PERDIDO')m.risco++;
  });

  el.innerHTML = `
    <!-- KPI resumo -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${kpiCard('💰','Faturamento Total',fmtK(fatTotal),'text-blue-400')}
      ${kpiCard('👤','Vendedores Ativos',vendedores.length,'text-purple-400')}
      ${kpiCard('👥','Clientes Únicos',new Set(ST.docs.map(d=>d.id_cliente).filter(Boolean)).size,'text-emerald-400')}
      ${kpiCard('🛒','Total Pedidos',new Set(ST.docs.map(d=>d.id_doc).filter(Boolean)).size,'text-yellow-400')}
    </div>

    <!-- Ranking -->
    <div class="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <p class="text-xs text-slate-400 mb-4">🏆 Ranking de Vendedores</p>
      ${vendedores.length ? `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-700 text-xs text-slate-500">
              <th class="pb-2 text-left w-8"></th>
              <th class="pb-2 text-left">Vendedor</th>
              <th class="pb-2 text-right">Faturamento</th>
              <th class="pb-2 text-right hidden sm:table-cell">Clientes</th>
              <th class="pb-2 text-right hidden sm:table-cell">Pedidos</th>
              <th class="pb-2 text-right hidden md:table-cell">Ticket</th>
              <th class="pb-2 w-32 hidden lg:table-cell"></th>
            </tr>
          </thead>
          <tbody>
            ${vendedores.map((v,i) => {
              const crm = crmMap.get(v.id)||{total:0,ativos:0,atencao:0,risco:0};
              const expanded = ST.expandedVendedor === v.id;
              const topCli = ST.docs.filter(d=>d.id_vendedor===v.id).reduce((m,d)=>{
                const k=d.id_cliente; if(!k) return m;
                if(!m.has(k)) m.set(k,{nome:d.nome_cliente,fat:0,ped:0,ultima:''});
                const c=m.get(k); c.fat+=docFat(d); c.ped++; if(d.data_faturamento>c.ultima)c.ultima=d.data_faturamento;
                return m;
              }, new Map());
              const topCliArr=[...topCli.values()].sort((a,b)=>b.fat-a.fat).slice(0,5);
              return `
                <tr onclick="toggleVendedor(${v.id})" class="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer">
                  <td class="py-3 pr-2">
                    <span class="text-xs ${expanded?'text-blue-400':'text-slate-500'}">${expanded?'▼':'▶'}</span>
                  </td>
                  <td class="py-3">
                    <span class="font-medium text-slate-200">${shortName(v.nome)}</span>
                    ${i===0?'<span class="ml-1 text-[10px] text-yellow-400">🥇</span>':i===1?'<span class="ml-1 text-[10px] text-slate-400">🥈</span>':i===2?'<span class="ml-1 text-[10px] text-orange-600">🥉</span>':''}
                  </td>
                  <td class="py-3 text-right font-semibold text-slate-100">${fmtK(v.fat)}</td>
                  <td class="py-3 text-right text-slate-400 hidden sm:table-cell">${v.clientes}</td>
                  <td class="py-3 text-right text-slate-400 hidden sm:table-cell">${v.pedidos}</td>
                  <td class="py-3 text-right text-slate-400 hidden md:table-cell">${fmtK(v.ticket)}</td>
                  <td class="py-3 hidden lg:table-cell pl-4">
                    <div class="w-full bg-slate-700 rounded-full h-1.5">
                      <div class="bg-blue-500 h-1.5 rounded-full" style="width:${Math.round(v.fat/maxFat*100)}%"></div>
                    </div>
                  </td>
                </tr>
                ${expanded ? `
                <tr class="border-b border-slate-700">
                  <td colspan="7" class="p-0">
                    <div class="bg-slate-900/50 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <!-- Saúde carteira -->
                      <div>
                        <p class="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Saúde da Carteira</p>
                        <div class="grid grid-cols-3 gap-2">
                          <div class="rounded bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
                            <p class="text-lg font-bold text-emerald-400">${crm.ativos}</p>
                            <p class="text-[10px] text-slate-400">Ativos</p>
                          </div>
                          <div class="rounded bg-yellow-500/10 border border-yellow-500/20 p-2 text-center">
                            <p class="text-lg font-bold text-yellow-400">${crm.atencao}</p>
                            <p class="text-[10px] text-slate-400">Atenção</p>
                          </div>
                          <div class="rounded bg-red-500/10 border border-red-500/20 p-2 text-center">
                            <p class="text-lg font-bold text-red-400">${crm.risco}</p>
                            <p class="text-[10px] text-slate-400">Em Risco</p>
                          </div>
                        </div>
                      </div>
                      <!-- Top clientes -->
                      <div>
                        <p class="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Top 5 Clientes</p>
                        <div class="space-y-1">
                          ${topCliArr.map(c => `
                            <div class="flex items-center justify-between">
                              <span class="text-xs text-slate-300 truncate">${c.nome}</span>
                              <span class="text-xs text-slate-400 shrink-0 ml-2">${fmtK(c.fat)}</span>
                            </div>
                          `).join('') || '<p class="text-xs text-slate-500">Sem pedidos</p>'}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>` : ''}
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : '<p class="text-sm text-slate-500 py-8 text-center">Sem vendedores com dados no período</p>'}
    </div>
  `;
}

function toggleVendedor(id) {
  ST.expandedVendedor = ST.expandedVendedor === id ? null : id;
  renderVendedores();
}

// ════════════════════════════════════════
// ABA CRM (lista + drawer)
// ════════════════════════════════════════
function renderCRM() {
  renderTodayPanel_if_needed();
  renderUmblerPendentes();
  renderLista();
}

function renderTodayPanel_if_needed() {
  const el = document.getElementById('today-panel');
  if (!el || el.innerHTML.trim()) return;
  loadTodayTasks();
}

function renderTodayPanel(tasks) {
  const el = document.getElementById('today-panel');
  if (!el) return;
  if (!tasks.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 mb-3">
      <h3 class="text-xs font-bold text-blue-400 mb-2">📋 Atividades de Hoje (${tasks.length})</h3>
      <div class="space-y-1.5 max-h-36 overflow-y-auto">
        ${tasks.map(t => `
          <div class="flex items-center justify-between rounded bg-slate-800 px-2.5 py-2 gap-2">
            <div class="flex items-center gap-2 min-w-0">
              ${tipoBadge(t.tipo)}
              <span class="text-sm font-medium text-slate-200 truncate">${t.nome_cliente}</span>
              <span class="text-xs text-slate-400 truncate hidden sm:inline">${t.texto||''}</span>
            </div>
            <button onclick="resolverTarefa('${t.id}')" class="shrink-0 text-xs text-emerald-400 hover:text-emerald-300">✓</button>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function renderUmblerPendentes() {
  const el = document.getElementById('umbler-pendentes');
  if (!el) return;
  if (!ST.umblerpendentes.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="rounded-lg border border-red-500/20 bg-red-500/5 mb-3">
      <button onclick="toggleUmbler()" class="w-full flex items-center gap-2 p-3">
        <span id="umbler-arrow" class="text-red-400 text-sm">▼</span>
        <span class="text-sm font-bold text-red-400">📲 Contatos Sem Tratativa</span>
        <span class="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">${ST.umblerpendentes.length}</span>
      </button>
      <div id="umbler-list" class="px-3 pb-3 space-y-2">
        ${ST.umblerpendentes.slice(0,8).map(c => `
          <div class="rounded-lg bg-slate-800 border border-slate-700 p-2.5">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-200 truncate">${c.nome_contato||'Sem nome'}</p>
                <div class="flex gap-2 mt-0.5 flex-wrap">
                  <span class="text-xs font-mono text-slate-400">${fmtPhone(c.telefone)}</span>
                  <span class="text-xs text-slate-500">${shortName(c.nome_atendente)}</span>
                </div>
              </div>
              <div class="flex gap-1 shrink-0">
                <button onclick="openVincularModal('${c.telefone}','${(c.nome_contato||'').replace(/'/g,"\\'")}','${(c.nome_atendente||'').replace(/'/g,"\\'")}')
" class="text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-700">🔗</button>
                <button onclick="marcarNaoComercial('${c.telefone}')" class="text-xs px-2 py-1 rounded text-red-400 hover:text-red-300">✕</button>
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
  const el = document.getElementById('umbler-list');
  const arrow = document.getElementById('umbler-arrow');
  if(el) el.style.display = umblerCollapsed ? 'none' : '';
  if(arrow) arrow.textContent = umblerCollapsed ? '▶' : '▼';
}

function renderLista() {
  const el = document.getElementById('crm-lista');
  if (!el) return;
  const data = ST.mainTab === 'carteira' ? getCarteiraFiltered() : getProspFiltered();
  if (!data.length) { el.innerHTML = '<p class="text-sm text-slate-400 text-center py-10">Nenhum cliente encontrado</p>'; return; }
  el.innerHTML = data.map(c => {
    const status = getStatus(c);
    const dim = ST.dimMap.get(c.id_cliente)||{};
    const overdue = ST.overdueTasks.has(c.id_cliente);
    const sel = ST.selectedId === c.id_cliente;
    const diasCompra = c.dias_sem_compra ?? daysSince(c.ultima_compra);
    return `
      <button onclick="selectCliente(${c.id_cliente})"
        class="w-full text-left px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/40 transition-colors ${sel?'bg-slate-700/60 border-l-2 border-l-blue-500':''}">
        <div class="flex items-center justify-between mb-0.5">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-sm font-semibold text-slate-100 truncate">${c.nome_cliente}</span>
            ${statusBadge(status)}
            ${diasCompra>=30?'<span class="text-yellow-500 text-xs shrink-0">⚠</span>':''}
          </div>
          ${overdue?'<span class="text-red-400 text-xs shrink-0">🔔</span>':''}
        </div>
        <p class="text-xs text-slate-400">${shortName(c.nome_vendedor_responsavel)}</p>
        <div class="flex items-center justify-between mt-0.5 gap-2">
          <p class="text-xs text-slate-500 truncate">
            ${dim.cidade?dim.cidade+(dim.uf?` - ${dim.uf}`:'')+' · ':''}Últ. compra: ${c.ultima_compra?fmtDate(c.ultima_compra):'—'}
          </p>
          ${dim.cnpj_cpf?`<span class="text-[10px] text-slate-600 shrink-0 font-mono">${fmtCnpj(dim.cnpj_cpf)}</span>`:''}
        </div>
      </button>`;
  }).join('');
}

function getCarteiraFiltered() {
  let data = ST.carteiraData;
  if (ST.search) {
    const s = ST.search.toLowerCase();
    data = data.filter(c => {
      if((c.nome_cliente||'').toLowerCase().includes(s)) return true;
      const d = ST.dimMap.get(c.id_cliente)||{};
      if((d.cidade||'').toLowerCase().includes(s)) return true;
      if((d.cnpj_cpf||'').replace(/\D/g,'').includes(s.replace(/\D/g,''))) return true;
      if(String(c.id_cliente).includes(s)) return true;
      return false;
    });
  }
  if (ST.subFilter !== 'todos') {
    data = data.filter(c => {
      const st = getStatus(c);
      if(ST.subFilter==='ativo') return st==='ATIVO';
      if(ST.subFilter==='atencao') return st==='ATENCAO';
      if(ST.subFilter==='em_risco') return st==='PERDIDO';
      return true;
    });
  }
  return data;
}

function getProspFiltered() {
  let data = ST.prospeccaoData;
  if (ST.search) {
    const s = ST.search.toLowerCase();
    data = data.filter(c => (c.nome_cliente||'').toLowerCase().includes(s));
  }
  if (ST.prospSubTab === 'atencao') data = data.filter(c => (c.dias_sem_interacao||0) > 30);
  return [...data].sort((a,b) => {
    if(ST.prospSort==='nome_az') return (a.nome_cliente||'').localeCompare(b.nome_cliente||'');
    if(ST.prospSort==='mais_antigo') return (b.dias_sem_interacao||0)-(a.dias_sem_interacao||0);
    if(ST.prospSort==='vendedor_az') return (a.nome_vendedor_responsavel||'zzz').localeCompare(b.nome_vendedor_responsavel||'zzz');
    return 0;
  });
}

// ── Drawer ──
async function selectCliente(id) {
  ST.selectedId = id;
  const lista = ST.mainTab==='carteira' ? ST.carteiraData : ST.prospeccaoData;
  ST.selectedCliente = lista.find(c => c.id_cliente===id)||null;
  ST.drawerOpen = true;
  renderLista();
  openDrawer();
  document.getElementById('drawer-content').innerHTML = `<div class="flex items-center justify-center h-40 text-slate-400"><div class="animate-spin text-xl">⟳</div></div>`;
  document.getElementById('drawer-titulo').textContent = ST.selectedCliente?.nome_cliente||'Ficha';
  await loadClienteDetail(id);
  renderDrawer();
}

function openDrawer() {
  const d = document.getElementById('crm-drawer');
  if(d){ d.classList.remove('translate-x-full'); d.classList.add('translate-x-0'); }
  const ph = document.getElementById('drawer-placeholder');
  if(ph) ph.classList.add('hidden');
}
function closeDrawer() {
  const d = document.getElementById('crm-drawer');
  if(d){ d.classList.remove('translate-x-0'); d.classList.add('translate-x-full'); }
  const ph = document.getElementById('drawer-placeholder');
  if(ph) ph.classList.remove('hidden');
  ST.drawerOpen = false; ST.selectedId = null; ST.selectedCliente = null;
  renderLista();
}

function renderDrawer() {
  const el = document.getElementById('drawer-content');
  if (!el || !ST.selectedCliente) return;
  const c = ST.selectedCliente;
  const dim = ST.dimMap.get(c.id_cliente)||{};
  const status = getStatus(c);
  const diasCompra = c.dias_sem_compra ?? daysSince(c.ultima_compra);
  const kpiFat = ST.pedidos.reduce((s,p) => s+docFat(p), 0);
  const kpiQtd = ST.pedidos.length;
  const telPrincipal = ST.telefones.find(t=>t.principal) || ST.telefones[0];
  if (telPrincipal) {
    const wa = document.getElementById('drawer-whatsapp');
    if(wa){ wa.href=`https://wa.me/${(telPrincipal.telefone||'').replace(/\D/g,'')}`; wa.classList.remove('hidden'); }
  }

  el.innerHTML = `
    <!-- Header -->
    <div>
      <h3 class="text-lg font-bold text-slate-100">${c.nome_cliente}</h3>
      <div class="flex items-center gap-2 mt-1.5 flex-wrap">
        ${statusBadge(status)}
        <span class="text-xs text-slate-400">${diasCompra<9999?diasCompra+' dias sem compra':'Sem compras'}</span>
      </div>
      <div class="mt-2 space-y-0.5">
        ${(dim.cnpj_cpf||c.cnpj_cpf)?`<p class="text-sm font-mono text-slate-300">${fmtCnpj(dim.cnpj_cpf||c.cnpj_cpf)}</p>`:''}
        ${(dim.cidade||c.cidade)?`<p class="text-sm text-slate-400">${dim.cidade||c.cidade}${(dim.uf||c.uf)?' - '+(dim.uf||c.uf):''}</p>`:''}
        ${dim.email?`<p class="text-xs text-slate-500">✉ ${dim.email}</p>`:''}
        <p class="text-xs text-slate-500">Cód. ERP: ${c.id_cliente}</p>
      </div>
      <p class="text-xs text-slate-400 mt-2">Vendedor: <span class="text-slate-200 font-medium">${shortName(c.nome_vendedor_responsavel)}</span></p>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-3 gap-2">
      <div class="rounded-lg bg-slate-700/50 p-3 text-center">
        <p class="text-[10px] text-slate-400">Faturamento</p>
        <p class="text-sm font-bold text-slate-100">${fmt(kpiFat)}</p>
      </div>
      <div class="rounded-lg bg-slate-700/50 p-3 text-center">
        <p class="text-[10px] text-slate-400">Pedidos</p>
        <p class="text-sm font-bold text-slate-100">${kpiQtd}</p>
      </div>
      <div class="rounded-lg bg-slate-700/50 p-3 text-center">
        <p class="text-[10px] text-slate-400">Ticket Médio</p>
        <p class="text-sm font-bold text-slate-100">${fmt(kpiQtd?kpiFat/kpiQtd:0)}</p>
      </div>
    </div>

    <!-- Telefones -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wide">📞 Telefones</h4>
        <button onclick="toggleAddPhone()" class="text-xs text-blue-400 hover:text-blue-300">+ Adicionar</button>
      </div>
      <div id="phone-form" class="hidden mb-2 space-y-2 rounded-lg border border-slate-700 p-3">
        <input id="new-phone" placeholder="Telefone" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500" />
        <input id="new-phone-nome" placeholder="Nome do contato" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500" />
        <div class="flex gap-2">
          <button onclick="savePhone(${c.id_cliente},'${c.nome_cliente.replace(/'/g,"\\'")}')" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded">Salvar</button>
          <button onclick="toggleAddPhone()" class="text-xs text-slate-400 px-3 py-1.5">Cancelar</button>
        </div>
      </div>
      <div class="space-y-1">
        ${ST.telefones.map(t => `
          <div class="flex items-center justify-between rounded bg-slate-700/50 px-3 py-2 gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-mono text-sm text-slate-200">${fmtPhone(t.telefone)}</span>
              ${t.nome_contato?`<span class="text-xs text-slate-400 truncate">${t.nome_contato}</span>`:''}
              ${t.principal?'<span class="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 rounded">Principal</span>':''}
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <a href="https://wa.me/${(t.telefone||'').replace(/\D/g,'')}" target="_blank" class="text-emerald-400 hover:text-emerald-300 text-sm">💬</a>
              <button onclick="deletePhone('${t.id}')" class="text-slate-600 hover:text-red-400 text-xs px-1">✕</button>
            </div>
          </div>
        `).join('') || '<p class="text-xs text-slate-500">Nenhum telefone</p>'}
      </div>
    </div>

    <!-- Últimos Pedidos -->
    <div>
      <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">📦 Últimos Pedidos</h4>
      ${ST.pedidos.length ? `
      <table class="w-full text-xs">
        <thead><tr class="border-b border-slate-700 text-slate-500"><th class="pb-1.5 text-left">Data</th><th class="pb-1.5 text-right">Valor</th><th class="pb-1.5 text-right">Itens</th></tr></thead>
        <tbody>
          ${ST.pedidos.map(p => `
            <tr class="border-b border-slate-700/30">
              <td class="py-1.5">${fmtDate(p.data_faturamento)}</td>
              <td class="py-1.5 text-right">${fmt(docFat(p))}</td>
              <td class="py-1.5 text-right">${p.qtd_itens_doc||0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>` : '<p class="text-xs text-slate-500">Sem pedidos no histórico</p>'}
    </div>

    <!-- Notas -->
    <div>
      <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">📝 Tarefas e Notas</h4>
      <div class="space-y-2 max-h-72 overflow-y-auto">
        ${ST.notas.map(n => `
          <div class="rounded-lg border ${n.resolvido?'border-slate-700/30 opacity-50':'border-slate-700'} p-3">
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2">
                ${tipoBadge(n.tipo)}
                <span class="text-[10px] text-slate-500">${fmtDate(n.data_criacao)}${n.criado_por?' · '+n.criado_por:''}</span>
              </div>
              ${!n.resolvido?`<button onclick="resolverTarefa('${n.id}')" class="text-xs text-emerald-400 hover:text-emerald-300">✓ Resolver</button>`:'<span class="text-[10px] text-slate-600">Resolvido</span>'}
            </div>
            <p class="text-sm text-slate-200">${n.texto}</p>
            ${n.data_prevista?`<p class="text-[10px] text-slate-500 mt-1">📅 ${fmtDate(n.data_prevista)}</p>`:''}
          </div>
        `).join('') || '<p class="text-xs text-slate-500">Nenhuma nota</p>'}
      </div>
    </div>

    <!-- Novo registro -->
    <div class="rounded-lg border border-slate-700 p-4 space-y-3">
      <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wide">Novo Registro</h4>
      <div class="flex gap-2">
        <select id="nota-tipo" onchange="toggleDataField()" class="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100">
          <option value="OBSERVACAO">Observação</option>
          <option value="TAREFA">Tarefa</option>
          <option value="FOLLOWUP">Follow-up</option>
          <option value="LIGACAO">Ligação</option>
        </select>
        <input id="nota-criado" placeholder="Criado por" class="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500" />
      </div>
      <textarea id="nota-texto" placeholder="Texto da nota..." rows="3" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 resize-none"></textarea>
      <input id="nota-data" type="date" class="hidden w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100" />
      <button onclick="salvarNota(${c.id_cliente},'${c.nome_cliente.replace(/'/g,"\\'")}',${c.id_vendedor_responsavel||'null'},'${(c.nome_vendedor_responsavel||'').replace(/'/g,"\\'")}')
" class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg">Salvar</button>
    </div>
  `;
}

function toggleDataField() {
  const tipo = document.getElementById('nota-tipo')?.value;
  const el = document.getElementById('nota-data');
  if(el) el.classList.toggle('hidden', !['TAREFA','FOLLOWUP'].includes(tipo));
}

// ════════════════════════════════════════
// ABA CONFIGURAÇÕES
// ════════════════════════════════════════
function renderConfig() {
  const el = document.getElementById('config-page');
  if (!el) return;
  el.innerHTML = `
    <div class="max-w-lg space-y-4">
      <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h3 class="text-sm font-bold text-slate-200 mb-4">⚙️ Configurações do CRM</h3>
        <div class="space-y-4">
          <div>
            <label class="text-xs text-slate-400 block mb-1">Dias para status ATENÇÃO</label>
            <input type="number" value="30" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100" />
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">Dias para status EM RISCO</label>
            <input type="number" value="90" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100" />
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">Dias para PROSPECÇÃO (perde carteira)</label>
            <input type="number" value="180" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100" />
          </div>
          <p class="text-xs text-slate-500">⚠ Configuração dinâmica via tabela <code>atac_crm_config</code> — em breve</p>
        </div>
      </div>

      <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h3 class="text-sm font-bold text-slate-200 mb-4">🔗 Integrações</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 border border-slate-600">
            <div>
              <p class="text-sm text-slate-200 font-medium">Umbler Talk (WhatsApp)</p>
              <p class="text-xs text-slate-400">Edge Function UMBLERATC v69</p>
            </div>
            <span class="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">Ativo</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 border border-slate-600">
            <div>
              <p class="text-sm text-slate-200 font-medium">ERP Firebird → Supabase</p>
              <p class="text-xs text-slate-400">Sync automático a cada hora</p>
            </div>
            <span class="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">Ativo</span>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h3 class="text-sm font-bold text-slate-200 mb-3">ℹ️ Sobre</h3>
        <div class="text-xs text-slate-400 space-y-1">
          <p>App: Stonni Atacado CRM v2.0</p>
          <p>Supabase: vishxwdxqiygbxmtpfoy</p>
          <p>Deploy: Vercel → <a href="https://stonnidist-v2.vercel.app" class="text-blue-400 hover:underline">stonnidist-v2.vercel.app</a></p>
          <p>Hub: <a href="https://bononi-hub.vercel.app" class="text-blue-400 hover:underline">bononi-hub.vercel.app</a></p>
        </div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════
// ACTIONS
// ════════════════════════════════════════
async function resolverTarefa(id) {
  await sbPatch('atac_crm_notas','id',id,{resolvido:true,data_resolucao:new Date().toISOString()});
  toast('Resolvido!');
  await loadTodayTasks();
  if (ST.selectedId) { await loadClienteDetail(ST.selectedId); renderDrawer(); }
  await loadOverdueTasks(); renderLista();
}

async function salvarNota(cId, cNome, vId, vNome) {
  const tipo = document.getElementById('nota-tipo')?.value;
  const texto = document.getElementById('nota-texto')?.value?.trim();
  const criado = document.getElementById('nota-criado')?.value?.trim();
  const data = document.getElementById('nota-data')?.value;
  if (!texto || !criado) { toast('Preencha texto e criado por','error'); return; }
  if (['TAREFA','FOLLOWUP'].includes(tipo) && !data) { toast('Informe a data prevista','error'); return; }
  await sbPost('atac_crm_notas',{id_cliente:cId,nome_cliente:cNome,tipo,texto,criado_por:criado,data_prevista:data||null,id_vendedor_responsavel:vId||null,nome_vendedor_responsavel:vNome||null});
  toast('Registro salvo!');
  await loadClienteDetail(cId); renderDrawer();
}

function toggleAddPhone() { document.getElementById('phone-form')?.classList.toggle('hidden'); }

async function savePhone(cId, cNome) {
  const tel = document.getElementById('new-phone')?.value?.trim();
  const nome = document.getElementById('new-phone-nome')?.value?.trim();
  if (!tel) { toast('Informe o telefone','error'); return; }
  await sbPost('atac_cliente_telefones',{id_cliente:cId,nome_cliente:cNome,telefone:tel,nome_contato:nome||null,principal:false});
  toast('Telefone adicionado!');
  await loadClienteDetail(cId); renderDrawer();
}

async function deletePhone(id) {
  if (!confirm('Remover telefone?')) return;
  await sbDelete('atac_cliente_telefones','id',id);
  toast('Removido!');
  await loadClienteDetail(ST.selectedId); renderDrawer();
}

async function marcarNaoComercial(tel) {
  const motivo = prompt('Motivo:');
  if (!motivo?.trim()) return;
  await sbPatch('atac_umbler_contatos','telefone',tel,{nao_comercial:true,motivo_nao_comercial:motivo});
  toast('Marcado como não comercial');
  await loadUmblerPendentes(); renderUmblerPendentes();
}

// ── Modal vincular ──
function openVincularModal(tel, nome, atend) {
  const m = document.getElementById('modal-vincular');
  if (!m) return;
  m.dataset.telefone=tel; m.dataset.nome=nome; m.dataset.atendente=atend;
  m.classList.remove('hidden');
  document.getElementById('vincular-search').value='';
  document.getElementById('vincular-results').innerHTML='<p class="text-xs text-slate-500 text-center py-3">Digite para buscar...</p>';
}
function closeVincularModal() { document.getElementById('modal-vincular')?.classList.add('hidden'); }

async function searchVincular() {
  const q = document.getElementById('vincular-search')?.value?.trim();
  if (!q || q.length<2) return;
  const data = await sbFetch('atac_clientes', `select=id_cliente,nome_cliente,cnpj_cpf,cidade,uf&or=(nome_cliente.ilike.*${encodeURIComponent(q)}*,cnpj_cpf.ilike.*${q.replace(/\D/g,'')}*)`);
  const results = Array.isArray(data) ? data.slice(0,10) : [];
  const el = document.getElementById('vincular-results');
  if(!el) return;
  el.innerHTML = results.length ? results.map(c => `
    <button onclick="confirmarVincular(${c.id_cliente},'${(c.nome_cliente||'').replace(/'/g,"\\'")}')
"
      class="w-full text-left px-3 py-2 rounded hover:bg-slate-700/50 text-sm border border-slate-700/30 mb-1">
      <div class="flex items-center justify-between">
        <span class="font-medium text-slate-200">${c.nome_cliente}</span>
        <span class="text-xs text-slate-500">#${c.id_cliente}</span>
      </div>
      ${c.cidade?`<p class="text-xs text-slate-500">${c.cidade}${c.uf?' - '+c.uf:''}</p>`:''}
    </button>
  `).join('') : '<p class="text-xs text-slate-500 text-center py-3">Nenhum cliente encontrado</p>';
}

async function confirmarVincular(cId, cNome) {
  const m = document.getElementById('modal-vincular');
  if (!m) return;
  const tel = m.dataset.telefone;
  await sbPost('atac_cliente_telefones',{id_cliente:cId,nome_cliente:cNome,telefone:tel,descricao:'Umbler',principal:true});
  toast(`Vinculado → ${cNome}`);
  closeVincularModal();
  await Promise.all([loadUmblerPendentes(), loadCarteira(), loadProspeccao()]);
  renderCRM();
}

// ── Controles UI ──
function setMainTab(tab) {
  ST.mainTab=tab; ST.selectedId=null; ST.drawerOpen=false;
  closeDrawer();
  ['tab-carteira','tab-prospeccao'].forEach(id => {
    const el=document.getElementById(id); if(!el) return;
    const act=id===`tab-${tab}`;
    el.className=`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${act?'bg-blue-600 text-white':'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`;
  });
  const pc=document.getElementById('prosp-controls'), cc=document.getElementById('cart-controls');
  if(pc) pc.style.display=tab==='prospeccao'?'':'none';
  if(cc) cc.style.display=tab==='carteira'?'':'none';
  renderLista();
}

function setSubFilter(f) {
  ST.subFilter=f;
  document.querySelectorAll('[data-subflt]').forEach(el => {
    const act=el.dataset.subflt===f;
    el.className=`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${act?'bg-blue-500/20 text-blue-400':'text-slate-400 hover:text-slate-200'}`;
  });
  renderLista();
}
function setProspSub(s) { ST.prospSubTab=s; renderLista(); }
function setProspSort(s) { ST.prospSort=s; renderLista(); }
function handleSearch(v) { ST.search=v; renderLista(); }

// ── Exports ──
window.CRMModule = { init: initCRM };
window.switchTab = switchTab;
window.applyPeriod = applyPeriod;
window.toggleVendedor = toggleVendedor;
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
window.toggleUmbler = toggleUmbler;
window.toggleDataField = toggleDataField;
