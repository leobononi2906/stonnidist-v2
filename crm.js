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
  notas: [], telefones: [], pedidos: [], vinculosERP: [],  // vínculos ERP do cliente aberto
  overdueIds: new Set(),
  mainTab: 'carteira',  // 'carteira' | 'prospeccao' | 'agenda'
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
  // modal novo contato umbler
  novoContatoTel: null,
  novoContatoNome: '',
  novoContatoAtend: '',
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
  // Recarrega alertas CRM (substituiu today panel)
  renderAlertasCRM();
}
async function loadDetalhe(id) {
  const [notas, tels, vincErp] = await Promise.all([
    sbQ('atac_crm_notas', `select=*&id_cliente=eq.${id}&order=data_criacao.desc`),
    sbQ('atac_cliente_telefones', `select=*&id_cliente=eq.${id}&order=principal.desc`),
    sbQ('atac_cliente_vinculos', `select=id,id_cliente_erp,nome_cliente_erp,cnpj_cpf_erp&id_cliente_crm=eq.${id}`),
  ]);
  S.notas = Array.isArray(notas) ? notas : [];
  // Deduplicar telefones por número
  const telsArr = Array.isArray(tels) ? tels : [];
  const telSeen = new Set();
  S.telefones = telsArr.filter(t => {
    const k = (t.telefone||'').replace(/\D/g,'');
    if(!k || telSeen.has(k)) return false;
    telSeen.add(k); return true;
  });
  S.vinculosERP = Array.isArray(vincErp) ? vincErp : [];

  // Buscar pedidos de TODOS os IDs vinculados (cliente + ERPs vinculados)
  const todosIds = [id, ...S.vinculosERP.map(v => v.id_cliente_erp)];
  const idsParam = todosIds.join(',');
  const peds = await sbQ('vw_comercial_docs_faturados',
    `select=id_doc,data_faturamento,faturamento_doc,faturamento_liquido,qtd_itens_doc,nome_cliente&tipo_saida=eq.DISTRIBUICAO&id_cliente=in.(${idsParam})&order=data_faturamento.desc&limit=15`);
  // Deduplicar por id_doc
  const pedSeen = new Set();
  S.pedidos = (Array.isArray(peds) ? peds : []).filter(p => {
    if (!p.id_doc || pedSeen.has(p.id_doc)) return false;
    pedSeen.add(p.id_doc); return true;
  });
}

// Carregar todos os clientes vinculados a um telefone (vínculos múltiplos)
async function loadVinculosTelefone(telefone) {
  if (!telefone) return [];
  const data = await sbQ('atac_cliente_telefones',
    `select=id,id_cliente,nome_cliente,descricao,principal&telefone=eq.${encodeURIComponent(telefone)}&order=principal.desc`);
  return Array.isArray(data) ? data : [];
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
  if(window.setPageInfo) window.setPageInfo(tab);
  // sidebar active
  ['home','vendedores','crm','agenda','config'].forEach(t=>{
    document.getElementById(`si-${t}`)?.classList.toggle('active',t===tab);
  });
  // páginas: pg-home, pg-vendedores, pg-crm (usa pg-crm.active), pg-config
  ['home','vendedores','config','agenda'].forEach(t=>{
    const el=document.getElementById(`pg-${t}`);
    if(el){ el.classList.toggle('active',t===tab); }
  });
  // CRM usa classe diferente
  const crmEl=document.getElementById('pg-crm');
  if(crmEl){ crmEl.classList.toggle('active',tab==='crm'); }
  // Filtros: no CRM só vendedor; config oculta tudo; resto mostra tudo
  const tf = document.getElementById('topbar-filters');
  if (tab === 'config') {
    if(tf) tf.style.display = 'none';
  } else if (tab === 'crm') {
    if(tf) tf.style.display = 'flex';
    // ocultar tudo exceto vendedor
    ['f-period','f-start','f-end','f-sep','f-emp'].forEach(id => {
      const el = document.getElementById(id); if(el) el.style.display = 'none';
    });
    // ocultar labels que NÃO são do vendedor
    document.querySelectorAll('.tf-label').forEach(el => {
      el.style.display = el.dataset.tf === 'vend' ? '' : 'none';
    });
    const fv = document.getElementById('f-vend');
    if(fv) fv.style.display = '';
  } else {
    if(tf) tf.style.display = 'flex';
    ['f-period','f-start','f-end','f-emp','f-vend'].forEach(id => {
      const el = document.getElementById(id); if(el) el.style.display = '';
    });
    document.querySelectorAll('.tf-label').forEach(el => el.style.display = '');
    if(F.period === 'custom') {
      ['f-start','f-end','f-sep'].forEach(id => {
        const el = document.getElementById(id); if(el) el.style.display = '';
      });
    }
  }
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
  renderAlertasCRM();
  renderLista();
}

// Alertas inteligentes: hoje, atrasadas, próximas (substitui painel "atividades de hoje")
async function renderAlertasCRM() {
  const el = document.getElementById('crm-alertas'); if(!el)return;
  const hoje = new Date().toISOString().split('T')[0];
  const proxData = new Date(); proxData.setDate(proxData.getDate()+7);
  const proxStr = proxData.toISOString().split('T')[0];

  let base = 'select=id,tipo,nome_cliente,texto,data_prevista&resolvido=eq.false';
  if (F.vendedorId) base += `&id_vendedor_responsavel=eq.${F.vendedorId}`;

  const [atrasadas, deHoje, proximas] = await Promise.all([
    sbQ('atac_crm_notas', base + `&data_prevista=lt.${hoje}&order=data_prevista.asc&limit=50`),
    sbQ('atac_crm_notas', base + `&data_prevista=eq.${hoje}&order=nome_cliente.asc`),
    sbQ('atac_crm_notas', base + `&data_prevista=gt.${hoje}&data_prevista=lte.${proxStr}&order=data_prevista.asc&limit=20`),
  ]);

  const nAtr = Array.isArray(atrasadas) ? atrasadas.length : 0;
  const nHoje = Array.isArray(deHoje) ? deHoje.length : 0;
  const nProx = Array.isArray(proximas) ? proximas.length : 0;

  if (!nAtr && !nHoje && !nProx) { el.innerHTML=''; return; }

  // Renderiza alertas como chips clicáveis no topo
  el.innerHTML = `
    <div style="padding:8px 12px;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid var(--border)">

      ${nHoje>0?`
      <div style="background:var(--blue-pale);border:1px solid rgba(0,119,204,.2);border-radius:var(--radius-sm);padding:8px 12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:11px;font-weight:700;color:var(--blue-dark)">📌 Atividades de Hoje (${nHoje})</span>
        </div>
        ${(Array.isArray(deHoje)?deHoje:[]).map(t=>`
          <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface);border-radius:var(--radius-sm);padding:5px 8px;margin-bottom:3px;gap:6px">
            <div style="display:flex;align-items:center;gap:5px;min-width:0;flex:1">
              ${tipoBdg(t.tipo)}
              <span style="font-size:12px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.nome_cliente}</span>
            </div>
            <button onclick="resolverNota('${t.id}',true)" class="btn-res" style="flex-shrink:0;font-size:10px">✓ Resolver</button>
          </div>`).join('')}
      </div>`:''}

      ${nAtr>0?`
      <div style="background:var(--red-bg);border:1px solid rgba(217,48,37,.15);border-radius:var(--radius-sm);padding:8px 12px;cursor:pointer" onclick="setMainTab('agenda')" title="Ver agenda">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:15px">⚠️</span>
          <span style="font-size:12px;font-weight:700;color:var(--red)">${nAtr} atividade${nAtr>1?'s':''} atrasada${nAtr>1?'s':''}</span>
          <span style="margin-left:auto;font-size:10px;color:var(--red);font-weight:600">Ver agenda →</span>
        </div>
      </div>`:''}

      ${nProx>0&&!nHoje?`
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 12px">
        <span style="font-size:11px;color:var(--text-muted)">📅 Próximas atividades nos próximos 7 dias: </span>
        <span style="font-size:11px;font-weight:700;color:var(--orange)">${nProx}</span>
      </div>`:''}

    </div>`;
}

