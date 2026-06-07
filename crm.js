// ═══════════════════════════════════════════════════════════
// STONNI ATACADO — crm.js
// window.SUPA_URL, window.SUPA_KEY, window.sb  → definidos no index.html
// ═══════════════════════════════════════════════════════════

// ── ESTADO ──────────────────────────────────────────────────
const S = {
  // período
  dtStart: '', dtEnd: '',
  // dados brutos
  docs: [], vendedores: [], dimMap: new Map(),
  // CRM
  carteira: [], prospeccao: [], umbler: [],
  notas: [], telefones: [], pedidos: [],
  overdueIds: new Set(),
  // UI
  tab: 'crm',           // aba ativa
  mainTab: 'carteira',  // dentro do CRM
  subFilter: 'todos',
  pSub: 'todos',
  pSort: 'nome_az',
  search: '',
  selId: null,
  selCliente: null,
  // vendedores expand (aba Vendedores)
  expandVend: null,
  // umbler collapsed
  umblerOpen: true,
};

// ── FORMATADORES ────────────────────────────────────────────
const R = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const fmt  = v => (v==null||isNaN(v)) ? '—' : R.format(v);
const fmtK = v => { if (v==null||isNaN(v)) return '—'; const a=Math.abs(v); if(a>=1e6)return`R$${(v/1e6).toFixed(1)}M`; if(a>=1e3)return`R$${(v/1e3).toFixed(0)}k`; return fmt(v); };
const fmtD = d => { if(!d)return'—'; return new Date(d.substring(0,10)+'T12:00:00').toLocaleDateString('pt-BR'); };
const fmtDT= d => { if(!d)return'—'; const dt=new Date(d); return`${dt.toLocaleDateString('pt-BR')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`; };
const fmtP = p => { if(!p)return'—'; const d=p.replace(/\D/g,''); if(d.length===11)return`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; if(d.length===10)return`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`; return p; };
const fmtC = v => { if(!v)return'—'; const d=v.replace(/\D/g,''); if(d.length===14)return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'); if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'); return v; };
const sN   = n => { if(!n)return'—'; const p=n.trim().split(' '); if(p.length===1)return p[0]; return`${p[0]} ${p[p.length-1][0]}.`; };
const dias = d => { if(!d)return 9999; return Math.floor((Date.now()-new Date(d.substring(0,10)+'T12:00:00').getTime())/86400000); };
const docFat = d => d?.faturamento_liquido ?? d?.faturamento_doc ?? 0;

function getStatus(c) {
  const d = c.dias_sem_compra ?? dias(c.ultima_compra);
  if (d <  30) return 'ATIVO';
  if (d <  90) return 'ATENCAO';
  if (d < 180) return 'PERDIDO';
  return 'PROSPECCAO';
}
function bdg(s) {
  const m = {
    ATIVO:      ['bdg bdg-a','Ativo'],
    ATENCAO:    ['bdg bdg-t','Atenção'],
    PERDIDO:    ['bdg bdg-r','Em Risco'],
    PROSPECCAO: ['bdg bdg-p','Prospecção'],
  };
  const [cls,lbl] = m[s]||m.PROSPECCAO;
  return `<span class="${cls}">${lbl}</span>`;
}
function tipoBdg(t) {
  const m = { OBSERVACAO:'bdg-obs', TAREFA:'bdg-tar', FOLLOWUP:'bdg-fol', LIGACAO:'bdg-lig' };
  return `<span class="bdg-tipo ${m[t]||'bdg-obs'}">${t}</span>`;
}

// ── SUPABASE HELPERS ────────────────────────────────────────
async function sbQ(table, params='') {
  const sess = window.sb ? (await window.sb.auth.getSession()).data.session : null;
  const token = sess?.access_token || window.SUPA_KEY;
  const r = await fetch(`${window.SUPA_URL}/rest/v1/${table}?${params}&limit=9999`, {
    headers:{ apikey:window.SUPA_KEY, Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }
  });
  if (!r.ok) { console.error('sbQ error', table, r.status); return []; }
  return r.json();
}
async function sbInsert(table, body) {
  const sess = (await window.sb.auth.getSession()).data.session;
  return fetch(`${window.SUPA_URL}/rest/v1/${table}`, {
    method:'POST',
    headers:{ apikey:window.SUPA_KEY, Authorization:`Bearer ${sess?.access_token||window.SUPA_KEY}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body: JSON.stringify(body)
  });
}
async function sbUpdate(table, field, val, body) {
  const sess = (await window.sb.auth.getSession()).data.session;
  return fetch(`${window.SUPA_URL}/rest/v1/${table}?${field}=eq.${encodeURIComponent(val)}`, {
    method:'PATCH',
    headers:{ apikey:window.SUPA_KEY, Authorization:`Bearer ${sess?.access_token||window.SUPA_KEY}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body: JSON.stringify(body)
  });
}
async function sbDel(table, field, val) {
  const sess = (await window.sb.auth.getSession()).data.session;
  return fetch(`${window.SUPA_URL}/rest/v1/${table}?${field}=eq.${encodeURIComponent(val)}`, {
    method:'DELETE',
    headers:{ apikey:window.SUPA_KEY, Authorization:`Bearer ${sess?.access_token||window.SUPA_KEY}` }
  });
}

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, tipo='ok') {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:20px;right:20px;z-index:9999;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:opacity .3s;background:${tipo==='err'?'#dc2626':'#16a34a'};color:#fff`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 2500);
}

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
async function init() {
  initPeriod();
  // carrega base
  await Promise.all([loadVendedores(), loadDimMap()]);
  // carrega tudo em paralelo
  await Promise.all([loadDocs(), loadCarteira(), loadProspeccao(), loadUmbler(), loadOverdue(), loadToday()]);
  // mostra CRM direto
  gotoTab('crm');
}

function initPeriod() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  setRange(new Date(y,m,1), new Date(y,m+1,0));
  const sel = document.getElementById('period-sel');
  if (!sel) return;
  sel.innerHTML = [
    ['mes_atual','Mês Atual'],
    ['mes_anterior','Mês Anterior'],
    ['ult_3m','Últimos 3 Meses'],
    ['ult_6m','Últimos 6 Meses'],
    ['ano_atual','Ano Atual'],
  ].map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  sel.value = 'mes_atual';
}

function setRange(s, e) {
  const p = n => String(n).padStart(2,'0');
  S.dtStart = `${s.getFullYear()}-${p(s.getMonth()+1)}-${p(s.getDate())}`;
  S.dtEnd   = `${e.getFullYear()}-${p(e.getMonth()+1)}-${p(e.getDate())}`;
}

async function applyPeriod(v) {
  const n=new Date(), y=n.getFullYear(), m=n.getMonth();
  if(v==='mes_atual')       setRange(new Date(y,m,1),   new Date(y,m+1,0));
  else if(v==='mes_anterior')setRange(new Date(y,m-1,1), new Date(y,m,0));
  else if(v==='ult_3m')     setRange(new Date(y,m-2,1), new Date(y,m+1,0));
  else if(v==='ult_6m')     setRange(new Date(y,m-5,1), new Date(y,m+1,0));
  else if(v==='ano_atual')  setRange(new Date(y,0,1),   new Date(y,11,31));
  await loadDocs();
  if(S.tab==='home')       renderHome();
  if(S.tab==='vendedores') renderVendedores();
}

// ════════════════════════════════════════════════════════════
// LOAD
// ════════════════════════════════════════════════════════════
async function loadVendedores() {
  const d = await sbQ('vw_dim_vendedor','select=id_vendedor,nome_vendedor,departamento');
  S.vendedores = (Array.isArray(d)?d:[]).filter(v=>{
    const dept=(v.departamento||'').trim().toUpperCase();
    return dept==='DISTRIBUIDOR'||dept==='DISTRIBUICAO REPRESENTANTES';
  });
}
async function loadDimMap() {
  const d = await sbQ('atac_clientes','select=id_cliente,cnpj_cpf,cidade,uf,telefone1,email&situacao=eq.A');
  S.dimMap = new Map(); (Array.isArray(d)?d:[]).forEach(r=>S.dimMap.set(r.id_cliente,r));
}
async function loadDocs() {
  const p = `select=id_doc,id_vendedor,nome_vendedor,id_cliente,nome_cliente,data_faturamento,faturamento_doc,faturamento_liquido,qtd_itens_doc&tipo_saida=eq.DISTRIBUICAO&data_faturamento=gte.${S.dtStart}&data_faturamento=lte.${S.dtEnd}&order=data_faturamento.desc`;
  const d = await sbQ('vw_comercial_docs_faturados', p);
  const seen=new Set();
  S.docs = (Array.isArray(d)?d:[]).filter(r=>{ if(!r.id_doc||seen.has(r.id_doc))return false; seen.add(r.id_doc); return true; });
}
async function loadCarteira() {
  const d = await sbQ('atac_crm_clientes','select=*&order=dias_sem_interacao.desc.nullslast');
  S.carteira = (Array.isArray(d)?d:[]).filter(c=>getStatus(c)!=='PROSPECCAO');
}
async function loadProspeccao() {
  const d = await sbQ('atac_crm_clientes','select=*&status_crm=eq.PROSPECCAO&order=dias_sem_interacao.desc.nullslast');
  S.prospeccao = Array.isArray(d)?d:[];
}
async function loadUmbler() {
  const [cts, tels] = await Promise.all([
    sbQ('atac_umbler_contatos','select=telefone,nome_contato,nome_atendente,ultimo_contato&nao_comercial=eq.false&order=ultimo_contato.desc'),
    sbQ('atac_cliente_telefones','select=telefone'),
  ]);
  const vinc = new Set((Array.isArray(tels)?tels:[]).map(t=>t.telefone));
  S.umbler = (Array.isArray(cts)?cts:[]).filter(c=>!vinc.has(c.telefone));
  // atualiza badge sidebar
  const cnt = S.umbler.length;
  const el = document.getElementById('umbl-cnt');
  if(el){ el.textContent=cnt; el.classList.toggle('hidden', cnt===0); }
}
async function loadOverdue() {
  const today = new Date().toISOString().split('T')[0];
  const d = await sbQ('atac_crm_notas',`select=id_cliente&resolvido=eq.false&data_prevista=lt.${today}`);
  S.overdueIds = new Set((Array.isArray(d)?d:[]).map(r=>r.id_cliente));
}
async function loadToday() {
  const today = new Date().toISOString().split('T')[0];
  const d = await sbQ('atac_crm_notas',`select=id,tipo,nome_cliente,texto&resolvido=eq.false&data_prevista=eq.${today}&order=nome_cliente.asc`);
  renderToday(Array.isArray(d)?d:[]);
}
async function loadDetalhe(id) {
  const [notas, tels, peds] = await Promise.all([
    sbQ('atac_crm_notas',`select=*&id_cliente=eq.${id}&order=data_criacao.desc`),
    sbQ('atac_cliente_telefones',`select=*&id_cliente=eq.${id}&order=principal.desc,created_at.asc`),
    sbQ('vw_comercial_docs_faturados',`select=data_faturamento,faturamento_doc,faturamento_liquido,qtd_itens_doc&tipo_saida=eq.DISTRIBUICAO&id_cliente=eq.${id}&order=data_faturamento.desc&limit=10`),
  ]);
  S.notas     = Array.isArray(notas)?notas:[];
  S.telefones = Array.isArray(tels)?tels:[];
  S.pedidos   = Array.isArray(peds)?peds:[];
}

// ════════════════════════════════════════════════════════════
// NAVEGAÇÃO
// ════════════════════════════════════════════════════════════
function gotoTab(tab) {
  S.tab = tab;
  // sidebar
  ['home','vendedores','crm','config'].forEach(t=>{
    const si=document.getElementById(`si-${t}`);
    if(si) si.classList.toggle('on', t===tab);
  });
  // páginas
  ['home','vendedores','crm','config'].forEach(t=>{
    const pg=document.getElementById(`pg-${t}`);
    if(pg) pg.classList.toggle('on', t===tab);
  });
  // período: ocultar no CRM e Config
  const tp=document.querySelector('.tb-period');
  if(tp) tp.style.display=(tab==='crm'||tab==='config')?'none':'';
  // render
  if(tab==='home')       renderHome();
  if(tab==='vendedores') renderVendedores();
  if(tab==='crm')        renderCRM();
  if(tab==='config')     renderConfig();
}

// ════════════════════════════════════════════════════════════
// ABA HOME
// ════════════════════════════════════════════════════════════
function renderHome() {
  const el=document.getElementById('home-body'); if(!el)return;
  const d=S.docs;
  const fat=d.reduce((s,r)=>s+docFat(r),0);
  const ped=new Set(d.map(r=>r.id_doc)).size;
  const cli=new Set(d.map(r=>r.id_cliente).filter(Boolean)).size;
  const ticket=ped?fat/ped:0;

  // canais
  const dMap=new Map(S.vendedores.map(v=>[v.id_vendedor,(v.departamento||'').trim().toUpperCase()]));
  let fDist=0,fRep=0,pDist=0,pRep=0;
  d.forEach(r=>{ const dp=dMap.get(r.id_vendedor)||''; if(dp==='DISTRIBUIDOR'){fDist+=docFat(r);pDist++;}else if(dp==='DISTRIBUICAO REPRESENTANTES'){fRep+=docFat(r);pRep++;} });

  // gráfico diário
  const dm=new Map(); d.forEach(r=>{ const dt=(r.data_faturamento||'').substring(0,10); if(dt)dm.set(dt,(dm.get(dt)||0)+docFat(r)); });
  const daily=[...dm.entries()].sort(([a],[b])=>a.localeCompare(b));
  const maxV=Math.max(...daily.map(([,v])=>v),1);

  // top clientes
  const cm=new Map(); d.forEach(r=>{ if(!r.id_cliente)return; if(!cm.has(r.id_cliente))cm.set(r.id_cliente,{nome:r.nome_cliente,fat:0}); cm.get(r.id_cliente).fat+=docFat(r); });
  const topCli=[...cm.values()].sort((a,b)=>b.fat-a.fat).slice(0,10);

  el.innerHTML=`
    <div class="kgrid">
      ${kc('💰','Faturamento',fmtK(fat),'kc-blue')}
      ${kc('🛒','Pedidos',ped,'kc-purple')}
      ${kc('👥','Clientes',cli,'kc-green')}
      ${kc('🎯','Ticket Médio',fmtK(ticket),'kc-yellow')}
    </div>
    <div class="cgrid">
      <div class="ccard"><div class="lbl">🏢 Distribuidor</div><div class="val">${fmtK(fDist)}</div><div class="sub">${pDist} pedidos</div></div>
      <div class="ccard"><div class="lbl">🤝 Representantes</div><div class="val">${fmtK(fRep)}</div><div class="sub">${pRep} pedidos</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="scard">
        <div class="scard-title">📈 Faturamento Diário</div>
        ${daily.length?daily.map(([dt,v])=>`
          <div class="bar-row">
            <span class="bar-lbl">${fmtD(dt)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxV*100)}%"></div></div>
            <span class="bar-val">${fmtK(v)}</span>
          </div>`).join(''):'<p style="color:#475569;font-size:12px">Sem dados no período</p>'}
      </div>
      <div class="scard">
        <div class="scard-title">🏆 Top 10 Clientes</div>
        ${topCli.map((c,i)=>`
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:10px;color:#475569;width:14px">${i+1}</span>
            <span style="flex:1;font-size:12px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nome}</span>
            <span style="font-size:12px;font-weight:600;color:#94a3b8;flex-shrink:0">${fmtK(c.fat)}</span>
          </div>`).join('')||'<p style="color:#475569;font-size:12px">Sem dados</p>'}
      </div>
    </div>
    <div class="scard">
      <div class="scard-title">📦 Últimos Pedidos</div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Data</th><th class="r">Valor</th><th>Cliente</th><th>Vendedor</th></tr></thead>
          <tbody>
            ${d.slice(0,10).map(r=>`<tr>
              <td>${fmtD(r.data_faturamento)}</td>
              <td class="r" style="font-weight:600">${fmt(docFat(r))}</td>
              <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.nome_cliente||'—'}</td>
              <td style="color:#64748b">${sN(r.nome_vendedor)}</td>
            </tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:#475569;padding:20px">Sem pedidos</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}
