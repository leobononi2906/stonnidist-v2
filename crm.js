// ═══════════════════════════════════════════════════════════
// STONNI ATACADO — crm.js  v4
// window.SUPA_URL, window.SUPA_KEY, window.sb → index.html
// ═══════════════════════════════════════════════════════════

// ── CONFIG DEFAULTS (overridden by atac_config_crm) ────────
const CFG = {
  compra_saudavel_dias: 60,
  compra_atencao_dias: 90,
  compra_risco_dias: 180,
  interacao_saudavel_dias: 30,
  interacao_atencao_dias: 60,
  prospeccao_prazo_contato_dias: 15,
  prospeccao_perda_vinculo_dias: 180,
};

// ── FILTROS GLOBAIS ────────────────────────────────────────
const F = {
  period: 'mes_atual',
  dtStart: '', dtEnd: '',
  vendedorId: null,  // number | null
  empresaId: null,   // number | null
};

// ── ESTADO ─────────────────────────────────────────────────
const S = {
  tab: 'home',
  docs: [], vendedores: [], empresas: [], dimMap: new Map(),
  carteira: [], prospeccao: [], umbler: [], umblerVendMap: [],
  notas: [], telefones: [], pedidos: [],
  overdueIds: new Set(),
  mainTab: 'carteira',
  subFilter: 'todos',
  prospTab: 'minha',   // 'minha' | 'geral'
  pSub: 'todos', pSort: 'nome_az',
  search: '',
  selId: null, selCliente: null,
  expandVend: null,
  umblerOpen: true,
  // prospecção geral (sem vendedor) e vencidos (prazo expirado)
  prospGeral: [],
  prospVencidos: new Set(),
};

// ── FORMATADORES ───────────────────────────────────────────
const R = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const fmt  = v => (v==null||isNaN(v))?'—':R.format(v);
const fmtK = v => { if(v==null||isNaN(v))return'—';const a=Math.abs(v);if(a>=1e6)return`R$${(v/1e6).toFixed(1)}M`;if(a>=1e3)return`R$${(v/1e3).toFixed(0)}k`;return fmt(v);};
const fmtD = d => { if(!d)return'—';return new Date(d.substring(0,10)+'T12:00:00').toLocaleDateString('pt-BR');};
const fmtDT= d => { if(!d)return'—';const dt=new Date(d);return`${dt.toLocaleDateString('pt-BR')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;};
const fmtP = p => { if(!p)return'—';const d=p.replace(/\D/g,'');if(d.length===11)return`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;if(d.length===10)return`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;return p;};
const fmtC = v => { if(!v)return'—';const d=v.replace(/\D/g,'');if(d.length===14)return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');return v;};
const sN   = n => { if(!n)return'—';const p=n.trim().split(' ');if(p.length===1)return p[0];return`${p[0]} ${p[p.length-1][0]}.`;};
const dias = d => { if(!d)return 9999;return Math.floor((Date.now()-new Date(d.substring(0,10)+'T12:00:00').getTime())/86400000);};
const docFat = d => d?.faturamento_liquido ?? d?.faturamento_doc ?? 0;
const esc  = s => (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");

// ── STATUS (dois semáforos) ────────────────────────────────
function getStatusCompra(d) {
  if(d<=CFG.compra_saudavel_dias) return 'SAUDAVEL';
  if(d<=CFG.compra_atencao_dias)  return 'ATENCAO';
  if(d<=CFG.compra_risco_dias)    return 'RISCO';
  return 'PERDIDO';
}
function getStatusInteracao(d) {
  if(d<=CFG.interacao_saudavel_dias) return 'SAUDAVEL';
  if(d<=CFG.interacao_atencao_dias)  return 'ATENCAO';
  return 'FRIO';
}
function getStatus(c) {
  const dc = c.dias_sem_compra ?? dias(c.ultima_compra);
  const di = c.dias_sem_interacao ?? dc;
  if(dc > CFG.compra_risco_dias) return 'PROSPECCAO';
  const lvl = ['SAUDAVEL','ATENCAO','RISCO','FRIO','PERDIDO'];
  const pior = Math.max(lvl.indexOf(getStatusCompra(dc)), lvl.indexOf(getStatusInteracao(di)));
  if(pior<=0) return 'ATIVO';
  if(pior<=2) return 'ATENCAO';
  return 'PERDIDO';
}
function bdg(s) {
  const m = {ATIVO:['bdg-a','Ativo'],ATENCAO:['bdg-t','Atenção'],PERDIDO:['bdg-r','Em Risco'],PROSPECCAO:['bdg-p','Prospecção']};
  const [cls,lbl]=m[s]||m.PROSPECCAO;
  return `<span class="bdg ${cls}">${lbl}</span>`;
}
function tipoBdg(t) {
  const m={OBSERVACAO:'bdg-obs',TAREFA:'bdg-tar',FOLLOWUP:'bdg-fol',LIGACAO:'bdg-lig'};
  return `<span class="bdg-tipo ${m[t]||'bdg-obs'}">${t}</span>`;
}
function semaforo(c) {
  const dc=c.dias_sem_compra??dias(c.ultima_compra);
  const di=c.dias_sem_interacao??dc;
  const sc=getStatusCompra(dc); const si=getStatusInteracao(di);
  const cls={SAUDAVEL:'sem-ok',ATENCAO:'sem-at',RISCO:'sem-ri',FRIO:'sem-ri',PERDIDO:'sem-ri'};
  return `<div class="semaforo">
    <span class="sem-item ${cls[sc]}" title="Compra: ${dc}d">🛒 ${dc}d</span>
    <span class="sem-item ${cls[si]}" title="Interação: ${di}d">💬 ${di}d</span>
  </div>`;
}

// ── SUPABASE HELPERS ───────────────────────────────────────
async function getToken() {
  const s=(await window.sb.auth.getSession()).data.session;
  return s?.access_token||window.SUPA_KEY;
}
async function sbQ(table,params='') {
  const r=await fetch(`${window.SUPA_URL}/rest/v1/${table}?${params}&limit=9999`,{
    headers:{apikey:window.SUPA_KEY,Authorization:`Bearer ${await getToken()}`,'Content-Type':'application/json'}
  });
  if(!r.ok){console.error('sbQ',table,r.status);return[];}
  return r.json();
}
async function sbInsert(table,body) {
  return fetch(`${window.SUPA_URL}/rest/v1/${table}`,{
    method:'POST',headers:{apikey:window.SUPA_KEY,Authorization:`Bearer ${await getToken()}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)
  });
}
async function sbUpdate(table,field,val,body) {
  return fetch(`${window.SUPA_URL}/rest/v1/${table}?${field}=eq.${encodeURIComponent(val)}`,{
    method:'PATCH',headers:{apikey:window.SUPA_KEY,Authorization:`Bearer ${await getToken()}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)
  });
}
async function sbUpsert(table,body,conflict) {
  return fetch(`${window.SUPA_URL}/rest/v1/${table}?on_conflict=${conflict}`,{
    method:'POST',headers:{apikey:window.SUPA_KEY,Authorization:`Bearer ${await getToken()}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)
  });
}
async function sbDel(table,field,val) {
  return fetch(`${window.SUPA_URL}/rest/v1/${table}?${field}=eq.${encodeURIComponent(val)}`,{
    method:'DELETE',headers:{apikey:window.SUPA_KEY,Authorization:`Bearer ${await getToken()}`}
  });
}

// ── TOAST ──────────────────────────────────────────────────
function toast(msg,tipo='ok') {
  const el=document.createElement('div');
  el.style.cssText=`position:fixed;bottom:20px;right:20px;z-index:9999;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:opacity .3s;background:${tipo==='err'?'#dc2626':'#16a34a'};color:#fff`;
  el.textContent=msg;document.body.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300);},2500);
}

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
async function init() {
  initPeriod();
  await Promise.all([loadConfig(), loadVendedores(), loadDimMap()]);
  populateVendFilter();
  await Promise.all([loadDocs(), loadCarteira(), loadProspeccao(), loadUmbler(), loadUmblerVendMap(), loadOverdue(), loadToday()]);
  gotoTab('crm'); // abre direto no CRM
}