// Mantido para compatibilidade com resolverNota (hoje flag)
function renderToday(tasks) {}

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
          <button class="btn-vinc" onclick="abrirVinc('${esc(c.telefone)}','${esc(c.nome_contato)}','${esc(c.nome_atendente)}')">🔗 Vincular</button>
          <button class="btn-vinc" style="border-color:var(--blue-mid);color:var(--blue-mid)" onclick="abrirNovoContato('${esc(c.telefone)}','${esc(c.nome_contato)}','${esc(c.nome_atendente)}')">👤 Criar Novo</button>
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
          <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
            <button class="btn-assumir" onclick="assumirCliente(${c.id_cliente},'${esc(c.nome_cliente)}')">+ Assumir</button>
            <button onclick="descartarCliente(${c.id_cliente},'${esc(c.nome_cliente)}')"
              style="font-size:11px;padding:4px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text-muted);background:none;cursor:pointer;font-weight:500;transition:all .15s"
              onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)'"
              onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">
              ✕ Descartar
            </button>
          </div>
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
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
        <span style="font-size:11px;color:var(--text-muted)">Vendedor:</span>
        <strong style="font-size:12px;color:var(--text-primary)">${c.nome_vendedor_responsavel?sN(c.nome_vendedor_responsavel):'<em style=\"color:var(--purple);font-style:normal;font-weight:600\">Sem vendedor</em>'}</strong>
        <button onclick="abrirModalVendedor(${c.id_cliente},'${esc(c.nome_cliente)}',${c.id_vendedor_responsavel||'null'})"
          style="font-size:11px;padding:3px 9px;border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--blue-mid);background:var(--blue-pale);cursor:pointer;font-weight:600">
          ✎ Alterar
        </button>
        ${!c.nome_vendedor_responsavel?`<button class="btn-assumir" style="padding:3px 9px;font-size:11px" onclick="assumirCliente(${c.id_cliente},'${esc(c.nome_cliente)}')">+ Assumir</button>`:''}
      </div>
      <!-- Ações do cliente -->
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button onclick="abrirVincularERP(${c.id_cliente},'${esc(c.nome_cliente)}')"
          style="font-size:11px;font-weight:600;padding:5px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text-secondary);background:var(--surface2);cursor:pointer;display:flex;align-items:center;gap:4px">
          🔗 Vincular ao ERP
        </button>
      </div>
    </div>

    <!-- CLIENTES ERP VINCULADOS -->
    ${S.vinculosERP.length ? `
    <div>
      <div class="sec-head" style="margin-bottom:6px">
        <span class="sec-lbl">🔗 Clientes ERP Vinculados (${S.vinculosERP.length})</span>
        <button onclick="abrirVincularERP(${c.id_cliente},'${esc(c.nome_cliente)}')" class="link-add">+ Adicionar</button>
      </div>
      ${S.vinculosERP.map(v=>`
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:6px;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.nome_cliente_erp||'—'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:1px">
              <span>#${v.id_cliente_erp}</span>
              ${v.cnpj_cpf_erp?`<span style="margin-left:8px">${fmtC(v.cnpj_cpf_erp)}</span>`:''}
            </div>
          </div>
          <button onclick="desvincularERP('${v.id}',${c.id_cliente},'${esc(v.nome_cliente_erp||'')}')"
            style="font-size:11px;padding:4px 8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--red);background:var(--red-bg);cursor:pointer;font-weight:500;flex-shrink:0">
            ✕ Desvincular
          </button>
        </div>`).join('')}
      <p style="font-size:10px;color:var(--text-muted);margin-top:4px">
        💡 Pedidos e datas consideram o mais recente entre todos os ERP vinculados
      </p>
    </div>` : ''}

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
            ${t.descricao&&!t.nome_contato?`<span class="ph-name">(${t.descricao})</span>`:''}
            ${t.principal?'<span class="ph-princ">Principal</span>':''}
          </div>
          <div class="ph-acts">
            <a class="ph-wa" href="https://wa.me/${(t.telefone||'').replace(/\D/g,'')}" target="_blank">💬</a>
            <button class="ph-del" title="Remover" onclick="delPhone('${t.id}')">✕</button>
          </div>
        </div>`).join('')||'<p style="color:#475569;font-size:12px">Nenhum telefone</p>'}
    </div>

    <div>
      <div class="sec-head"><span class="sec-lbl">📦 Últimos Pedidos</span></div>
      ${S.pedidos.length?`
        <table class="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>NF</th>
              <th class="r">Valor</th>
              <th class="r">Itens</th>
            </tr>
          </thead>
          <tbody>
            ${S.pedidos.map(p=>`
              <tr>
                <td>${fmtD(p.data_faturamento)}</td>
                <td style="font-family:'DM Mono',monospace;color:var(--text-muted);font-size:12px">${p.id_doc||'—'}</td>
                <td class="r" style="font-weight:600">${fmt(docFat(p))}</td>
                <td class="r">${p.qtd_itens_doc||0}</td>
              </tr>`).join('')}
          </tbody>
        </table>`:'<p style="color:var(--text-muted);font-size:12px">Sem pedidos no histórico</p>'}
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
      <div style="display:flex;flex-direction:column;gap:6px;max-height:400px;overflow-y:auto">
        ${(Array.isArray(allUmbl)?allUmbl:[]).map(c=>{
          const vinculado = telVincSet.has(c.telefone);
          const nomeCliente = telVincMap.get(c.telefone)||'';
          return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);border-left:3px solid ${vinculado?'var(--green)':'var(--red)'}">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
                <span style="font-size:13px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nome_contato||'Sem nome'}</span>
                ${vinculado?`<span class="tag-vinc">✓ ${nomeCliente.split(' ').slice(0,2).join(' ')}</span>`:'<span class="tag-semvinc">Sem vínculo</span>'}
              </div>
              <div style="display:flex;gap:10px;font-size:11px;color:var(--text-muted);flex-wrap:wrap">
                <span style="font-family:'DM Mono',monospace">${fmtP(c.telefone)}</span>
                ${c.nome_atendente?`<span>${c.nome_atendente}</span>`:''}
                <span>${fmtDT(c.ultimo_contato)}</span>
              </div>
            </div>
            ${!vinculado?`
              <div style="display:flex;gap:4px;flex-shrink:0">
                <button class="btn-sm" onclick="abrirVinc('${esc(c.telefone)}','${esc(c.nome_contato||'')}','${esc(c.nome_atendente||'')}')">🔗 Vincular</button>
                <button class="btn-sm" style="color:var(--blue-mid)" onclick="abrirNovoContato('${esc(c.telefone)}','${esc(c.nome_contato||'')}','${esc(c.nome_atendente||'')}')">👤 Criar</button>
                <button class="btn-sm danger" onclick="naoComercialConfig('${esc(c.telefone)}')">✕ NC</button>
              </div>`:''}
          </div>`;
        }).join('')||'<p class="empty-msg">Sem contatos recentes</p>'}
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
  toast('✅ Resolvido!');
  // Recarregar alertas e overdues
  await Promise.all([loadOverdue(), renderAlertasCRM()]);
  if(S.selId){await loadDetalhe(S.selId);renderDrawer();}
  renderLista();
  // Se agenda está aberta, recarregar
  if(S.mainTab==='agenda') renderAgendaCRM();
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
async function naoComercialConfig(tel){
  const m=prompt('Motivo (obrigatório):');if(!m?.trim())return;
  await sbUpdate('atac_umbler_contatos','telefone',tel,{nao_comercial:true,motivo_nao_comercial:m});
  toast('Marcado como não comercial');
  renderConfig(); // recarrega a tela de config
}