function kc(ic,lbl,val,cls){ return `<div class="kcard ${cls}"><div class="lbl">${ic} ${lbl}</div><div class="val">${val}</div></div>`; }

// ════════════════════════════════════════════════════════════
// ABA VENDEDORES
// ════════════════════════════════════════════════════════════
function renderVendedores() {
  const el=document.getElementById('vend-body'); if(!el)return;
  const allowedIds=new Set(S.vendedores.map(v=>v.id_vendedor));
  const vm=new Map();
  S.docs.forEach(d=>{
    if(!allowedIds.has(d.id_vendedor))return;
    if(!vm.has(d.id_vendedor)) vm.set(d.id_vendedor,{id:d.id_vendedor,nome:d.nome_vendedor||'',fat:0,cli:new Set(),ped:new Set()});
    const v=vm.get(d.id_vendedor); v.fat+=docFat(d); if(d.id_cliente)v.cli.add(d.id_cliente); if(d.id_doc)v.ped.add(d.id_doc);
  });
  const vl=[...vm.values()].map(v=>({...v,clientes:v.cli.size,pedidos:v.ped.size,ticket:v.ped.size?v.fat/v.ped.size:0})).sort((a,b)=>b.fat-a.fat);
  const fatTot=vl.reduce((s,v)=>s+v.fat,0);
  const maxF=Math.max(...vl.map(v=>v.fat),1);

  // saúde carteira
  const crmH=new Map();
  S.carteira.forEach(c=>{ const vid=c.id_vendedor_responsavel; if(!vid)return; if(!crmH.has(vid))crmH.set(vid,{a:0,t:0,r:0}); const h=crmH.get(vid); const st=getStatus(c); if(st==='ATIVO')h.a++; else if(st==='ATENCAO')h.t++; else if(st==='PERDIDO')h.r++; });

  el.innerHTML=`
    <div class="kgrid">
      ${kc('💰','Faturamento Total',fmtK(fatTot),'kc-blue')}
      ${kc('👤','Vendedores',vl.length,'kc-purple')}
      ${kc('👥','Clientes',new Set(S.docs.map(d=>d.id_cliente).filter(Boolean)).size,'kc-green')}
      ${kc('🛒','Pedidos',new Set(S.docs.map(d=>d.id_doc).filter(Boolean)).size,'kc-yellow')}
    </div>
    <div class="scard">
      <div class="scard-title">🏆 Ranking de Vendedores</div>
      ${vl.length?`<div style="overflow-x:auto"><table>
        <thead><tr><th style="width:24px"></th><th>Vendedor</th><th class="r">Faturamento</th><th class="r">Clientes</th><th class="r">Pedidos</th><th class="r">Ticket</th><th style="width:140px"></th></tr></thead>
        <tbody id="vend-tbody">
          ${vl.map((v,i)=>{
            const h=crmH.get(v.id)||{a:0,t:0,r:0};
            const exp=S.expandVend===v.id;
            const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
            // top 5 clientes
            const tcm=new Map(); S.docs.filter(d=>d.id_vendedor===v.id).forEach(d=>{ if(!d.id_cliente)return; if(!tcm.has(d.id_cliente))tcm.set(d.id_cliente,{nome:d.nome_cliente,fat:0}); tcm.get(d.id_cliente).fat+=docFat(d); });
            const tc=[...tcm.values()].sort((a,b)=>b.fat-a.fat).slice(0,5);
            return `<tr class="cl" onclick="toggleVend(${v.id})">
              <td><span style="font-size:11px;color:${exp?'#3b82f6':'#475569'}">${exp?'▼':'▶'}</span></td>
              <td style="font-weight:600">${sN(v.nome)} ${medal}</td>
              <td class="r" style="font-weight:700;color:#f1f5f9">${fmtK(v.fat)}</td>
              <td class="r">${v.clientes}</td>
              <td class="r">${v.pedidos}</td>
              <td class="r">${fmtK(v.ticket)}</td>
              <td><div class="bar-track" style="margin:0"><div class="bar-fill" style="width:${Math.round(v.fat/maxF*100)}%"></div></div></td>
            </tr>
            ${exp?`<tr class="expand-row"><td colspan="7"><div class="expand-inner">
              <div class="hgrid">
                <div class="hbox ha"><div class="n">${h.a}</div><div class="l">Ativos</div></div>
                <div class="hbox ht"><div class="n">${h.t}</div><div class="l">Atenção</div></div>
                <div class="hbox hr"><div class="n">${h.r}</div><div class="l">Em Risco</div></div>
              </div>
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Top 5 Clientes</div>
              ${tc.map(c=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #1e293b">
                <span style="color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${c.nome}</span>
                <span style="color:#94a3b8;flex-shrink:0;margin-left:8px">${fmtK(c.fat)}</span>
              </div>`).join('')||'<p style="color:#475569;font-size:12px">Sem pedidos</p>'}
            </div></td></tr>`:''}`;
          }).join('')}
        </tbody>
      </table></div>`:'<p style="color:#475569;text-align:center;padding:24px">Sem dados no período</p>'}
    </div>`;
}
function toggleVend(id){ S.expandVend=S.expandVend===id?null:id; renderVendedores(); }

// ════════════════════════════════════════════════════════════
// ABA CRM
// ════════════════════════════════════════════════════════════
function renderCRM() {
  renderUmbler();
  renderToday_check();
  renderLista();
}

function renderToday_check() {
  // só renderiza se o painel ainda não foi preenchido
  const el = document.getElementById('today-wrap');
  if (el && !el.innerHTML.trim()) loadToday();
}

function renderToday(tasks) {
  const el = document.getElementById('today-wrap'); if(!el)return;
  if(!tasks.length){ el.innerHTML=''; return; }
  el.innerHTML=`<div class="today-box">
    <div class="today-ttl">📋 Atividades de Hoje (${tasks.length})</div>
    ${tasks.map(t=>`<div class="today-item">
      <div class="today-left">
        ${tipoBdg(t.tipo)}
        <span class="today-nome">${t.nome_cliente}</span>
        <span class="today-txt">${t.texto||''}</span>
      </div>
      <button class="btn-res" onclick="resolverNota('${t.id}',true)">✓ Resolver</button>
    </div>`).join('')}
  </div>`;
}

function renderUmbler() {
  const el=document.getElementById('umbl-wrap'); if(!el)return;
  if(!S.umbler.length){ el.innerHTML=''; return; }
  const open=S.umblerOpen;
  el.innerHTML=`
    <div class="umbl-header ${open?'':'collapsed'}" onclick="toggleUmbler()">
      <span style="font-size:11px;color:#f87171">${open?'▼':'▶'}</span>
      <span class="umbl-title">📲 Contatos Sem Tratativa</span>
      <span class="umbl-badge">${S.umbler.length}</span>
    </div>
    ${open?`<div class="umbl-body">
      ${S.umbler.slice(0,8).map(c=>`<div class="umbl-item">
        <div class="umbl-nome">${c.nome_contato||'Sem nome'}</div>
        <div class="umbl-info">
          <span>${fmtP(c.telefone)}</span>
          <span>${sN(c.nome_atendente)}</span>
          <span>${fmtDT(c.ultimo_contato)}</span>
        </div>
        <div class="umbl-acts">
          <button class="btn-vinc" onclick="abrirVinc('${c.telefone}','${esc(c.nome_contato)}','${esc(c.nome_atendente)}')">🔗 Vincular</button>
          <button class="btn-nc" onclick="naoComercial('${c.telefone}')">✕ Não comercial</button>
        </div>
      </div>`).join('')}
    </div>`:''}`;
}
function toggleUmbler(){ S.umblerOpen=!S.umblerOpen; renderUmbler(); }

function renderLista() {
  const el=document.getElementById('cl-list'); if(!el)return;
  const data = S.mainTab==='carteira' ? filteredCarteira() : filteredProsp();
  if(!data.length){ el.innerHTML='<div class="cl-empty">Nenhum cliente encontrado</div>'; return; }
  el.innerHTML = data.map(c=>{
    const st=getStatus(c);
    const dim=S.dimMap.get(c.id_cliente)||{};
    const sel=S.selId===c.id_cliente;
    const dc=c.dias_sem_compra??dias(c.ultima_compra);
    return `<button class="cl-item${sel?' sel':''}" onclick="selCliente(${c.id_cliente})">
      <div class="cl-row1">
        <span class="cl-nome">${c.nome_cliente}</span>
        ${bdg(st)}
        ${dc>=30?'<span style="color:#f59e0b;font-size:12px;flex-shrink:0" title="Sem compra há '+dc+' dias">⚠</span>':''}
        ${S.overdueIds.has(c.id_cliente)?'<span style="color:#ef4444;font-size:12px;flex-shrink:0" title="Tarefa atrasada">🔔</span>':''}
      </div>
      <div class="cl-row2">${sN(c.nome_vendedor_responsavel)}</div>
      <div class="cl-row3">
        <span class="cl-row3-l">${dim.cidade?dim.cidade+(dim.uf?' - '+dim.uf:'')+'  ·  ':''}Últ. compra: ${c.ultima_compra?fmtD(c.ultima_compra):'—'}</span>
        ${dim.cnpj_cpf?`<span class="cl-cnpj">${fmtC(dim.cnpj_cpf)}</span>`:''}
      </div>
    </button>`;
  }).join('');
}

function filteredCarteira() {
  let d=S.carteira;
  if(S.search){ const s=S.search.toLowerCase(); d=d.filter(c=>{ if((c.nome_cliente||'').toLowerCase().includes(s))return true; const dim=S.dimMap.get(c.id_cliente)||{}; return (dim.cidade||'').toLowerCase().includes(s)||(dim.cnpj_cpf||'').replace(/\D/g,'').includes(s.replace(/\D/g,''))||String(c.id_cliente).includes(s); }); }
  if(S.subFilter!=='todos') d=d.filter(c=>{ const st=getStatus(c); if(S.subFilter==='ativo')return st==='ATIVO'; if(S.subFilter==='atencao')return st==='ATENCAO'; if(S.subFilter==='em_risco')return st==='PERDIDO'; return true; });
  return d;
}
function filteredProsp() {
  let d=S.prospeccao;
  if(S.search){ const s=S.search.toLowerCase(); d=d.filter(c=>(c.nome_cliente||'').toLowerCase().includes(s)); }
  if(S.pSub==='atencao') d=d.filter(c=>(c.dias_sem_interacao||0)>30);
  return [...d].sort((a,b)=>{ if(S.pSort==='nome_az')return(a.nome_cliente||'').localeCompare(b.nome_cliente||''); if(S.pSort==='mais_antigo')return(b.dias_sem_interacao||0)-(a.dias_sem_interacao||0); if(S.pSort==='vendedor_az')return(a.nome_vendedor_responsavel||'zzz').localeCompare(b.nome_vendedor_responsavel||'zzz'); return 0; });
}

// ── Drawer ──────────────────────────────────────────────────
async function selCliente(id) {
  S.selId=id;
  const lista=S.mainTab==='carteira'?S.carteira:S.prospeccao;
  S.selCliente=lista.find(c=>c.id_cliente===id)||null;
  renderLista(); // atualiza .sel

  // Abre drawer imediatamente com loading
  const drawer=document.getElementById('drawer');
  if(drawer) drawer.classList.add('open');
  document.getElementById('cd-ph')?.classList.add('hidden');
  document.getElementById('dw-title').textContent = S.selCliente?.nome_cliente||'Ficha';
  document.getElementById('dw-wa').style.display='none';
  document.getElementById('dw-body').innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:80px;color:#475569"><span class="spin">⟳</span></div>';

  await loadDetalhe(id);
  renderDrawer();
}

function closeDrawer() {
  document.getElementById('drawer')?.classList.remove('open');
  document.getElementById('cd-ph')?.classList.remove('hidden');
  S.selId=null; S.selCliente=null;
  renderLista();
}

function renderDrawer() {
  const el=document.getElementById('dw-body'); if(!el||!S.selCliente)return;
  const c=S.selCliente;
  const dim=S.dimMap.get(c.id_cliente)||{};
  const st=getStatus(c);
  const dc=c.dias_sem_compra??dias(c.ultima_compra);
  const fat=S.pedidos.reduce((s,p)=>s+docFat(p),0);
  const qtd=S.pedidos.length;

  // WhatsApp — primeiro telefone
  const telPrinc=S.telefones.find(t=>t.principal)||S.telefones[0];
  const waEl=document.getElementById('dw-wa');
  if(telPrinc&&waEl){ waEl.href=`https://wa.me/${(telPrinc.telefone||'').replace(/\D/g,'')}`; waEl.style.display='inline-flex'; }

  el.innerHTML=`
    <!-- Cabeçalho -->
    <div>
      <div class="dc-nome">${c.nome_cliente}</div>
      <div class="dc-badges">
        ${bdg(st)}
        <span style="font-size:11px;color:#64748b">${dc<9999?dc+' dias sem compra':'Sem compras'}</span>
        ${c.dias_sem_interacao!=null?`<span style="font-size:11px;color:#475569">· ${c.dias_sem_interacao}d sem interação</span>`:''}
      </div>
      <div class="dc-info">
        ${(dim.cnpj_cpf||c.cnpj_cpf)?`<span style="font-family:monospace">${fmtC(dim.cnpj_cpf||c.cnpj_cpf)}</span>`:''}
        ${(dim.cidade||c.cidade)?`<span>${dim.cidade||c.cidade}${(dim.uf||c.uf)?' - '+(dim.uf||c.uf):''}</span>`:''}
        ${dim.email?`<span>✉ ${dim.email}</span>`:''}
        <span style="color:#334155">Cód. ERP: ${c.id_cliente}</span>
      </div>
      <div class="dc-vendor">
        Vendedor: <strong>${sN(c.nome_vendedor_responsavel)}</strong>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kmini-row">
      <div class="kmini"><div class="l">Faturamento</div><div class="v">${fmt(fat)}</div></div>
      <div class="kmini"><div class="l">Pedidos</div><div class="v">${qtd}</div></div>
      <div class="kmini"><div class="l">Ticket Médio</div><div class="v">${fmt(qtd?fat/qtd:0)}</div></div>
    </div>

    <!-- Telefones -->
    <div>
      <div class="sec-head">
        <span class="sec-lbl">📞 Telefones</span>
        <button class="link-add" onclick="togglePhForm()">+ Adicionar</button>
      </div>
      <div id="ph-form" class="ph-form">
        <input id="ph-num" placeholder="Telefone" />
        <input id="ph-nome" placeholder="Nome do contato (opcional)" />
        <div class="ph-form-btns">
          <button class="btn-sv" style="padding:7px" onclick="savePhone(${c.id_cliente},'${esc(c.nome_cliente)}')">Salvar</button>
          <button style="font-size:12px;color:#64748b;padding:7px 10px" onclick="togglePhForm()">Cancelar</button>
        </div>
      </div>
      ${S.telefones.map(t=>`
        <div class="phone-card">
          <div class="ph-info">
            <span class="ph-num">${fmtP(t.telefone)}</span>
            ${t.nome_contato?`<span class="ph-name">${t.nome_contato}${t.cargo?' · '+t.cargo:''}</span>`:''}
            ${!t.nome_contato&&t.descricao?`<span class="ph-name">(${t.descricao})</span>`:''}
            ${t.principal?'<span class="ph-princ">Principal</span>':''}
          </div>
          <div class="ph-acts">
            <a class="ph-wa" href="https://wa.me/${(t.telefone||'').replace(/\D/g,'')}" target="_blank" title="Abrir WhatsApp">💬</a>
            <button class="ph-del" onclick="delPhone('${t.id}')" title="Remover">✕</button>
          </div>
        </div>`).join('')||'<p style="color:#475569;font-size:12px">Nenhum telefone</p>'}
    </div>

    <!-- Últimos Pedidos -->
    <div>
      <div class="sec-head"><span class="sec-lbl">📦 Últimos Pedidos</span></div>
      ${S.pedidos.length?`<table>
        <thead><tr><th>Data</th><th class="r">Valor</th><th class="r">Itens</th></tr></thead>
        <tbody>
          ${S.pedidos.map(p=>`<tr>
            <td>${fmtD(p.data_faturamento)}</td>
            <td class="r">${fmt(docFat(p))}</td>
            <td class="r">${p.qtd_itens_doc||0}</td>
          </tr>`).join('')}
        </tbody>
      </table>`:'<p style="color:#475569;font-size:12px">Sem pedidos no histórico</p>'}
    </div>

    <!-- Notas / Tarefas -->
    <div>
      <div class="sec-head"><span class="sec-lbl">📝 Tarefas e Notas</span></div>
      <div style="max-height:300px;overflow-y:auto">
        ${S.notas.map(n=>`
          <div class="nota-card${n.resolvido?' done':''}">
            <div class="nc-head">
              <div style="display:flex;align-items:center;gap:6px">
                ${tipoBdg(n.tipo)}
                <span class="nc-meta">${fmtD(n.data_criacao)}${n.criado_por?' · '+n.criado_por:''}</span>
              </div>
              ${!n.resolvido?`<button class="btn-res" onclick="resolverNota('${n.id}',false)">✓ Resolver</button>`:'<span style="font-size:10px;color:#334155">Resolvido</span>'}
            </div>
            <p class="nc-txt">${n.texto}</p>
            ${n.data_prevista?`<p class="nc-date">📅 Prevista: ${fmtD(n.data_prevista)}</p>`:''}
          </div>`).join('')||'<p style="color:#475569;font-size:12px">Nenhuma nota</p>'}
      </div>
    </div>

    <!-- Novo Registro -->
    <div class="note-box">
      <h4>Novo Registro</h4>
      <div class="row2">
        <select id="nota-tipo" onchange="toggleNotaDate()">
          <option value="OBSERVACAO">Observação</option>
          <option value="TAREFA">Tarefa</option>
          <option value="FOLLOWUP">Follow-up</option>
          <option value="LIGACAO">Ligação</option>
        </select>
        <input id="nota-criado" placeholder="Criado por" />
      </div>
      <textarea id="nota-texto" rows="3" placeholder="Texto da nota..."></textarea>
      <input id="nota-data" type="date" style="display:none" />
      <button class="btn-sv" onclick="salvarNota(${c.id_cliente},'${esc(c.nome_cliente)}',${c.id_vendedor_responsavel||'null'},'${esc(c.nome_vendedor_responsavel||'')}')">Salvar</button>
    </div>
  `;
}

function toggleNotaDate(){
  const t=document.getElementById('nota-tipo')?.value;
  const d=document.getElementById('nota-data');
  if(d) d.style.display=['TAREFA','FOLLOWUP'].includes(t)?'':'none';
}

// ════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════
function renderConfig(){
  const el=document.getElementById('cfg-body'); if(!el)return;
  el.innerHTML=`<div style="max-width:520px">
    <div class="scard" style="margin-bottom:16px">
      <div class="scard-title">⚙️ Parâmetros CRM</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div><label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px">Dias → Status ATENÇÃO</label><input type="number" value="30" /></div>
        <div><label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px">Dias → Status EM RISCO</label><input type="number" value="90" /></div>
        <div><label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px">Dias → PROSPECÇÃO</label><input type="number" value="180" /></div>
        <p style="font-size:11px;color:#475569">⚠ Configuração via tabela <code>atac_crm_config</code> — em breve</p>
      </div>
    </div>
    <div class="scard" style="margin-bottom:16px">
      <div class="scard-title">🔗 Integrações</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:#0f172a;border:1px solid #334155;border-radius:8px">
          <div><p style="font-size:13px;font-weight:600;color:#e2e8f0">Umbler Talk (WhatsApp)</p><p style="font-size:11px;color:#64748b">Edge Function UMBLERATC</p></div>
          <span style="font-size:10px;background:#05200e;color:#4ade80;border:1px solid #166534;border-radius:999px;padding:2px 8px">Ativo</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:#0f172a;border:1px solid #334155;border-radius:8px">
          <div><p style="font-size:13px;font-weight:600;color:#e2e8f0">ERP Firebird → Supabase</p><p style="font-size:11px;color:#64748b">Sync automático</p></div>
          <span style="font-size:10px;background:#05200e;color:#4ade80;border:1px solid #166534;border-radius:999px;padding:2px 8px">Ativo</span>
        </div>
      </div>
    </div>
    <div class="scard">
      <div class="scard-title">ℹ️ Sobre</div>
      <div style="font-size:12px;color:#64748b;display:flex;flex-direction:column;gap:4px">
        <p>Stonni Atacado CRM v2.1</p>
        <p>Supabase: vishxwdxqiygbxmtpfoy</p>
        <p>Hub: <a href="https://bononi-hub.vercel.app" style="color:#3b82f6">bononi-hub.vercel.app</a></p>
      </div>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════
// AÇÕES
// ════════════════════════════════════════════════════════════
async function resolverNota(id, isToday) {
  await sbUpdate('atac_crm_notas','id',id,{resolvido:true,data_resolucao:new Date().toISOString()});
  toast('Resolvido!');
  await Promise.all([loadToday(), loadOverdue()]);
  if(S.selId){ await loadDetalhe(S.selId); renderDrawer(); }
  renderLista();
}

async function salvarNota(cId,cNome,vId,vNome){
  const tipo=document.getElementById('nota-tipo')?.value;
  const texto=document.getElementById('nota-texto')?.value?.trim();
  const criado=document.getElementById('nota-criado')?.value?.trim();
  const data=document.getElementById('nota-data')?.value;
  if(!texto||!criado){ toast('Preencha texto e criado por','err'); return; }
  if(['TAREFA','FOLLOWUP'].includes(tipo)&&!data){ toast('Informe a data prevista','err'); return; }
  await sbInsert('atac_crm_notas',{id_cliente:cId,nome_cliente:cNome,tipo,texto,criado_por:criado,data_prevista:data||null,id_vendedor_responsavel:vId||null,nome_vendedor_responsavel:vNome||null});
  toast('Registro salvo!');
  await loadDetalhe(cId); renderDrawer();
}

function togglePhForm(){
  const f=document.getElementById('ph-form'); if(f) f.classList.toggle('open');
}
async function savePhone(cId,cNome){
  const tel=document.getElementById('ph-num')?.value?.trim();
  const nome=document.getElementById('ph-nome')?.value?.trim();
  if(!tel){ toast('Informe o telefone','err'); return; }
  await sbInsert('atac_cliente_telefones',{id_cliente:cId,nome_cliente:cNome,telefone:tel,nome_contato:nome||null,principal:false});
  toast('Telefone adicionado!');
  await loadDetalhe(cId); renderDrawer();
}
async function delPhone(id){
  if(!confirm('Remover telefone?'))return;
  await sbDel('atac_cliente_telefones','id',id);
  toast('Removido!');
  await loadDetalhe(S.selId); renderDrawer();
}

async function naoComercial(tel){
  const motivo=prompt('Motivo (obrigatório):');
  if(!motivo?.trim())return;
  await sbUpdate('atac_umbler_contatos','telefone',tel,{nao_comercial:true,motivo_nao_comercial:motivo});
  toast('Marcado como não comercial');
  await loadUmbler(); renderUmbler();
}

// modal vincular
function abrirVinc(tel,nome,atend){
  const m=document.getElementById('modal-vinc'); if(!m)return;
  m.dataset.tel=tel; m.dataset.nome=nome; m.dataset.atend=atend;
  m.classList.add('open');
  document.getElementById('vinc-search').value='';
  document.getElementById('vinc-results').innerHTML='<p class="empty-msg">Digite para buscar...</p>';
}
function closeVinc(){ document.getElementById('modal-vinc')?.classList.remove('open'); }

async function searchVinc(){
  const q=document.getElementById('vinc-search')?.value?.trim(); if(!q||q.length<2)return;
  const d=await sbQ('atac_clientes',`select=id_cliente,nome_cliente,cnpj_cpf,cidade,uf&or=(nome_cliente.ilike.*${encodeURIComponent(q)}*,cnpj_cpf.ilike.*${q.replace(/\D/g,'')}*)`);
  const res=Array.isArray(d)?d.slice(0,12):[];
  const el=document.getElementById('vinc-results'); if(!el)return;
  el.innerHTML=res.length?res.map(c=>`<button class="mres-btn" onclick="confirmarVinc(${c.id_cliente},'${esc(c.nome_cliente)}')">
    <div class="mres-nome">${c.nome_cliente}</div>
    ${(c.cnpj_cpf||c.cidade)?`<div class="mres-meta">${c.cnpj_cpf?fmtC(c.cnpj_cpf)+' · ':''}${c.cidade||''}</div>`:''}
  </button>`).join(''):'<p class="empty-msg">Nenhum cliente encontrado</p>';
}
async function confirmarVinc(cId,cNome){
  const m=document.getElementById('modal-vinc'); if(!m)return;
  const tel=m.dataset.tel;
  await sbInsert('atac_cliente_telefones',{id_cliente:cId,nome_cliente:cNome,telefone:tel,descricao:'Umbler',principal:true});
  toast(`Vinculado → ${cNome}`);
  closeVinc();
  await Promise.all([loadUmbler(), loadCarteira(), loadProspeccao()]);
  renderUmbler(); renderLista();
}

// ── Controles UI ────────────────────────────────────────────
function setMainTab(tab){
  S.mainTab=tab; S.selId=null; S.selCliente=null;
  closeDrawer();
  document.getElementById('tab-c')?.classList.toggle('on', tab==='carteira');
  document.getElementById('tab-p')?.classList.toggle('on', tab==='prospeccao');
  document.getElementById('ctrl-c')?.classList.toggle('hidden', tab!=='carteira');
  document.getElementById('ctrl-p')?.classList.toggle('hidden', tab!=='prospeccao');
  renderLista();
}
function setSub(f){
  S.subFilter=f;
  document.querySelectorAll('[data-sf]').forEach(el=>el.classList.toggle('on',el.dataset.sf===f));
  renderLista();
}
function setPSub(v){ S.pSub=v; document.querySelectorAll('[data-psub]').forEach(el=>el.classList.toggle('on',el.dataset.psub===v)); renderLista(); }
function setPSort(v){ S.pSort=v; renderLista(); }
function handleSearch(v){ S.search=v; renderLista(); }

// helper escape para strings em onclick
function esc(s){ return (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

// ── EXPORT ──────────────────────────────────────────────────
window.APP = { init };
window.gotoTab = gotoTab;
window.applyPeriod = applyPeriod;
window.setMainTab = setMainTab;
window.setSub = setSub;
window.setPSub = setPSub;
window.setPSort = setPSort;
window.handleSearch = handleSearch;
window.toggleVend = toggleVend;
window.selCliente = selCliente;
window.closeDrawer = closeDrawer;
window.resolverNota = resolverNota;
window.salvarNota = salvarNota;
window.togglePhForm = togglePhForm;
window.savePhone = savePhone;
window.delPhone = delPhone;
window.naoComercial = naoComercial;
window.abrirVinc = abrirVinc;
window.closeVinc = closeVinc;
window.searchVinc = searchVinc;
window.confirmarVinc = confirmarVinc;
window.toggleUmbler = toggleUmbler;
window.toggleNotaDate = toggleNotaDate;