function initPeriod() {
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  setRange(new Date(y,m,1), new Date(y,m+1,0));
}
function setRange(s,e) {
  const p=n=>String(n).padStart(2,'0');
  F.dtStart=`${s.getFullYear()}-${p(s.getMonth()+1)}-${p(s.getDate())}`;
  F.dtEnd=`${e.getFullYear()}-${p(e.getMonth()+1)}-${p(e.getDate())}`;
}

// ── filtros globais ────────────────────────────────────────
function onPeriodChange(v) {
  F.period=v;
  const n=new Date(),y=n.getFullYear(),m=n.getMonth();
  const cst=document.getElementById('f-start'),ced=document.getElementById('f-end'),sep=document.getElementById('f-sep');
  const show=(v==='custom');
  cst.classList.toggle('hidden',!show); ced.classList.toggle('hidden',!show); sep.classList.toggle('hidden',!show);
  if(v==='mes_atual')   setRange(new Date(y,m,1),new Date(y,m+1,0));
  else if(v==='mes_anterior') setRange(new Date(y,m-1,1),new Date(y,m,0));
  else if(v==='ult_3m') setRange(new Date(y,m-2,1),new Date(y,m+1,0));
  else if(v==='ult_6m') setRange(new Date(y,m-5,1),new Date(y,m+1,0));
  else if(v==='ano_atual') setRange(new Date(y,0,1),new Date(y,11,31));
  if(v!=='custom') refreshDocs();
}
function onCustomDate() {
  const s=document.getElementById('f-start').value, e=document.getElementById('f-end').value;
  if(s&&e){F.dtStart=s;F.dtEnd=e;refreshDocs();}
}
function onVendChange(v) {
  F.vendedorId=v?Number(v):null;
  refreshDocs();
  // recarrega CRM com filtro de vendedor
  loadCarteira().then(()=>{loadProspeccao().then(()=>{if(S.tab==='crm')renderCRM();});});
  loadUmbler();
}
function onEmpChange(v) {
  F.empresaId=v?Number(v):null;
  refreshDocs();
}
async function refreshDocs() {
  await loadDocs();
  if(S.tab==='home')renderHome();
  if(S.tab==='vendedores')renderVendedores();
}
function populateVendFilter() {
  const sel=document.getElementById('f-vend'); if(!sel)return;
  sel.innerHTML='<option value="">Todos</option>'+S.vendedores.map(v=>`<option value="${v.id_vendedor}">${sN(v.nome_vendedor)}</option>`).join('');
}
function populateEmpFilter() {
  const sel=document.getElementById('f-emp'); if(!sel)return;
  sel.innerHTML='<option value="">Todas</option>'+S.empresas.map(e=>`<option value="${e.id}">${e.nome}</option>`).join('');
}

// ══════════════════════════════════════════════════════════
// LOAD DATA
// ══════════════════════════════════════════════════════════
async function loadConfig() {
  const d=await sbQ('atac_config_crm','select=chave,valor');
  if(Array.isArray(d)) d.forEach(r=>{if(CFG.hasOwnProperty(r.chave))CFG[r.chave]=Number(r.valor);});
}
async function loadVendedores() {
  const d=await sbQ('vw_dim_vendedor','select=id_vendedor,nome_vendedor,departamento');
  S.vendedores=(Array.isArray(d)?d:[]).filter(v=>{const dept=(v.departamento||'').trim().toUpperCase();return dept==='DISTRIBUIDOR'||dept==='DISTRIBUICAO REPRESENTANTES';});
}
async function loadDimMap() {
  const d=await sbQ('atac_clientes','select=id_cliente,cnpj_cpf,cidade,uf,telefone1,email&situacao=eq.A');
  S.dimMap=new Map();(Array.isArray(d)?d:[]).forEach(r=>S.dimMap.set(r.id_cliente,r));
}
async function loadDocs() {
  let params=`select=id_doc,id_vendedor,nome_vendedor,id_cliente,nome_cliente,id_empresa,empresa,data_faturamento,faturamento_doc,faturamento_liquido,qtd_itens_doc&tipo_saida=eq.DISTRIBUICAO&data_faturamento=gte.${F.dtStart}&data_faturamento=lte.${F.dtEnd}&order=data_faturamento.desc`;
  if(F.vendedorId) params+=`&id_vendedor=eq.${F.vendedorId}`;
  if(F.empresaId)  params+=`&id_empresa=eq.${F.empresaId}`;
  const d=await sbQ('vw_comercial_docs_faturados',params);
  const seen=new Set();
  S.docs=(Array.isArray(d)?d:[]).filter(r=>{if(!r.id_doc||seen.has(r.id_doc))return false;seen.add(r.id_doc);return true;});
  // extrair empresas para o filtro
  const em=new Map(); S.docs.forEach(r=>{if(r.id_empresa&&r.empresa)em.set(r.id_empresa,r.empresa);});
  S.empresas=[...em.entries()].map(([id,nome])=>({id,nome}));
  populateEmpFilter();
}
async function loadCarteira() {
  let params='select=*&order=dias_sem_interacao.desc.nullslast';
  if(F.vendedorId) params+=`&id_vendedor_responsavel=eq.${F.vendedorId}`;
  const d=await sbQ('atac_crm_clientes',params);
  S.carteira=(Array.isArray(d)?d:[]).filter(c=>getStatus(c)!=='PROSPECCAO');
}
async function loadProspeccao() {
  // Prospecção do vendedor (com vínculo)
  let params='select=*&status_crm=eq.PROSPECCAO&id_vendedor_responsavel=not.is.null&order=dias_sem_interacao.desc.nullslast';
  if(F.vendedorId) params+=`&id_vendedor_responsavel=eq.${F.vendedorId}`;
  const d=await sbQ('atac_crm_clientes',params);
  const prosp=Array.isArray(d)?d:[];

  // Prospecção Geral (sem vendedor vinculado)
  const gParams='select=*&status_crm=eq.PROSPECCAO&id_vendedor_responsavel=is.null&order=dias_sem_compra.desc.nullslast';
  const gd=await sbQ('atac_crm_clientes',gParams);
  S.prospGeral=Array.isArray(gd)?gd:[];

  // Verificar vencimentos: vendedor assumiu mas não interagiu no prazo
  // Buscar data de atribuição em atac_cliente_vendedor
  if(prosp.length){
    const ids=prosp.map(c=>c.id_cliente).join(',');
    const vincData=await sbQ('atac_cliente_vendedor',
      `select=id_cliente,atualizado_em&id_cliente=in.(${ids})`);
    const vincMap=new Map((Array.isArray(vincData)?vincData:[]).map(v=>[v.id_cliente,v.atualizado_em]));

    const prazo=CFG.prospeccao_prazo_contato_dias;
    const vencidos=new Set();
    const hoje=Date.now();

    for(const c of prosp){
      const atrib=vincMap.get(c.id_cliente);
      if(!atrib) continue;
      const diasAtrib=Math.floor((hoje-new Date(atrib).getTime())/86400000);
      // Vencido = atribuído há mais dias que o prazo E sem interação desde a atribuição
      if(diasAtrib>prazo && (c.dias_sem_interacao==null || c.dias_sem_interacao>=diasAtrib)){
        vencidos.add(c.id_cliente);
        // Liberar automaticamente: remove vínculo → volta para Prospecção Geral
        await sbDel('atac_cliente_vendedor','id_cliente',c.id_cliente);
      }
    }
    S.prospVencidos=vencidos;
    // Remove os vencidos da lista local (já foram liberados)
    S.prospeccao=prosp.filter(c=>!vencidos.has(c.id_cliente));
    // Recarrega geral para incluir os recém-liberados
    if(vencidos.size>0){
      const gd2=await sbQ('atac_crm_clientes','select=*&status_crm=eq.PROSPECCAO&id_vendedor_responsavel=is.null&order=dias_sem_compra.desc.nullslast');
      S.prospGeral=Array.isArray(gd2)?gd2:[];
      if(vencidos.size>0) toast(`${vencidos.size} cliente(s) devolvido(s) à Prospecção Geral por prazo vencido`,'err');
    }
  } else {
    S.prospeccao=prosp;
    S.prospVencidos=new Set();
  }
}
async function loadUmbler() {
  const [cts,tels]=await Promise.all([
    sbQ('atac_umbler_contatos','select=telefone,nome_contato,nome_atendente,ultimo_contato&nao_comercial=eq.false&order=ultimo_contato.desc'),
    sbQ('atac_cliente_telefones','select=telefone'),
  ]);
  const vinc=new Set((Array.isArray(tels)?tels:[]).map(t=>t.telefone));
  let umbler=(Array.isArray(cts)?cts:[]).filter(c=>!vinc.has(c.telefone));
  // filtro por vendedor: via atac_umbler_vendedor
  if(F.vendedorId&&S.umblerVendMap.length) {
    const uvMap=S.umblerVendMap.find(u=>u.id_vendedor_erp===F.vendedorId);
    if(uvMap) {
      const nomes=[(uvMap.usuario_umbler||'').toLowerCase(),(uvMap.nome_vendedor_erp||'').toLowerCase()].filter(Boolean);
      umbler=umbler.filter(c=>nomes.includes((c.nome_atendente||'').toLowerCase()));
    } else umbler=[];
  }
  S.umbler=umbler;
  const cnt=S.umbler.length;
  const el=document.getElementById('umbl-cnt');
  if(el){el.textContent=cnt;el.classList.toggle('hidden',cnt===0);}
}
async function loadUmblerVendMap() {
  const d=await sbQ('atac_umbler_vendedor','select=id,id_vendedor_erp,usuario_umbler,nome_vendedor_erp');
  S.umblerVendMap=Array.isArray(d)?d:[];
}
async function loadOverdue() {
  const today=new Date().toISOString().split('T')[0];
  let params=`select=id_cliente&resolvido=eq.false&data_prevista=lt.${today}`;
  if(F.vendedorId) params+=`&id_vendedor_responsavel=eq.${F.vendedorId}`;
  const d=await sbQ('atac_crm_notas',params);
  S.overdueIds=new Set((Array.isArray(d)?d:[]).map(r=>r.id_cliente));
}
async function loadToday() {
  const today=new Date().toISOString().split('T')[0];
  let params=`select=id,tipo,nome_cliente,texto&resolvido=eq.false&data_prevista=eq.${today}&order=nome_cliente.asc`;
  if(F.vendedorId) params+=`&id_vendedor_responsavel=eq.${F.vendedorId}`;
  const d=await sbQ('atac_crm_notas',params);
  renderToday(Array.isArray(d)?d:[]);
}
async function loadDetalhe(id) {
  const [notas,tels,peds]=await Promise.all([
    sbQ('atac_crm_notas',`select=*&id_cliente=eq.${id}&order=data_criacao.desc`),
    sbQ('atac_cliente_telefones',`select=*&id_cliente=eq.${id}&order=principal.desc`),
    sbQ('vw_comercial_docs_faturados',`select=data_faturamento,faturamento_doc,faturamento_liquido,qtd_itens_doc&tipo_saida=eq.DISTRIBUICAO&id_cliente=eq.${id}&order=data_faturamento.desc&limit=10`),
  ]);
  S.notas=Array.isArray(notas)?notas:[];
  S.telefones=Array.isArray(tels)?tels:[];
  S.pedidos=Array.isArray(peds)?peds:[];
}
// Docs dos 3 meses anteriores (para comparativo na aba vendedores)
async function loadDocs3m() {
  const n=new Date(),y=n.getFullYear(),m=n.getMonth();
  const s3=new Date(y,m-3,1), e3=new Date(y,m,0);
  const p3=n=>String(n).padStart(2,'0');
  const s3s=`${s3.getFullYear()}-${p3(s3.getMonth()+1)}-${p3(s3.getDate())}`;
  const e3s=`${e3.getFullYear()}-${p3(e3.getMonth()+1)}-${p3(e3.getDate())}`;
  let params=`select=id_doc,id_vendedor,id_cliente,nome_cliente,faturamento_doc,faturamento_liquido&tipo_saida=eq.DISTRIBUICAO&data_faturamento=gte.${s3s}&data_faturamento=lte.${e3s}`;
  if(F.vendedorId) params+=`&id_vendedor=eq.${F.vendedorId}`;
  const d=await sbQ('vw_comercial_docs_faturados',params);
  const seen=new Set();
  return (Array.isArray(d)?d:[]).filter(r=>{if(!r.id_doc||seen.has(r.id_doc))return false;seen.add(r.id_doc);return true;});
}