// modal vincular cliente
function abrirVinc(tel,nome,atend){
  const m=document.getElementById('modal-vinc');if(!m)return;
  m.dataset.tel=tel;m.dataset.nome=nome;m.dataset.atend=atend||'';
  m.dataset.extra='';
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
  const tel=m.dataset.tel;
  const isExtra=(m.dataset.extra==='true');

  // Verifica se já tem compras → vai para Carteira ou Prospecção
  // (apenas para novo vínculo, não para extra)
  const principal = !isExtra; // se é o primeiro vínculo, marcar como principal

  await sbInsert('atac_cliente_telefones',{
    id_cliente:cId, nome_cliente:cNome,
    telefone:tel, descricao:'Umbler', principal
  });

  // Auto-detectar vendedor pelo atendente (apenas em novo vínculo)
  if (!isExtra) {
    const atend = m.dataset.atend || '';
    const uvMatch = S.umblerVendMap.find(u =>
      (u.usuario_umbler||'').toLowerCase() === atend.toLowerCase() ||
      (u.nome_vendedor_erp||'').toLowerCase() === atend.toLowerCase()
    );
    if (uvMatch) {
      const vend = S.vendedores.find(v => v.id_vendedor === uvMatch.id_vendedor_erp);
      if (vend) {
        await sbUpsert('atac_cliente_vendedor', {
          id_cliente: cId, nome_cliente: cNome,
          id_vendedor_responsavel: vend.id_vendedor,
          nome_vendedor_responsavel: vend.nome_vendedor,
          atualizado_por: 'UMBLER'
        }, 'id_cliente');
      }
    }
    toast(`✅ ${cNome} vinculado`);
    closeVinc();
    await Promise.all([loadUmbler(),loadCarteira(),loadProspeccao()]);
    renderUmbler();renderLista();
  } else {
    // Modo extra: apenas atualiza o drawer
    m.dataset.extra = '';
    toast(`🔗 ${cNome} vinculado a este número`);
    closeVinc();
    if (S.selId) { await loadDetalhe(S.selId); renderDrawer(); }
  }
}

// ── VINCULAR AO ERP ───────────────────────────────────────────
function abrirVincularERP(crmId, crmNome) {
  const m = document.getElementById('modal-vinc-erp');
  if (!m) return;
  m.dataset.crmid = crmId;
  m.dataset.crmnome = crmNome;
  document.getElementById('erp-title').textContent = `Vincular "${crmNome.split(' ')[0]}" ao ERP`;
  document.getElementById('erp-search').value = '';
  document.getElementById('erp-results').innerHTML = '<p class="empty-msg">Digite para buscar...</p>';
  m.classList.add('open');
}
function fecharVincularERP() { document.getElementById('modal-vinc-erp')?.classList.remove('open'); }

async function searchVincERP() {
  const q = document.getElementById('erp-search')?.value?.trim();
  if (!q || q.length < 2) return;
  // Busca na vw_dim_cliente — clientes reais do ERP
  const data = await sbQ('vw_dim_cliente',
    `select=id_cliente,nome_cliente,cnpj,cpf,cidade,uf&or=(nome_cliente.ilike.*${encodeURIComponent(q)}*,cnpj.ilike.*${q.replace(/\D/g,'')}*,id_cliente.eq.${isNaN(q)?0:q})&limit=15`);
  const res = Array.isArray(data) ? data : [];
  const el = document.getElementById('erp-results');
  if (!el) return;
  if (!res.length) { el.innerHTML = '<p class="empty-msg">Nenhum cliente ERP encontrado</p>'; return; }
  // Mostrar os já vinculados com badge diferente
  const vincAtual = new Set(S.vinculosERP.map(v => v.id_cliente_erp));
  el.innerHTML = res.map(c => `
    <button onclick="confirmarVincERP(${c.id_cliente},'${esc(c.nome_cliente)}','${esc(c.cnpj||c.cpf||'')}')"
      ${vincAtual.has(c.id_cliente)?'disabled style="opacity:.5;cursor:default"':''}
      class="mres-btn" style="margin-bottom:4px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="mres-nome">${c.nome_cliente}</div>
        <div style="display:flex;align-items:center;gap:6px">
          ${vincAtual.has(c.id_cliente)?'<span style="font-size:10px;color:var(--green);font-weight:600">✓ Já vinculado</span>':''}
          <span style="font-size:11px;color:var(--text-muted)">#${c.id_cliente}</span>
        </div>
      </div>
      ${(c.cnpj||c.cpf||c.cidade)?`<div class="mres-meta">${c.cnpj?fmtC(c.cnpj)+' · ':''}${c.cidade||''}${c.uf?' - '+c.uf:''}</div>`:''}
    </button>`).join('');
}

async function confirmarVincERP(erpId, erpNome, cnpj) {
  const m = document.getElementById('modal-vinc-erp');
  if (!m) return;
  const crmId = Number(m.dataset.crmid);
  const crmNome = m.dataset.crmnome;

  // Verificar se já existe
  if (S.vinculosERP.some(v => v.id_cliente_erp === erpId)) {
    toast('Já vinculado!', 'err'); return;
  }

  const btn = document.getElementById('erp-confirmar');
  // Sem botão de confirmação — o click no item já confirma

  // 1. Auto-insert em atac_clientes se não existe
  const existe = await sbQ('atac_clientes', `select=id_cliente&id_cliente=eq.${erpId}&limit=1`);
  if (!Array.isArray(existe) || !existe.length) {
    const dim = await sbQ('vw_dim_cliente',
      `select=id_cliente,nome_cliente,cnpj,cpf,telefone1,telefone2,cidade,uf,email,situacao&id_cliente=eq.${erpId}&limit=1`);
    const d = Array.isArray(dim) ? dim[0] : null;
    if (d) {
      await sbInsert('atac_clientes', {
        id_cliente: d.id_cliente, nome_cliente: d.nome_cliente,
        cnpj_cpf: d.cnpj||d.cpf||null, telefone1: d.telefone1||null,
        cidade: d.cidade||null, uf: d.uf||null, email: d.email||null,
        situacao: d.situacao||'A', origem: 'VINCULO_ERP',
      });
    }
  }

  // 2. Verificar última compra do ERP → determinar destino
  const lastPed = await sbQ('vw_comercial_docs_faturados',
    `select=data_faturamento,id_vendedor,nome_vendedor&tipo_saida=eq.DISTRIBUICAO&id_cliente=eq.${erpId}&order=data_faturamento.desc&limit=1`);
  const lp = Array.isArray(lastPed) ? lastPed[0] : null;
  const diasUlt = lp?.data_faturamento ? dias(lp.data_faturamento) : 9999;
  const isCarteira = diasUlt <= CFG.compra_risco_dias && lp;

  // 3. Salvar vínculo em atac_cliente_vinculos
  await sbInsert('atac_cliente_vinculos', {
    id_cliente_crm: crmId,
    nome_cliente_crm: crmNome,
    id_cliente_erp: erpId,
    nome_cliente_erp: erpNome,
    cnpj_cpf_erp: cnpj || null,
  });

  // 4. Se carteira, transferir vendedor da última venda
  if (isCarteira && lp.id_vendedor) {
    await sbUpsert('atac_cliente_vendedor', {
      id_cliente: erpId, nome_cliente: erpNome,
      id_vendedor_responsavel: lp.id_vendedor,
      nome_vendedor_responsavel: lp.nome_vendedor,
      atualizado_por: 'VINCULO_ERP',
    }, 'id_cliente');
  }

  // 5. Copiar telefones do cliente CRM para o ERP
  if (S.telefones.length) {
    for (const t of S.telefones) {
      await sbInsert('atac_cliente_telefones', {
        id_cliente: erpId, nome_cliente: erpNome,
        telefone: t.telefone, descricao: `ERP #${erpId}`,
        principal: false,
      });
    }
  }

  fecharVincularERP();

  if (isCarteira) {
    toast(`✅ Vinculado ao ERP → Carteira (${diasUlt}d desde última compra)`);
  } else {
    toast(`✅ Vinculado ao ERP → mantido na Prospecção`);
  }

  // Recarregar detalhe e listas
  await loadDetalhe(crmId);
  renderDrawer();
  await Promise.all([loadCarteira(), loadProspeccao()]);
  renderLista();
}

async function desvincularERP(vincId, crmId, erpNome) {
  if (!confirm(`Desvincular "${erpNome}" deste cliente?\nOs telefones importados deste ERP também serão removidos.`)) return;
  // Remover vínculo
  await sbDel('atac_cliente_vinculos', 'id', vincId);
  // Remover telefones importados deste ERP
  const sess = (await window.sb.auth.getSession()).data.session;
  await fetch(`${window.SUPA_URL}/rest/v1/atac_cliente_telefones?id_cliente=eq.${crmId}&descricao=eq.ERP%20%23${vincId}`, {
    method: 'DELETE', headers: { apikey: window.SUPA_KEY, Authorization: `Bearer ${sess?.access_token||window.SUPA_KEY}` }
  });
  toast(`Desvinculado!`);
  await loadDetalhe(crmId);
  renderDrawer();
}

// ── MODAL ALTERAR VENDEDOR ────────────────────────────────────
function abrirModalVendedor(cId, cNome, vendAtualId) {
  const m = document.getElementById('modal-alterar-vendedor');
  if (!m) return;
  m.dataset.cid = cId;
  m.dataset.cnome = cNome;
  document.getElementById('av-title').textContent = `Vendedor de ${cNome.split(' ')[0]}`;
  const sel = document.getElementById('av-vend');
  sel.innerHTML = '<option value="">Sem vendedor (Prospecção Geral)</option>' +
    S.vendedores.map(v => `<option value="${v.id_vendedor}"${v.id_vendedor===vendAtualId?' selected':''}>${v.nome_vendedor}</option>`).join('');
  m.classList.add('open');
}
function fecharModalVendedor() {
  document.getElementById('modal-alterar-vendedor')?.classList.remove('open');
}
async function salvarModalVendedor() {
  const m = document.getElementById('modal-alterar-vendedor');
  if (!m) return;
  const cId = Number(m.dataset.cid);
  const cNome = m.dataset.cnome;
  const vendId = document.getElementById('av-vend')?.value;
  const btn = document.getElementById('av-btn');
  if (btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }
  try {
    if (vendId) {
      const vend = S.vendedores.find(v => v.id_vendedor === Number(vendId));
      await sbUpsert('atac_cliente_vendedor', {
        id_cliente: cId, nome_cliente: cNome,
        id_vendedor_responsavel: Number(vendId),
        nome_vendedor_responsavel: vend?.nome_vendedor || '',
        atualizado_por: 'CRM_MANUAL',
      }, 'id_cliente');
      toast(`✅ Vendedor alterado para ${sN(vend?.nome_vendedor||'')}`);
    } else {
      // Remover vínculo → volta para prospecção geral
      await sbDel('atac_cliente_vendedor', 'id_cliente', cId);
      toast('Vínculo removido → cliente vai para Prospecção Geral');
    }
    fecharModalVendedor();
    // Recarregar dados e drawer
    await Promise.all([loadCarteira(), loadProspeccao()]);
    // Atualizar selCliente com dados frescos
    const lista = [...S.carteira, ...S.prospeccao, ...S.prospGeral];
    S.selCliente = lista.find(c => c.id_cliente === cId) || S.selCliente;
    if (S.selId) renderDrawer();
    renderLista();
  } finally {
    if (btn) { btn.textContent = 'Salvar'; btn.disabled = false; }
  }
}