// ══════════════════════════════════════════════════════════
// NAVEGAÇÃO
// ══════════════════════════════════════════════════════════
function gotoTab(tab) {
  S.tab=tab;
  ['home','vendedores','crm','config'].forEach(t=>{
    document.getElementById(`si-${t}`)?.classList.toggle('on',t===tab);
    document.getElementById(`pg-${t}`)?.classList.toggle('on',t===tab);
  });
  if(tab==='home')renderHome();
  if(tab==='vendedores')renderVendedores();
  if(tab==='crm')renderCRM();
  if(tab==='config')renderConfig();
}

// ══════════════════════════════════════════════════════════
// ABA HOME
// ══════════════════════════════════════════════════════════
function renderHome() {
  const el=document.getElementById('home-body');if(!el)return;
  const d=S.docs;
  const fat=d.reduce((s,r)=>s+docFat(r),0);
  const ped=new Set(d.map(r=>r.id_doc)).size;
  const cli=new Set(d.map(r=>r.id_cliente).filter(Boolean)).size;
  const ticket=ped?fat/ped:0;

  const dMap=new Map(S.vendedores.map(v=>[v.id_vendedor,(v.departamento||'').trim().toUpperCase()]));
  let fD=0,fR=0,pD=0,pR=0;
  d.forEach(r=>{const dp=dMap.get(r.id_vendedor)||'';if(dp==='DISTRIBUIDOR'){fD+=docFat(r);pD++;}else if(dp==='DISTRIBUICAO REPRESENTANTES'){fR+=docFat(r);pR++;}});

  const dm=new Map();
  d.forEach(r=>{const dt=(r.data_faturamento||'').substring(0,10);if(dt)dm.set(dt,(dm.get(dt)||0)+docFat(r));});
  const daily=[...dm.entries()].sort(([a],[b])=>a.localeCompare(b));
  const maxV=Math.max(...daily.map(([,v])=>v),1);

  const cm=new Map();
  d.forEach(r=>{if(!r.id_cliente)return;if(!cm.has(r.id_cliente))cm.set(r.id_cliente,{nome:r.nome_cliente,fat:0});cm.get(r.id_cliente).fat+=docFat(r);});
  const topCli=[...cm.values()].sort((a,b)=>b.fat-a.fat).slice(0,10);

  el.innerHTML=`
    <div class="kgrid">
      ${kc('💰','Faturamento',fmtK(fat),'kc-b')}${kc('🛒','Pedidos',ped,'kc-p')}${kc('👥','Clientes',cli,'kc-g')}${kc('🎯','Ticket Médio',fmtK(ticket),'kc-y')}
    </div>
    <div class="cgrid">
      <div class="ccard"><div class="lbl">🏢 Distribuidor (Internos)</div><div class="val">${fmtK(fD)}</div><div class="sub">${pD} pedidos</div></div>
      <div class="ccard"><div class="lbl">🤝 Representantes</div><div class="val">${fmtK(fR)}</div><div class="sub">${pR} pedidos</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="scard">
        <div class="scard-title">📈 Faturamento Diário</div>
        ${daily.length?daily.map(([dt,v])=>`<div class="bar-row"><span class="bar-lbl">${fmtD(dt)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxV*100)}%"></div></div><span class="bar-val">${fmtK(v)}</span></div>`).join(''):'<p style="color:#475569;font-size:12px">Sem dados</p>'}
      </div>
      <div class="scard">
        <div class="scard-title">🏆 Top 10 Clientes</div>
        ${topCli.map((c,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="font-size:10px;color:#475569;width:14px">${i+1}</span><span style="flex:1;font-size:12px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nome}</span><span style="font-size:12px;font-weight:600;color:#94a3b8;flex-shrink:0">${fmtK(c.fat)}</span></div>`).join('')||'<p style="color:#475569;font-size:12px">Sem dados</p>'}
      </div>
    </div>
    <div class="scard">
      <div class="scard-title">📦 Últimos Pedidos</div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th>Data</th><th class="r">Valor</th><th>Cliente</th><th>Vendedor</th></tr></thead>
        <tbody>${d.slice(0,10).map(r=>`<tr><td>${fmtD(r.data_faturamento)}</td><td class="r" style="font-weight:600">${fmt(docFat(r))}</td><td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.nome_cliente||'—'}</td><td style="color:#64748b">${sN(r.nome_vendedor)}</td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:#475569;padding:20px">Sem pedidos no período</td></tr>'}</tbody>
      </table></div>
    </div>`;
}
function kc(ic,lbl,val,cls){return`<div class="kcard ${cls}"><div class="lbl">${ic} ${lbl}</div><div class="val">${val}</div></div>`;}

// ══════════════════════════════════════════════════════════
// ABA VENDEDORES (com comparativo 3 meses)
// ══════════════════════════════════════════════════════════
async function renderVendedores() {
  const el=document.getElementById('vend-body');if(!el)return;
  el.innerHTML='<div class="empty-msg"><span class="spin">⟳</span> Calculando comparativo...</div>';

  const allowedIds=new Set(S.vendedores.map(v=>v.id_vendedor));
  const vm=new Map();
  S.docs.forEach(d=>{
    if(!allowedIds.has(d.id_vendedor))return;
    if(!vm.has(d.id_vendedor))vm.set(d.id_vendedor,{id:d.id_vendedor,nome:d.nome_vendedor||'',fat:0,cli:new Set(),ped:new Set()});
    const v=vm.get(d.id_vendedor);v.fat+=docFat(d);if(d.id_cliente)v.cli.add(d.id_cliente);if(d.id_doc)v.ped.add(d.id_doc);
  });
  const vl=[...vm.values()].map(v=>({...v,clientes:v.cli.size,pedidos:v.ped.size,ticket:v.ped.size?v.fat/v.ped.size:0})).sort((a,b)=>b.fat-a.fat);
  const fatTot=vl.reduce((s,v)=>s+v.fat,0);
  const maxF=Math.max(...vl.map(v=>v.fat),1);

  // comparativo 3 meses anteriores
  const prev=await loadDocs3m();
  const prevCli=new Map(); // id_cliente → fat_medio_mensal
  const pcm=new Map();
  prev.forEach(r=>{if(!r.id_cliente)return;if(!pcm.has(r.id_cliente))pcm.set(r.id_cliente,{nome:r.nome_cliente,fat:0});pcm.get(r.id_cliente).fat+=docFat(r);});
  pcm.forEach((v,id)=>prevCli.set(id,v.fat/3)); // média mensal

  // top clientes atual
  const curCli=new Map();
  S.docs.forEach(r=>{if(!r.id_cliente)return;if(!curCli.has(r.id_cliente))curCli.set(r.id_cliente,{nome:r.nome_cliente,fat:0});curCli.get(r.id_cliente).fat+=docFat(r);});

  // saúde carteira por vendedor
  const crmH=new Map();
  S.carteira.forEach(c=>{const vid=c.id_vendedor_responsavel;if(!vid)return;if(!crmH.has(vid))crmH.set(vid,{a:0,t:0,r:0});const h=crmH.get(vid);const st=getStatus(c);if(st==='ATIVO')h.a++;else if(st==='ATENCAO')h.t++;else if(st==='PERDIDO')h.r++;});

  // top e crescimento clientes
  const allCli=[...curCli.entries()].map(([id,v])=>{
    const prev_m=prevCli.get(id)||0;
    const delta=v.fat-(prev_m*(/* meses no período */1));
    const pct=prev_m>0?(v.fat/prev_m-1)*100:null;
    return{id,nome:v.nome,fat:v.fat,prev_m,delta,pct};
  });
  const topV=[...allCli].sort((a,b)=>b.fat-a.fat).slice(0,5);
  const crescV=[...allCli].filter(c=>c.pct!==null).sort((a,b)=>b.pct-a.pct).slice(0,5);
  const quedaV=[...allCli].filter(c=>c.pct!==null).sort((a,b)=>a.pct-b.pct).slice(0,5);

  el.innerHTML=`
    <div class="kgrid">
      ${kc('💰','Faturamento',fmtK(fatTot),'kc-b')}${kc('👤','Vendedores',vl.length,'kc-p')}${kc('👥','Clientes',new Set(S.docs.map(d=>d.id_cliente).filter(Boolean)).size,'kc-g')}${kc('🛒','Pedidos',new Set(S.docs.map(d=>d.id_doc).filter(Boolean)).size,'kc-y')}
    </div>

    <!-- Cards de clientes -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:16px">
      <div class="scard" style="margin:0">
        <div class="scard-title">🏆 Top por Volume</div>
        ${topV.map((c,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="font-size:10px;color:#475569;width:14px">${i+1}</span><span style="flex:1;font-size:12px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nome}</span><span style="font-size:12px;font-weight:600;color:#94a3b8;flex-shrink:0">${fmtK(c.fat)}</span></div>`).join('')||'<p style="color:#475569;font-size:12px">Sem dados</p>'}
      </div>
      <div class="scard" style="margin:0">
        <div class="scard-title">📈 Maior Crescimento vs 3m anteriores</div>
        ${crescV.map(c=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="flex:1;font-size:12px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nome}</span><span class="delta-pos">${c.pct!=null?'+'+c.pct.toFixed(0)+'%':'—'}</span></div>`).join('')||'<p style="color:#475569;font-size:12px">Sem comparativo</p>'}
      </div>
      <div class="scard" style="margin:0">
        <div class="scard-title">📉 Maior Queda vs 3m anteriores</div>
        ${quedaV.map(c=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="flex:1;font-size:12px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nome}</span><span class="delta-neg">${c.pct!=null?c.pct.toFixed(0)+'%':'—'}</span></div>`).join('')||'<p style="color:#475569;font-size:12px">Sem comparativo</p>'}
      </div>
    </div>

    <!-- Ranking -->
    <div class="scard">
      <div class="scard-title">📊 Ranking de Vendedores</div>
      ${vl.length?`<div style="overflow-x:auto"><table>
        <thead><tr><th style="width:20px"></th><th>Vendedor</th><th class="r">Faturamento</th><th class="r">Clientes</th><th class="r">Pedidos</th><th class="r">Ticket</th><th style="width:120px"></th></tr></thead>
        <tbody>
          ${vl.map((v,i)=>{
            const h=crmH.get(v.id)||{a:0,t:0,r:0};
            const exp=S.expandVend===v.id;
            const m=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
            const tc=new Map();S.docs.filter(d=>d.id_vendedor===v.id).forEach(d=>{if(!d.id_cliente)return;if(!tc.has(d.id_cliente))tc.set(d.id_cliente,{nome:d.nome_cliente,fat:0});tc.get(d.id_cliente).fat+=docFat(d);});
            const tcArr=[...tc.values()].sort((a,b)=>b.fat-a.fat).slice(0,5);
            return`<tr class="cl" onclick="toggleVend(${v.id})">
              <td><span style="font-size:11px;color:${exp?'#3b82f6':'#475569'}">${exp?'▼':'▶'}</span></td>
              <td style="font-weight:600">${sN(v.nome)} ${m}</td>
              <td class="r" style="font-weight:700;color:#f1f5f9">${fmtK(v.fat)}</td>
              <td class="r">${v.clientes}</td><td class="r">${v.pedidos}</td><td class="r">${fmtK(v.ticket)}</td>
              <td><div class="bar-track" style="margin:0"><div class="bar-fill" style="width:${Math.round(v.fat/maxF*100)}%"></div></div></td>
            </tr>
            ${exp?`<tr class="expand-row"><td colspan="7"><div class="expand-inner">
              <div class="hgrid"><div class="hbox ha"><div class="n">${h.a}</div><div class="l">Ativos</div></div><div class="hbox ht"><div class="n">${h.t}</div><div class="l">Atenção</div></div><div class="hbox hr"><div class="n">${h.r}</div><div class="l">Em Risco</div></div></div>
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Top 5 Clientes no Período</div>
              ${tcArr.map(c=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #1e293b"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e2e8f0">${c.nome}</span><span style="color:#94a3b8;flex-shrink:0;margin-left:8px">${fmtK(c.fat)}</span></div>`).join('')||'<p style="color:#475569;font-size:12px">Sem pedidos no período</p>'}
            </div></td></tr>`:''}`;
          }).join('')}
        </tbody>
      </table></div>`:'<p style="color:#475569;text-align:center;padding:24px">Sem dados no período</p>'}
    </div>`;
}
function toggleVend(id){S.expandVend=S.expandVend===id?null:id;renderVendedores();}

// ══════════════════════════════════════════════════════════
// ABA CRM
// ══════════════════════════════════════════════════════════
function renderCRM() {
  renderUmbler();
  renderToday_if_empty();
  renderLista();
}
function renderToday_if_empty(){const el=document.getElementById('today-wrap');if(el&&!el.innerHTML.trim())loadToday();}

function renderToday(tasks) {
  const el=document.getElementById('today-wrap');if(!el)return;
  if(!tasks.length){el.innerHTML='';return;}
  el.innerHTML=`<div class="today-box">
    <div class="today-ttl">📋 Atividades de Hoje (${tasks.length})</div>
    ${tasks.map(t=>`<div class="today-item">
      <div class="today-left">${tipoBdg(t.tipo)}<span class="today-nome">${t.nome_cliente}</span></div>
      <button class="btn-res" onclick="resolverNota('${t.id}',true)">✓</button>
    </div>`).join('')}
  </div>`;
}

function renderUmbler() {
  const el=document.getElementById('umbl-wrap');if(!el)return;
  if(!S.umbler.length){el.innerHTML='';return;}
  const open=S.umblerOpen;
  el.innerHTML=`
    <div class="umbl-header${open?'':' coll'}" onclick="toggleUmbler()">
      <span style="font-size:11px;color:#f87171">${open?'▼':'▶'}</span>
      <span class="umbl-title">📲 Contatos Sem Tratativa</span>
      <span class="umbl-badge">${S.umbler.length}</span>
    </div>
    ${open?`<div class="umbl-body">
      ${S.umbler.slice(0,10).map(c=>`<div class="umbl-item">
        <div class="umbl-nome">${c.nome_contato||'Sem nome'}</div>
        <div class="umbl-info"><span>${fmtP(c.telefone)}</span><span>${sN(c.nome_atendente)}</span><span>${fmtDT(c.ultimo_contato)}</span></div>
        <div class="umbl-acts">
          <button class="btn-vinc" onclick="abrirVinc('${esc(c.telefone)}','${esc(c.nome_contato)}','${esc(c.nome_atendente)}')">🔗 Vincular cliente</button>
          <button class="btn-nc" onclick="naoComercial('${esc(c.telefone)}')">✕ Não comercial</button>
        </div>
      </div>`).join('')}
    </div>`:''}`;
}
function toggleUmbler(){S.umblerOpen=!S.umblerOpen;renderUmbler();}

function renderLista() {
  const el=document.getElementById('cl-list');if(!el)return;

  // Prospecção Geral — cards diferentes com botão Assumir
  if(S.mainTab==='prospeccao' && S.prospTab==='geral'){
    const data=filteredProsp();
    if(!data.length){
      el.innerHTML=`<div class="empty-msg">
        <p style="margin-bottom:8px">Nenhum cliente na prospecção geral</p>
        <p style="font-size:11px;color:#334155">Clientes com +${CFG.compra_risco_dias} dias sem compra e sem vendedor aparecem aqui</p>
      </div>`;
      return;
    }
    el.innerHTML=data.map(c=>{
      const dim=S.dimMap.get(c.id_cliente)||{};
      const sel=S.selId===c.id_cliente;
      const dc=c.dias_sem_compra??dias(c.ultima_compra);
      return`<div class="prosp-geral-card${sel?' sel':''}">
        <div style="display:flex;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0" onclick="selCliente(${c.id_cliente})">
            <div class="pg-row1">
              <span class="pg-nome">${c.nome_cliente}</span>
              ${bdg('PROSPECCAO')}
            </div>
            <div class="pg-meta">
              <span>${dim.cidade?dim.cidade+(dim.uf?' - '+dim.uf:''):'—'}</span>
              <span>Sem compra há <strong style="color:#f87171">${dc<9999?dc+'d':'—'}</strong></span>
            </div>
            ${dim.cnpj_cpf?`<div style="font-size:10px;color:#334155;margin-top:2px;font-family:monospace">${fmtC(dim.cnpj_cpf)}</div>`:''}
          </div>
          <button class="btn-assumir" onclick="assumirCliente(${c.id_cliente},'${esc(c.nome_cliente)}')">
            + Assumir
          </button>
        </div>
      </div>`;
    }).join('');
    return;
  }

  // Carteira e Minha Prospecção — cards padrão
  const data=S.mainTab==='carteira'?filteredCarteira():filteredProsp();
  if(!data.length){el.innerHTML='<div class="empty-msg">Nenhum cliente encontrado</div>';return;}
  el.innerHTML=data.map(c=>{
    const st=getStatus(c);
    const dim=S.dimMap.get(c.id_cliente)||{};
    const sel=S.selId===c.id_cliente;
    const dc=c.dias_sem_compra??dias(c.ultima_compra);

    // Prazo de conversão para Minha Prospecção
    let prazoBdg='';
    if(S.mainTab==='prospeccao' && S.prospTab==='minha' && c.atribuido_em){
      const diasAtrib=Math.floor((Date.now()-new Date(c.atribuido_em).getTime())/86400000);
      const restante=CFG.prospeccao_prazo_contato_dias-diasAtrib;
      if(restante>7) prazoBdg=`<span class="prazo-ok">Prazo: ${restante}d</span>`;
      else if(restante>0) prazoBdg=`<span class="prazo-warn">⚠ ${restante}d</span>`;
      else prazoBdg=`<span class="prazo-urg">Vencido</span>`;
    }

    return`<button class="cl-item${sel?' sel':''}" onclick="selCliente(${c.id_cliente})">
      <div class="cl-row1">
        <span class="cl-nome">${c.nome_cliente}</span>
        ${bdg(st)}
        ${dc>=30?'<span style="color:#f59e0b;font-size:12px;flex-shrink:0">⚠</span>':''}
        ${S.overdueIds.has(c.id_cliente)?'<span style="color:#ef4444;font-size:12px;flex-shrink:0">🔔</span>':''}
        ${prazoBdg}
      </div>
      ${semaforo(c)}
      <div class="cl-row2">${sN(c.nome_vendedor_responsavel)}</div>
      <div class="cl-row3">
        <span class="cl-row3-l">${dim.cidade?dim.cidade+(dim.uf?' - '+dim.uf:'')+'  ':''}Últ: ${c.ultima_compra?fmtD(c.ultima_compra):'—'}</span>
        ${dim.cnpj_cpf?`<span class="cl-cnpj">${fmtC(dim.cnpj_cpf)}</span>`:''}
      </div>
    </button>`;
  }).join('');
}

function filteredCarteira(){
  let d=S.carteira;
  if(S.search){const s=S.search.toLowerCase();d=d.filter(c=>{if((c.nome_cliente||'').toLowerCase().includes(s))return true;const dim=S.dimMap.get(c.id_cliente)||{};return(dim.cidade||'').toLowerCase().includes(s)||(dim.cnpj_cpf||'').replace(/\D/g,'').includes(s.replace(/\D/g,''))||String(c.id_cliente).includes(s);});}
  if(S.subFilter!=='todos')d=d.filter(c=>{const st=getStatus(c);if(S.subFilter==='ativo')return st==='ATIVO';if(S.subFilter==='atencao')return st==='ATENCAO';if(S.subFilter==='em_risco')return st==='PERDIDO';return true;});
  return d;
}
function filteredProsp(){
  // Prospecção Geral (sem vendedor)
  if(S.prospTab==='geral'){
    let d=S.prospGeral;
    if(S.search){const s=S.search.toLowerCase();d=d.filter(c=>(c.nome_cliente||'').toLowerCase().includes(s)||String(c.id_cliente).includes(s));}
    return[...d].sort((a,b)=>{
      if(S.pSort==='nome_az')return(a.nome_cliente||'').localeCompare(b.nome_cliente||'');
      if(S.pSort==='mais_antigo')return(b.dias_sem_compra||9999)-(a.dias_sem_compra||9999);
      return(b.dias_sem_compra||9999)-(a.dias_sem_compra||9999);
    });
  }
  // Prospecção do Vendedor (com vínculo)
  let d=S.prospeccao;
  if(S.search){const s=S.search.toLowerCase();d=d.filter(c=>(c.nome_cliente||'').toLowerCase().includes(s));}
  if(S.pSub==='atencao')d=d.filter(c=>(c.dias_sem_interacao||0)>30);
  return[...d].sort((a,b)=>{if(S.pSort==='nome_az')return(a.nome_cliente||'').localeCompare(b.nome_cliente||'');if(S.pSort==='mais_antigo')return(b.dias_sem_interacao||0)-(a.dias_sem_interacao||0);if(S.pSort==='vendedor_az')return(a.nome_vendedor_responsavel||'zzz').localeCompare(b.nome_vendedor_responsavel||'zzz');return 0;});
}

// ── Drawer ─────────────────────────────────────────────────
async function selCliente(id){
  S.selId=id;
  let lista;
  if(S.mainTab==='carteira') lista=S.carteira;
  else if(S.prospTab==='geral') lista=S.prospGeral;
  else lista=S.prospeccao;
  S.selCliente=lista.find(c=>c.id_cliente===id)||null;
  renderLista();
  document.getElementById('drawer')?.classList.add('open');
  document.getElementById('cd-ph')?.classList.add('hidden');
  document.getElementById('dw-title').textContent=S.selCliente?.nome_cliente||'Ficha';
  document.getElementById('dw-wa').style.display='none';
  document.getElementById('dw-body').innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:80px;color:#475569"><span class="spin">⟳</span></div>';
  await loadDetalhe(id);
  renderDrawer();
}
function closeDrawer(){
  document.getElementById('drawer')?.classList.remove('open');
  document.getElementById('cd-ph')?.classList.remove('hidden');
  S.selId=null;S.selCliente=null;
  renderLista();
}
function renderDrawer(){
  const el=document.getElementById('dw-body');if(!el||!S.selCliente)return;
  const c=S.selCliente;
  const dim=S.dimMap.get(c.id_cliente)||{};
  const st=getStatus(c);
  const fat=S.pedidos.reduce((s,p)=>s+docFat(p),0);
  const qtd=S.pedidos.length;
  const telPrinc=S.telefones.find(t=>t.principal)||S.telefones[0];
  const waEl=document.getElementById('dw-wa');
  if(telPrinc&&waEl){waEl.href=`https://wa.me/${(telPrinc.telefone||'').replace(/\D/g,'')}`;waEl.style.display='inline-flex';}

  el.innerHTML=`
    <div>
      <div class="dc-nome">${c.nome_cliente}</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${bdg(st)}
      </div>
      ${semaforo(c)}
      <div class="dc-info">
        ${(dim.cnpj_cpf||c.cnpj_cpf)?`<span style="font-family:monospace">${fmtC(dim.cnpj_cpf||c.cnpj_cpf)}</span>`:''}
        ${(dim.cidade||c.cidade)?`<span>${dim.cidade||c.cidade}${(dim.uf||c.uf)?' - '+(dim.uf||c.uf):''}</span>`:''}
        ${dim.email?`<span>✉ ${dim.email}</span>`:''}
        <span style="color:#334155">Cód. ERP: ${c.id_cliente}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:#94a3b8">
        Vendedor: <strong style="color:#e2e8f0">${c.nome_vendedor_responsavel?sN(c.nome_vendedor_responsavel):'<span style="color:#7c3aed">Sem vendedor</span>'}</strong>
        ${!c.nome_vendedor_responsavel?`<button class="btn-assumir" style="margin-left:8px;padding:4px 10px;font-size:11px" onclick="assumirCliente(${c.id_cliente},'${esc(c.nome_cliente)}')">+ Assumir</button>`:''}
      </div>
    </div>

    <div class="kmini-row">
      <div class="kmini"><div class="l">Faturamento</div><div class="v">${fmt(fat)}</div></div>
      <div class="kmini"><div class="l">Pedidos</div><div class="v">${qtd}</div></div>
      <div class="kmini"><div class="l">Ticket Médio</div><div class="v">${fmt(qtd?fat/qtd:0)}</div></div>
    </div>

    <div>
      <div class="sec-head">
        <span class="sec-lbl">📞 Telefones</span>
        <span class="link-add" onclick="togglePhForm()">+ Adicionar</span>
      </div>
      <div id="ph-form" class="ph-form">
        <input id="ph-num" placeholder="Telefone" />
        <input id="ph-nome" placeholder="Nome do contato" />
        <div style="display:flex;gap:8px">
          <button class="btn-sv" style="padding:7px" onclick="savePhone(${c.id_cliente},'${esc(c.nome_cliente)}')">Salvar</button>
          <button style="font-size:12px;color:#64748b;padding:7px 10px" onclick="togglePhForm()">Cancelar</button>
        </div>
      </div>
      ${S.telefones.map(t=>`
        <div class="phone-card">
          <div class="ph-info">
            <span class="ph-num">${fmtP(t.telefone)}</span>
            ${t.nome_contato?`<span class="ph-name">${t.nome_contato}${t.cargo?' · '+t.cargo:''}</span>`:''}
            ${t.principal?'<span class="ph-princ">Principal</span>':''}
          </div>
          <div class="ph-acts">
            <a class="ph-wa" href="https://wa.me/${(t.telefone||'').replace(/\D/g,'')}" target="_blank">💬</a>
            <button class="ph-del" onclick="delPhone('${t.id}')">✕</button>
          </div>
        </div>`).join('')||'<p style="color:#475569;font-size:12px">Nenhum telefone</p>'}
    </div>

    <div>
      <div class="sec-head"><span class="sec-lbl">📦 Últimos Pedidos</span></div>
      ${S.pedidos.length?`<table><thead><tr><th>Data</th><th class="r">Valor</th><th class="r">Itens</th></tr></thead><tbody>${S.pedidos.map(p=>`<tr><td>${fmtD(p.data_faturamento)}</td><td class="r">${fmt(docFat(p))}</td><td class="r">${p.qtd_itens_doc||0}</td></tr>`).join('')}</tbody></table>`:'<p style="color:#475569;font-size:12px">Sem pedidos</p>'}
    </div>

    <div>
      <div class="sec-head"><span class="sec-lbl">📝 Tarefas e Notas</span></div>
      <div style="max-height:300px;overflow-y:auto">
        ${S.notas.map(n=>`
          <div class="nota-card${n.resolvido?' done':''}">
            <div class="nc-head">
              <div style="display:flex;align-items:center;gap:6px">${tipoBdg(n.tipo)}<span class="nc-meta">${fmtD(n.data_criacao)}${n.criado_por?' · '+n.criado_por:''}</span></div>
              ${!n.resolvido?`<button class="btn-res" onclick="resolverNota('${n.id}',false)">✓ Resolver</button>`:'<span style="font-size:10px;color:#334155">Resolvido</span>'}
            </div>
            <p class="nc-txt">${n.texto}</p>
            ${n.data_prevista?`<p class="nc-date">📅 ${fmtD(n.data_prevista)}</p>`:''}
          </div>`).join('')||'<p style="color:#475569;font-size:12px">Nenhuma nota</p>'}
      </div>
    </div>

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
    </div>`;
}
function toggleNotaDate(){const t=document.getElementById('nota-tipo')?.value;const d=document.getElementById('nota-data');if(d)d.style.display=['TAREFA','FOLLOWUP'].includes(t)?'':'none';}

// ══════════════════════════════════════════════════════════
// ABA CONFIG
// ══════════════════════════════════════════════════════════
async function renderConfig() {
  const el=document.getElementById('cfg-body');if(!el)return;
  el.innerHTML='<div class="empty-msg"><span class="spin">⟳</span> Carregando...</div>';

  // Carrega uvMap atualizado
  await loadUmblerVendMap();

  const uvRows=S.umblerVendMap;
  // Contatos Umbler todos (com e sem vínculo)
  const allUmbl=await sbQ('atac_umbler_contatos','select=telefone,nome_contato,nome_atendente,ultimo_contato,nao_comercial&order=ultimo_contato.desc&limit=50');
  const telVinc=await sbQ('atac_cliente_telefones','select=telefone,nome_cliente');
  const telVincSet=new Set((Array.isArray(telVinc)?telVinc:[]).map(t=>t.telefone));
  const telVincMap=new Map((Array.isArray(telVinc)?telVinc:[]).map(t=>[t.telefone,t.nome_cliente]));

  el.innerHTML=`<div style="max-width:680px">

    <!-- Parâmetros CRM -->
    <div class="cfg-section">
      <h3>⚙️ Parâmetros do CRM</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
        ${[
          ['compra_saudavel_dias','Compra Ativo (dias)','Limite para status verde'],
          ['compra_atencao_dias','Compra Atenção (dias)','Limite para amarelo'],
          ['compra_risco_dias','Compra Em Risco / perde vínculo','Limite máximo antes de prospecção'],
          ['interacao_saudavel_dias','Interação Ativo (dias)','Último contato para verde'],
          ['interacao_atencao_dias','Interação Atenção (dias)','Último contato para amarelo'],
          ['prospeccao_prazo_contato_dias','Prazo 1ª interação (dias)','Após atribuição ao vendedor'],
          ['prospeccao_perda_vinculo_dias','Dias para perder vínculo','Sem compra → volta à prospecção'],
        ].map(([k,lbl,hint])=>`
          <div class="cfg-row">
            <div class="cfg-lbl">${lbl}<span class="hint">${hint}</span></div>
            <input class="cfg-input" type="number" min="1" id="cfg-${k}" value="${CFG[k]}" />
          </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <button class="btn-sv" style="width:auto;padding:8px 20px" onclick="saveCfg()">Salvar Configurações</button>
      </div>
    </div>

    <!-- Vínculos Umbler ↔ Vendedor -->
    <div class="cfg-section">
      <h3>🔗 Atendentes Umbler → Vendedores ERP</h3>
      <p style="font-size:11px;color:#64748b;margin-bottom:12px">Relaciona o usuário Umbler (atendente) ao vendedor do ERP, para filtrar contatos e atribuição automática.</p>
      <div id="uv-list">
        ${uvRows.length?uvRows.map(r=>`
          <div class="uv-row">
            <div class="uv-vendedor">
              <div class="uv-vname">${r.nome_vendedor_erp||'Vendedor #'+r.id_vendedor_erp}</div>
              <div class="uv-umbler">Umbler: ${r.usuario_umbler||'—'}</div>
            </div>
            <div class="uv-acts">
              <button class="btn-sm" onclick="editUV(${r.id},'${esc(r.usuario_umbler||'')}',${r.id_vendedor_erp})">✎ Editar</button>
              <button class="btn-sm danger" onclick="delUV(${r.id})">✕ Remover</button>
            </div>
          </div>`).join(''):'<p style="color:#475569;font-size:12px;padding:8px 0">Nenhum vínculo cadastrado</p>'}
      </div>
      <button class="btn-sm" style="margin-top:10px;border-color:#3b82f6;color:#3b82f6" onclick="newUV()">+ Novo Vínculo</button>
    </div>

    <!-- Contatos Umbler (todos, com/sem vínculo) -->
    <div class="cfg-section">
      <h3>📲 Contatos Umbler Recentes</h3>
      <p style="font-size:11px;color:#64748b;margin-bottom:10px">Todos os contatos recebidos. Verde = vinculado a um cliente. Vermelho = sem vínculo.</p>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>Contato</th><th>Telefone</th><th>Atendente</th><th>Último contato</th><th>Status</th></tr></thead>
          <tbody>
            ${(Array.isArray(allUmbl)?allUmbl:[]).map(c=>`
              <tr>
                <td>${c.nome_contato||'Sem nome'}</td>
                <td style="font-family:monospace">${fmtP(c.telefone)}</td>
                <td>${c.nome_atendente||'—'}</td>
                <td>${fmtDT(c.ultimo_contato)}</td>
                <td>${telVincSet.has(c.telefone)?`<span class="tag-vinc">✓ ${telVincMap.get(c.telefone)||'Vinculado'}</span>`:`<span class="tag-semvinc">Sem vínculo</span>`}</td>
              </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:#475569;padding:20px">Sem contatos</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Integrações -->
    <div class="cfg-section">
      <h3>🔌 Integrações</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${[['Umbler Talk (WhatsApp)','Edge Function UMBLERATC'],['ERP Firebird → Supabase','Sync automático']].map(([n,d])=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:#0f172a;border:1px solid #334155;border-radius:8px">
            <div><p style="font-size:13px;font-weight:600;color:#e2e8f0">${n}</p><p style="font-size:11px;color:#64748b">${d}</p></div>
            <span style="font-size:10px;background:#05200e;color:#4ade80;border:1px solid #166534;border-radius:999px;padding:2px 8px">Ativo</span>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

async function saveCfg() {
  const keys=['compra_saudavel_dias','compra_atencao_dias','compra_risco_dias','interacao_saudavel_dias','interacao_atencao_dias','prospeccao_prazo_contato_dias','prospeccao_perda_vinculo_dias'];
  for(const k of keys){
    const v=Number(document.getElementById('cfg-'+k)?.value);
    if(isNaN(v)||v<1)continue;
    CFG[k]=v;
    await sbUpsert('atac_config_crm',{chave:k,valor:v},'chave');
  }
  toast('Configurações salvas!');
  // reprocessa status com novos parâmetros
  renderLista();
}

// vínculos umbler-vendedor
function newUV(){openUV(null,'',null);}
function editUV(id,umbler,vendId){openUV(id,umbler,vendId);}
function openUV(id,umbler,vendId){
  const m=document.getElementById('modal-uv');if(!m)return;
  m.dataset.uvid=id||'';
  document.getElementById('uv-umbler').value=umbler||'';
  document.getElementById('uv-title').textContent=id?'Editar Vínculo':'Novo Vínculo Umbler → Vendedor';
  // popular select vendedor
  const sel=document.getElementById('uv-vend');
  sel.innerHTML='<option value="">Selecione...</option>'+S.vendedores.map(v=>`<option value="${v.id_vendedor}"${v.id_vendedor===vendId?' selected':''}>${v.nome_vendedor}</option>`).join('');
  m.classList.add('open');
}
function closeUV(){document.getElementById('modal-uv')?.classList.remove('open');}
async function saveUV(){
  const id=document.getElementById('modal-uv').dataset.uvid;
  const umbler=document.getElementById('uv-umbler').value.trim();
  const vendId=Number(document.getElementById('uv-vend').value);
  if(!umbler||!vendId){toast('Preencha todos os campos','err');return;}
  const vendNome=S.vendedores.find(v=>v.id_vendedor===vendId)?.nome_vendedor||'';
  if(id){
    await sbUpdate('atac_umbler_vendedor','id',id,{usuario_umbler:umbler,id_vendedor_erp:vendId,nome_vendedor_erp:vendNome});
  } else {
    await sbInsert('atac_umbler_vendedor',{usuario_umbler:umbler,id_vendedor_erp:vendId,nome_vendedor_erp:vendNome});
  }
  toast('Vínculo salvo!');
  closeUV();
  await loadUmblerVendMap();
  renderConfig();
}
async function delUV(id){
  if(!confirm('Remover vínculo?'))return;
  await sbDel('atac_umbler_vendedor','id',id);
  toast('Removido!');
  await loadUmblerVendMap();
  renderConfig();
}

// ══════════════════════════════════════════════════════════
// AÇÕES CRM
// ══════════════════════════════════════════════════════════
async function resolverNota(id,isToday){
  await sbUpdate('atac_crm_notas','id',id,{resolvido:true,data_resolucao:new Date().toISOString()});
  toast('Resolvido!');
  await Promise.all([loadToday(),loadOverdue()]);
  if(S.selId){await loadDetalhe(S.selId);renderDrawer();}
  renderLista();
}
async function salvarNota(cId,cNome,vId,vNome){
  const tipo=document.getElementById('nota-tipo')?.value;
  const texto=document.getElementById('nota-texto')?.value?.trim();
  const criado=document.getElementById('nota-criado')?.value?.trim();
  const data=document.getElementById('nota-data')?.value;
  if(!texto||!criado){toast('Preencha texto e criado por','err');return;}
  if(['TAREFA','FOLLOWUP'].includes(tipo)&&!data){toast('Informe a data prevista','err');return;}
  await sbInsert('atac_crm_notas',{id_cliente:cId,nome_cliente:cNome,tipo,texto,criado_por:criado,data_prevista:data||null,id_vendedor_responsavel:vId||null,nome_vendedor_responsavel:vNome||null});
  toast('Registro salvo!');
  await loadDetalhe(cId);renderDrawer();
}
function togglePhForm(){document.getElementById('ph-form')?.classList.toggle('open');}
async function savePhone(cId,cNome){
  const tel=document.getElementById('ph-num')?.value?.trim();
  const nome=document.getElementById('ph-nome')?.value?.trim();
  if(!tel){toast('Informe o telefone','err');return;}
  await sbInsert('atac_cliente_telefones',{id_cliente:cId,nome_cliente:cNome,telefone:tel,nome_contato:nome||null,principal:false});
  toast('Telefone adicionado!');
  await loadDetalhe(cId);renderDrawer();
}
async function delPhone(id){
  if(!confirm('Remover telefone?'))return;
  await sbDel('atac_cliente_telefones','id',id);
  toast('Removido!');
  await loadDetalhe(S.selId);renderDrawer();
}
async function naoComercial(tel){
  const m=prompt('Motivo (obrigatório):');if(!m?.trim())return;
  await sbUpdate('atac_umbler_contatos','telefone',tel,{nao_comercial:true,motivo_nao_comercial:m});
  toast('Marcado como não comercial');
  await loadUmbler();renderUmbler();
}

// modal vincular cliente
function abrirVinc(tel,nome,atend){
  const m=document.getElementById('modal-vinc');if(!m)return;
  m.dataset.tel=tel;m.dataset.nome=nome;m.dataset.atend=atend;
  m.classList.add('open');
  document.getElementById('vinc-search').value='';
  document.getElementById('vinc-results').innerHTML='<p class="empty-msg">Digite para buscar...</p>';
}
function closeVinc(){document.getElementById('modal-vinc')?.classList.remove('open');}
async function searchVinc(){
  const q=document.getElementById('vinc-search')?.value?.trim();if(!q||q.length<2)return;
  const d=await sbQ('atac_clientes',`select=id_cliente,nome_cliente,cnpj_cpf,cidade,uf&or=(nome_cliente.ilike.*${encodeURIComponent(q)}*,cnpj_cpf.ilike.*${q.replace(/\D/g,'')}*)`);
  const res=Array.isArray(d)?d.slice(0,12):[];
  const el=document.getElementById('vinc-results');if(!el)return;
  el.innerHTML=res.length?res.map(c=>`<button class="mres-btn" onclick="confirmarVinc(${c.id_cliente},'${esc(c.nome_cliente)}')"><div class="mres-nome">${c.nome_cliente}</div>${(c.cnpj_cpf||c.cidade)?`<div class="mres-meta">${c.cnpj_cpf?fmtC(c.cnpj_cpf)+' · ':''}${c.cidade||''}</div>`:''}</button>`).join(''):'<p class="empty-msg">Nenhum cliente encontrado</p>';
}
async function confirmarVinc(cId,cNome){
  const m=document.getElementById('modal-vinc');if(!m)return;
  await sbInsert('atac_cliente_telefones',{id_cliente:cId,nome_cliente:cNome,telefone:m.dataset.tel,descricao:'Umbler',principal:true});
  toast(`Vinculado → ${cNome}`);
  closeVinc();
  await Promise.all([loadUmbler(),loadCarteira(),loadProspeccao()]);
  renderUmbler();renderLista();
}

// controles UI
function setMainTab(tab){
  S.mainTab=tab;S.selId=null;S.selCliente=null;closeDrawer();
  document.getElementById('tab-c')?.classList.toggle('on',tab==='carteira');
  document.getElementById('tab-p')?.classList.toggle('on',tab==='prospeccao');
  document.getElementById('ctrl-c')?.classList.toggle('hidden',tab!=='carteira');
  // ctrl-p usa display flex/none pois tem flex-direction:column
  const ctrlP=document.getElementById('ctrl-p');
  if(ctrlP) ctrlP.style.display=(tab==='prospeccao')?'flex':'none';
  // Mostrar/ocultar filtros extras só na sub-aba Minha
  const ctrlPP=document.getElementById('ctrl-pp');
  if(ctrlPP) ctrlPP.style.display=(tab==='prospeccao'&&S.prospTab==='minha')?'':'none';
  renderLista();
}
function setProspTab(pt){
  S.prospTab=pt;S.selId=null;S.selCliente=null;closeDrawer();
  document.querySelectorAll('[data-pt]').forEach(el=>el.classList.toggle('on',el.dataset.pt===pt));
  // Filtros extras só aparecem na aba Minha
  const ctrlPP=document.getElementById('ctrl-pp');
  if(ctrlPP) ctrlPP.style.display=(pt==='minha')?'':'none';
  renderLista();
}
function setSub(f){S.subFilter=f;document.querySelectorAll('[data-sf]').forEach(el=>el.classList.toggle('on',el.dataset.sf===f));renderLista();}
function setPSub(v){S.pSub=v;document.querySelectorAll('[data-psub]').forEach(el=>el.classList.toggle('on',el.dataset.psub===v));renderLista();}
function setPSort(v){S.pSort=v;renderLista();}
function handleSearch(v){S.search=v;renderLista();}

// ── ASSUMIR CLIENTE (Prospecção Geral → Carteira do Vendedor) ──
async function assumirCliente(id, nomeCliente) {
  // Se não tem vendedor filtrado, pede para selecionar
  const vId = F.vendedorId;
  const vNome = vId ? S.vendedores.find(v=>v.id_vendedor===vId)?.nome_vendedor : null;

  if(!vId || !vNome) {
    toast('Selecione um vendedor no filtro global antes de assumir um cliente','err');
    return;
  }

  if(!confirm(`Atribuir "${nomeCliente}" à carteira de ${sN(vNome)}?\n\nO vendedor terá ${CFG.prospeccao_prazo_contato_dias} dias para registrar uma interação.`)) return;

  // Upsert em atac_cliente_vendedor — atualizado_em registra o momento da atribuição
  const r = await sbUpsert('atac_cliente_vendedor',{
    id_cliente: id,
    nome_cliente: nomeCliente,
    id_vendedor_responsavel: vId,
    nome_vendedor_responsavel: vNome,
    atualizado_por: 'CRM_PROSP_GERAL',
  },'id_cliente');

  if(!r.ok){toast('Erro ao assumir cliente','err');return;}

  toast(`✅ ${nomeCliente} atribuído a ${sN(vNome)} — prazo: ${CFG.prospeccao_prazo_contato_dias} dias para interação`);

  // Recarrega
  await Promise.all([loadCarteira(), loadProspeccao()]);
  renderLista();
}

// exports
window.APP={init};
window.gotoTab=gotoTab;
window.applyPeriod=onPeriodChange; // alias para compatibilidade
window.onPeriodChange=onPeriodChange;
window.onCustomDate=onCustomDate;
window.onVendChange=onVendChange;
window.onEmpChange=onEmpChange;
window.setMainTab=setMainTab;
window.setProspTab=setProspTab;
window.assumirCliente=assumirCliente;
window.setSub=setSub;
window.setPSub=setPSub;
window.setPSort=setPSort;
window.handleSearch=handleSearch;
window.toggleVend=toggleVend;
window.selCliente=selCliente;
window.closeDrawer=closeDrawer;
window.resolverNota=resolverNota;
window.salvarNota=salvarNota;
window.togglePhForm=togglePhForm;
window.savePhone=savePhone;
window.delPhone=delPhone;
window.naoComercial=naoComercial;
window.abrirVinc=abrirVinc;
window.closeVinc=closeVinc;
window.searchVinc=searchVinc;
window.confirmarVinc=confirmarVinc;
window.toggleUmbler=toggleUmbler;
window.toggleNotaDate=toggleNotaDate;
window.saveCfg=saveCfg;
window.newUV=newUV;
window.editUV=editUV;
window.closeUV=closeUV;
window.saveUV=saveUV;
window.delUV=delUV;