// controles UI
function setMainTab(tab){
  S.mainTab=tab;
  if(tab!=='agenda'){S.selId=null;S.selCliente=null;closeDrawer();}
  // Botões de tab
  document.getElementById('tab-c')?.classList.toggle('on',tab==='carteira');
  document.getElementById('tab-p')?.classList.toggle('on',tab==='prospeccao');
  document.getElementById('tab-a')?.classList.toggle('on',tab==='agenda');
  // Controles específicos
  document.getElementById('ctrl-c')?.classList.toggle('hidden',tab!=='carteira');
  const ctrlP=document.getElementById('ctrl-p');
  if(ctrlP) ctrlP.style.display=(tab==='prospeccao')?'flex':'none';
  const ctrlPP=document.getElementById('ctrl-pp');
  if(ctrlPP) ctrlPP.style.display=(tab==='prospeccao'&&S.prospTab==='minha')?'':'none';
  // Painel: lista+detalhe vs agenda
  const crmWrap=document.getElementById('crm-inner-wrap');
  const agendaPanel=document.getElementById('crm-agenda-panel');
  if(tab==='agenda'){
    if(crmWrap) crmWrap.style.display='none';
    if(agendaPanel) agendaPanel.style.display='flex';
    renderAgendaCRM();
  } else {
    if(crmWrap) crmWrap.style.display='flex';
    if(agendaPanel) agendaPanel.style.display='none';
    renderLista();
  }
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
function handleSearch(v){
  S.search=v;
  // Se está na agenda, volta para carteira antes de buscar
  if(S.mainTab==='agenda') setMainTab('carteira');
  renderLista();
}

// ── MODAL NOVO CONTATO UMBLER → PROSPECÇÃO ────────────────────
function abrirNovoContato(tel, nome, atend) {
  S.novoContatoTel = tel;
  S.novoContatoNome = nome;
  S.novoContatoAtend = atend;
  const m = document.getElementById('modal-novo-contato');
  if (!m) return;
  // preencher campos
  document.getElementById('nc-nome').value = nome || '';
  document.getElementById('nc-tel').value = fmtP(tel) || '';
  document.getElementById('nc-cnpj').value = '';
  document.getElementById('nc-cidade').value = '';
  document.getElementById('nc-uf').value = '';
  // detectar vendedor pelo atendente
  const uvMatch = S.umblerVendMap.find(u =>
    (u.usuario_umbler||'').toLowerCase() === (atend||'').toLowerCase() ||
    (u.nome_vendedor_erp||'').toLowerCase() === (atend||'').toLowerCase()
  );
  const vendId = uvMatch?.id_vendedor_erp || null;
  const sel = document.getElementById('nc-vend');
  if (sel) {
    sel.innerHTML = '<option value="">Sem vendedor (Prospecção Geral)</option>' +
      S.vendedores.map(v => `<option value="${v.id_vendedor}"${v.id_vendedor===vendId?' selected':''}>${v.nome_vendedor}</option>`).join('');
  }
  m.classList.add('open');
}
function fecharNovoContato() {
  document.getElementById('modal-novo-contato')?.classList.remove('open');
}
async function salvarNovoContato() {
  const nome = document.getElementById('nc-nome')?.value?.trim();
  const tel = S.novoContatoTel;
  const cnpj = document.getElementById('nc-cnpj')?.value?.trim();
  const cidade = document.getElementById('nc-cidade')?.value?.trim();
  const uf = document.getElementById('nc-uf')?.value?.trim();
  const vendId = document.getElementById('nc-vend')?.value;
  if (!nome) { toast('Nome é obrigatório', 'err'); return; }
  const btn = document.getElementById('nc-btn');
  if (btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }
  try {
    // 1. Criar em atac_clientes_historico (origem UMBLER)
    const r = await fetch(`${window.SUPA_URL}/rest/v1/atac_clientes_historico`, {
      method: 'POST',
      headers: { apikey: window.SUPA_KEY, Authorization: `Bearer ${await getToken()}`,
        'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ nome_cliente: nome, origem: 'UMBLER',
        cnpj_cpf: cnpj||null, cidade: cidade||null, uf: uf||null,
        descartado: false, excluido: false, ultima_compra_anterior: null })
    });
    if (!r.ok) { toast('Erro ao criar cliente', 'err'); return; }
    const [novo] = await r.json();
    const newId = novo.id;
    // 2. Vincular telefone
    await sbInsert('atac_cliente_telefones', {
      id_cliente: newId, nome_cliente: nome,
      telefone: tel, descricao: 'Umbler', principal: true
    });
    // 3. Vincular vendedor se selecionado
    if (vendId) {
      const vend = S.vendedores.find(v => v.id_vendedor === Number(vendId));
      await sbUpsert('atac_cliente_vendedor', {
        id_cliente: newId, nome_cliente: nome,
        id_vendedor_responsavel: Number(vendId),
        nome_vendedor_responsavel: vend?.nome_vendedor || '',
        atualizado_por: 'UMBLER'
      }, 'id_cliente');
    }
    toast(`✅ ${nome} criado e adicionado à ${vendId ? 'Prospecção do Vendedor' : 'Prospecção Geral'}`);
    fecharNovoContato();
    // Recarregar
    await Promise.all([loadUmbler(), loadCarteira(), loadProspeccao()]);
    renderUmbler(); renderLista();
  } finally {
    if (btn) { btn.textContent = 'Criar Cliente'; btn.disabled = false; }
  }
}

// ── VÍNCULOS MÚLTIPLOS POR TELEFONE ───────────────────────────
async function toggleVincsTel(phId, telefone) {
  const listEl = document.getElementById(`vinc-tel-list-${phId}`);
  if (!listEl) return;
  if (listEl.style.display !== 'none') { listEl.style.display = 'none'; return; }
  listEl.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">Carregando...</div>';
  listEl.style.display = 'block';
  const vincs = await loadVinculosTelefone(telefone);
  if (!vincs.length) { listEl.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">Nenhum outro cliente vinculado</div>'; return; }
  listEl.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">
      Clientes com este número (${vincs.length})
    </div>
    ${vincs.map(v=>`
      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;margin-bottom:4px;gap:8px">
        <div style="min-width:0;flex:1">
          <span style="font-size:12px;font-weight:600;color:var(--text-primary)">${v.nome_cliente}</span>
          <span style="font-size:10px;color:var(--text-muted);margin-left:6px">#${v.id_cliente}</span>
          ${v.principal?'<span style="font-size:9px;background:var(--blue-pale);color:var(--blue-dark);border-radius:4px;padding:1px 5px;margin-left:4px;font-weight:700">Principal</span>':''}
          ${v.descricao?`<span style="font-size:10px;color:var(--text-muted);margin-left:4px">(${v.descricao})</span>`:''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button onclick="selCliente(${v.id_cliente})" style="font-size:10px;padding:3px 8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text-secondary);background:var(--surface);cursor:pointer;font-weight:500">Ver</button>
          <button onclick="removerVincTel('${v.id}')" style="font-size:10px;padding:3px 8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--red);background:var(--red-bg);cursor:pointer;font-weight:500">✕</button>
        </div>
      </div>`).join('')}
    <button onclick="abrirVincTelExtra('${esc(telefone)}')"
      style="font-size:11px;color:var(--blue-mid);background:none;border:none;cursor:pointer;padding:4px 0;font-weight:600;display:block">
      + Vincular outro cliente a este número
    </button>`;
}

// Vincular um telefone extra a outro cliente (além do atual)
function abrirVincTelExtra(telefone) {
  // Reutiliza o modal de vincular, mas salva o telefone sem remover o vínculo atual
  const m = document.getElementById('modal-vinc');
  if (!m) return;
  m.dataset.tel = telefone;
  m.dataset.extra = 'true'; // flag: não é novo, é extra
  m.classList.add('open');
  document.getElementById('vinc-search').value = '';
  document.getElementById('vinc-results').innerHTML = '<p class="empty-msg">Digite para buscar...</p>';
}

async function removerVincTel(phId) {
  if (!confirm('Remover este vínculo (não remove o cliente, só a ligação com este número)?')) return;
  await sbDel('atac_cliente_telefones', 'id', phId);
  toast('Vínculo removido!');
  // Recarregar detalhe
  if (S.selId) { await loadDetalhe(S.selId); renderDrawer(); }
}

// ── DESCARTAR CLIENTE (Prospecção Geral) ──────────────────────
async function descartarCliente(id, nome) {
  const motivo = prompt(`Motivo para descartar "${nome}":
(ex: Não tem interesse, Fora de área, Duplicado)`);
  if (motivo === null) return; // cancelou
  if (!motivo.trim()) { toast('Informe o motivo', 'err'); return; }
  // Marca como descartado em atac_crm_clientes (se tiver campo) ou em atac_clientes_historico
  await sbUpdate('atac_crm_clientes', 'id_cliente', id, { descartado: true, motivo_descarte: motivo });
  toast(`${nome} descartado`);
  // Recarrega
  await loadProspeccao();
  renderLista();
}

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
// ══════════════════════════════════════════════════════════
// AGENDA CALENDÁRIO — sub-aba do CRM
// ══════════════════════════════════════════════════════════

// Estado da agenda
const AG = {
  ano: new Date().getFullYear(),
  mes: new Date().getMonth(),   // 0–11
  diaSel: null,
  tarefas: [],   // todas as tarefas do mês carregado
};

async function renderAgendaCRM() {
  const el = document.getElementById('crm-agenda-panel');
  if (!el) return;
  el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)"><div class="spinner" style="margin:0 auto 12px"></div>Carregando...</div>';
  await loadTarefasMes();
  drawAgenda(el);
}

async function loadTarefasMes() {
  const inicio = new Date(AG.ano, AG.mes, 1).toISOString().split('T')[0];
  const fim    = new Date(AG.ano, AG.mes+1, 0).toISOString().split('T')[0];
  let params = `select=id,tipo,nome_cliente,texto,data_prevista,criado_por,nome_vendedor_responsavel,resolvido&data_prevista=gte.${inicio}&data_prevista=lte.${fim}&order=data_prevista.asc`;
  if (F.vendedorId) params += `&id_vendedor_responsavel=eq.${F.vendedorId}`;
  const d = await sbQ('atac_crm_notas', params);
  AG.tarefas = Array.isArray(d) ? d : [];
}

function drawAgenda(el) {
  const hoje = new Date();
  const primeiroDia = new Date(AG.ano, AG.mes, 1);
  const ultimoDia   = new Date(AG.ano, AG.mes+1, 0);
  const diasNoMes   = ultimoDia.getDate();
  const inicioSem   = primeiroDia.getDay(); // 0=dom

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DIAS_SEM = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  // Agrupar tarefas por dia
  const porDia = new Map();
  AG.tarefas.forEach(t => {
    if (!t.data_prevista) return;
    const d = t.data_prevista.substring(0,10);
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d).push(t);
  });

  // Dia selecionado: padrão = hoje se no mês atual
  if (!AG.diaSel) {
    AG.diaSel = (hoje.getFullYear()===AG.ano && hoje.getMonth()===AG.mes)
      ? `${AG.ano}-${String(AG.mes+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`
      : `${AG.ano}-${String(AG.mes+1).padStart(2,'0')}-01`;
  }

  const vendNome = F.vendedorId ? sN(S.vendedores.find(v=>v.id_vendedor===F.vendedorId)?.nome_vendedor||'') : 'Todos';

  // Contar pendentes
  const vencidas = AG.tarefas.filter(t=>!t.resolvido && t.data_prevista < hoje.toISOString().split('T')[0]).length;
  const deHoje   = AG.tarefas.filter(t=>!t.resolvido && t.data_prevista === hoje.toISOString().split('T')[0]).length;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden">

      <!-- Header da agenda -->
      <div style="padding:12px 20px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0">
        <div style="display:flex;align-items:center;gap:12px">
          <button onclick="setMainTab('carteira')"
            style="font-size:12px;font-weight:600;color:var(--blue-mid);background:var(--blue-pale);border:1.5px solid rgba(0,119,204,.2);border-radius:var(--radius-sm);padding:5px 12px;cursor:pointer">
            ← CRM
          </button>
          <div style="display:flex;align-items:center;gap:8px">
            <button onclick="navMes(-1)" style="width:28px;height:28px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">‹</button>
            <span style="font-size:14px;font-weight:700;color:var(--text-primary);min-width:140px;text-align:center">${MESES[AG.mes]} ${AG.ano}</span>
            <button onclick="navMes(1)"  style="width:28px;height:28px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">›</button>
            <button onclick="navMes(0)"  style="font-size:11px;font-weight:600;color:var(--text-muted);background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px 10px;cursor:pointer">Hoje</button>
          </div>
          <span style="font-size:12px;color:var(--text-muted)">— ${vendNome}</span>
          <div style="margin-left:auto;display:flex;gap:6px">
            ${vencidas?`<span style="background:var(--red-bg);color:var(--red);padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700">⚠ ${vencidas}</span>`:''}
            ${deHoje?`<span style="background:var(--blue-pale);color:var(--blue-dark);padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700">📌 ${deHoje}</span>`:''}
          </div>
        </div>
      </div>

      <!-- Corpo: calendário + painel lateral -->
      <div style="display:flex;flex:1;overflow:hidden">

        <!-- CALENDÁRIO -->
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;padding:12px">

          <!-- Cabeçalho dias da semana -->
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">
            ${DIAS_SEM.map(d=>`<div style="text-align:center;font-size:10px;font-weight:700;color:var(--text-muted);padding:4px">${d}</div>`).join('')}
          </div>

          <!-- Grid dias -->
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;flex:1">
            ${Array.from({length: inicioSem}, ()=>'<div></div>').join('')}
            ${Array.from({length: diasNoMes}, (_,i)=>{
              const dia = i+1;
              const dStr = `${AG.ano}-${String(AG.mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
              const eHoje = hoje.getFullYear()===AG.ano && hoje.getMonth()===AG.mes && hoje.getDate()===dia;
              const eSel  = AG.diaSel === dStr;
              const tarefasDia = porDia.get(dStr) || [];
              const temVencida = tarefasDia.some(t=>!t.resolvido && dStr < hoje.toISOString().split('T')[0]);
              const temAtiva   = tarefasDia.some(t=>!t.resolvido);
              const temResol   = tarefasDia.length && tarefasDia.every(t=>t.resolvido);

              let bg='transparent', border='1px solid transparent', txtColor='var(--text-primary)';
              if(eSel)  { bg='var(--blue-dark)'; border='1px solid var(--blue-dark)'; txtColor='#fff'; }
              else if(eHoje) { border='2px solid var(--blue-mid)'; }

              let dotHtml = '';
              if(!eSel && tarefasDia.length) {
                if(temVencida) dotHtml=`<div style="width:5px;height:5px;border-radius:50%;background:var(--red);margin:1px auto 0"></div>`;
                else if(temAtiva) dotHtml=`<div style="width:5px;height:5px;border-radius:50%;background:var(--blue-mid);margin:1px auto 0"></div>`;
                else dotHtml=`<div style="width:5px;height:5px;border-radius:50%;background:var(--green);margin:1px auto 0"></div>`;
              }

              return `<button onclick="selDia('${dStr}')" style="background:${bg};border:${border};border-radius:var(--radius-sm);padding:4px 2px;cursor:pointer;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;transition:all .1s" onmouseover="if('${eSel}'!=='true')this.style.background='var(--surface2)'" onmouseout="if('${eSel}'!=='true')this.style.background='${bg}'">
                <span style="font-size:12px;font-weight:${eHoje||eSel?700:400};color:${txtColor}">${dia}</span>
                ${tarefasDia.length&&!eSel?`<span style="font-size:9px;color:${eSel?'rgba(255,255,255,.7)':temVencida?'var(--red)':temAtiva?'var(--blue-mid)':'var(--green)'};font-weight:600">${tarefasDia.length}</span>`:''}
                ${dotHtml}
              </button>`;
            }).join('')}
          </div>
        </div>

        <!-- PAINEL LATERAL: tarefas do dia selecionado -->
        <div id="agenda-dia-panel" style="width:280px;border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;background:var(--surface)">
        </div>

      </div>
    </div>`;

  // Renderizar painel do dia selecionado
  renderDiaPanel();
}

function selDia(dStr) {
  AG.diaSel = dStr;
  // Re-render só o painel (não o calendário inteiro — evita flickering)
  const cals = document.getElementById('crm-agenda-panel');
  if (cals) {
    // Re-highlight dos botões
    const dias = cals.querySelectorAll('button[onclick^="selDia"]');
    dias.forEach(btn => {
      const d = btn.getAttribute('onclick').match(/'(.+)'/)?.[1];
      if (d === dStr) { btn.style.background='var(--blue-dark)'; btn.style.border='1px solid var(--blue-dark)'; }
      else if (btn.style.border.includes('2px')) {} // hoje: mantém
      else { btn.style.background='transparent'; btn.style.border='1px solid transparent'; }
    });
  }
  renderDiaPanel();
}

function renderDiaPanel() {
  const el = document.getElementById('agenda-dia-panel');
  if (!el) return;
  const dStr = AG.diaSel;
  if (!dStr) { el.innerHTML=''; return; }

  const tarefas = AG.tarefas.filter(t => t.data_prevista === dStr);
  const hoje = new Date().toISOString().split('T')[0];
  const [ano,mes,dia] = dStr.split('-').map(Number);
  const dLabel = `${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${ano}`;
  const eHoje = dStr === hoje;
  const ePassado = dStr < hoje;

  el.innerHTML = `
    <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <div>
        <p style="font-size:13px;font-weight:700;color:var(--text-primary)">${dLabel}${eHoje?' — Hoje':''}</p>
        <p style="font-size:11px;color:var(--text-muted)">${tarefas.length} atividade${tarefas.length!==1?'s':''}</p>
      </div>
      <button onclick="abrirNovaAtividade('${dStr}')"
        style="font-size:11px;font-weight:700;padding:5px 10px;background:var(--blue-dark);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer">
        + Nova
      </button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:8px">
      ${tarefas.length ? tarefas.map(t=>`
        <div style="background:var(--surface2);border:1px solid var(--border);border-left:3px solid ${t.resolvido?'var(--green)':ePassado&&!t.resolvido?'var(--red)':'var(--blue-mid)'};border-radius:var(--radius-sm);padding:8px 10px;margin-bottom:6px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            ${tipoBdg(t.tipo)}
            ${!t.resolvido?`<button onclick="resolverNotaAgenda('${t.id}')" style="font-size:10px;color:var(--green);background:none;border:none;cursor:pointer;font-weight:700">✓</button>`:`<span style="font-size:10px;color:var(--green);font-weight:600">✓ Feito</span>`}
          </div>
          <p style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:2px;line-height:1.3">${t.nome_cliente}</p>
          <p style="font-size:11px;color:var(--text-secondary)">${t.texto||'—'}</p>
          ${t.criado_por?`<p style="font-size:10px;color:var(--text-muted);margin-top:3px">Por: ${t.criado_por}</p>`:''}
        </div>`).join('')
      : `<div style="text-align:center;padding:24px 12px;color:var(--text-muted)">
          <div style="font-size:28px;margin-bottom:8px">📅</div>
          <p style="font-size:12px">Nenhuma atividade</p>
          <button onclick="abrirNovaAtividade('${dStr}')"
            style="font-size:11px;font-weight:600;color:var(--blue-mid);background:none;border:none;cursor:pointer;margin-top:6px;text-decoration:underline">
            + Adicionar atividade
          </button>
        </div>`}
    </div>`;
}

function navMes(delta) {
  if (delta === 0) {
    const now = new Date();
    AG.ano = now.getFullYear();
    AG.mes = now.getMonth();
    AG.diaSel = null;
  } else {
    AG.mes += delta;
    if (AG.mes < 0) { AG.mes = 11; AG.ano--; }
    if (AG.mes > 11) { AG.mes = 0;  AG.ano++; }
    AG.diaSel = null;
  }
  renderAgendaCRM();
}

// Modal Nova Atividade a partir da agenda
function abrirNovaAtividade(dataPrevista) {
  const m = document.getElementById('modal-nova-ativ');
  if (!m) return;
  m.dataset.data = dataPrevista;
  document.getElementById('na-data').value = dataPrevista;
  document.getElementById('na-cliente').value = '';
  document.getElementById('na-texto').value = '';
  document.getElementById('na-criado').value = '';
  document.getElementById('na-tipo').value = 'TAREFA';
  // popular select vendedor
  const sel = document.getElementById('na-vend');
  if(sel) {
    sel.innerHTML = '<option value="">Sem vendedor</option>' +
      S.vendedores.map(v=>`<option value="${v.id_vendedor}"${v.id_vendedor===F.vendedorId?' selected':''}>${v.nome_vendedor}</option>`).join('');
  }
  m.classList.add('open');
}
function fecharNovaAtividade() { document.getElementById('modal-nova-ativ')?.classList.remove('open'); }

async function salvarNovaAtividade() {
  const tipo    = document.getElementById('na-tipo')?.value;
  const cliente = document.getElementById('na-cliente')?.value?.trim();
  const texto   = document.getElementById('na-texto')?.value?.trim();
  const criado  = document.getElementById('na-criado')?.value?.trim();
  const data    = document.getElementById('na-data')?.value;
  const vendId  = document.getElementById('na-vend')?.value;
  if (!cliente || !texto || !criado) { toast('Preencha cliente, texto e criado por', 'err'); return; }
  const vend = vendId ? S.vendedores.find(v=>v.id_vendedor===Number(vendId)) : null;
  const btn = document.getElementById('na-btn');
  if(btn){btn.textContent='Salvando...';btn.disabled=true;}
  await sbInsert('atac_crm_notas', {
    id_cliente: null,
    nome_cliente: cliente,
    tipo, texto,
    criado_por: criado,
    data_prevista: data || null,
    id_vendedor_responsavel: vend?.id_vendedor || null,
    nome_vendedor_responsavel: vend?.nome_vendedor || null,
  });
  toast('Atividade criada!');
  fecharNovaAtividade();
  if(btn){btn.textContent='Salvar';btn.disabled=false;}
  // Recarregar agenda
  await loadTarefasMes();
  renderDiaPanel();
}

async function resolverNotaAgenda(id) {
  await sbUpdate('atac_crm_notas','id',id,{resolvido:true,data_resolucao:new Date().toISOString()});
  toast('✅ Resolvido!');
  // Atualizar no estado local (sem recarregar tudo)
  const t = AG.tarefas.find(x=>x.id===id);
  if(t) t.resolvido = true;
  renderDiaPanel();
  // Atualizar alertas se o CRM estiver visível
  renderAlertasCRM();
}


// Navegar para o cliente na agenda (busca por nome)
async function selClienteByNome(nome) {
  const c = [...S.carteira, ...S.prospeccao, ...S.prospGeral].find(c => c.nome_cliente === nome);
  if (c) {
    // Vai para CRM e abre o cliente
    gotoTab('crm');
    const tab = S.carteira.find(x=>x.id_cliente===c.id_cliente) ? 'carteira' : 'prospeccao';
    setMainTab(tab);
    await selCliente(c.id_cliente);
  } else {
    toast('Cliente não encontrado na lista atual', 'err');
  }
}

window.APP={init, refresh: async function(){
  await Promise.all([loadDocs(),loadCarteira(),loadProspeccao(),loadUmbler(),loadOverdue(),loadToday()]);
  if(S.tab==='home')renderHome();
  if(S.tab==='vendedores')renderVendedores();
  if(S.tab==='crm')renderCRM();
}};
window.gotoTab=gotoTab;
window.descartarCliente=descartarCliente;
window.renderAgendaCRM=renderAgendaCRM;
window.selClienteByNome=selClienteByNome;
window.navMes=navMes;
window.selDia=selDia;
window.abrirNovaAtividade=abrirNovaAtividade;
window.fecharNovaAtividade=fecharNovaAtividade;
window.salvarNovaAtividade=salvarNovaAtividade;
window.resolverNotaAgenda=resolverNotaAgenda;
window.naoComercialConfig=naoComercialConfig;
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
window.abrirNovoContato=abrirNovoContato;
window.toggleVincsTel=toggleVincsTel;
window.removerVincTel=removerVincTel;
window.abrirVincTelExtra=abrirVincTelExtra;
window.fecharNovoContato=fecharNovoContato;
window.salvarNovoContato=salvarNovoContato;
window.toggleNotaDate=toggleNotaDate;
window.saveCfg=saveCfg;
window.newUV=newUV;
window.editUV=editUV;
window.closeUV=closeUV;
window.saveUV=saveUV;
window.delUV=delUV;
window.abrirVincularERP=abrirVincularERP;
window.fecharVincularERP=fecharVincularERP;
window.searchVincERP=searchVincERP;
window.confirmarVincERP=confirmarVincERP;
window.desvincularERP=desvincularERP;
window.abrirModalVendedor=abrirModalVendedor;
window.fecharModalVendedor=fecharModalVendedor;
window.salvarModalVendedor=salvarModalVendedor;
