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
  notas: [], telefones: [], pedidos: [], vinculosERP: [], umblerTelMap: new Map(), finAlerta: null, _descartarMotivo: '',  // vínculos ERP do cliente aberto
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
  // CPF filtrado direto na view atac_crm_clientes (campo nao_comercial)
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
  // Aplicar filtro automático pelo usuário logado
  await aplicarFiltroUsuario();
  await Promise.all([loadDocs(), loadCarteira(), loadProspeccao(), loadUmbler(), loadUmblerVendMap(), loadOverdue(), loadToday()]);
  gotoTab('crm'); // abre direto no CRM
}

async function aplicarFiltroUsuario() {
  try {
    const sess = (await window.sb.auth.getSession()).data.session;
    const email = sess?.user?.email;
    if (!email) return;
    const cfg = await sbQ('atac_config_usuario', `select=id_vendedor_erp,nome_vendedor&email=eq.${encodeURIComponent(email)}`);
    if (Array.isArray(cfg) && cfg.length > 0) {
      const { id_vendedor_erp, nome_vendedor } = cfg[0];
      F.vendedorId = id_vendedor_erp;
      // Atualizar o select de vendedor na topbar
      const sel = document.getElementById('vend-filter');
      if (sel) sel.value = String(id_vendedor_erp);
    }
  } catch(e) { console.warn('aplicarFiltroUsuario:', e); }
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
// CPF filtrado na view atac_crm_clientes via campo nao_comercial — sem necessidade de lista no frontend

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
  S.carteira=(Array.isArray(d)?d:[]).filter(c=>{
    // Clientes sem compra (criados via Umbler) com vendedor vinculado ficam na carteira
    if(c.ultima_compra==null && c.id_vendedor_responsavel!=null) return true;
    // Demais: só entra na carteira se não for PROSPECCAO
    return getStatus(c)!=='PROSPECCAO';
  });
}
async function loadProspeccao() {
  // Prospecção do vendedor (com vínculo)
  let params='select=*&status_crm=eq.PROSPECCAO&id_vendedor_responsavel=not.is.null&order=dias_sem_interacao.desc.nullslast';
  if(F.vendedorId) params+=`&id_vendedor_responsavel=eq.${F.vendedorId}`;
  const d=await sbQ('atac_crm_clientes',params);
  const prosp=(Array.isArray(d)?d:[]);

  // Prospecção Geral (sem vendedor vinculado)
  const gParams='select=*&status_crm=eq.PROSPECCAO&id_vendedor_responsavel=is.null&order=dias_sem_compra.desc.nullslast';
  const gd=await sbQ('atac_crm_clientes',gParams);
  S.prospGeral=(Array.isArray(gd)?gd:[]);

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
  const [cts, tels] = await Promise.all([
    sbQ('atac_umbler_contatos', 'select=telefone,nome_contato,nome_atendente,ultimo_contato&nao_comercial=eq.false&order=ultimo_contato.desc'),
    sbQ('atac_cliente_telefones', 'select=telefone,id_cliente,nome_cliente'),
  ]);

  const telsArr = Array.isArray(tels) ? tels : [];
  const vinc = new Set(telsArr.map(t => t.telefone));
  const telClienteMap = new Map(telsArr.map(t => [t.telefone, { id: t.id_cliente, nome: t.nome_cliente }]));

  // Contatos ainda sem vínculo
  let semVinculo = (Array.isArray(cts) ? cts : []).filter(c => !vinc.has(c.telefone));

  // Para os sem vínculo, verificar se o telefone existe no ERP (vw_dim_cliente)
  if (semVinculo.length > 0) {
    // Normalizar telefones para busca: remover DDI 55 para comparar com ERP
    const telsParaBusca = semVinculo.map(c => {
      const d = (c.telefone||'').replace(/\D/g,'');
      // ERP armazena sem DDI — tentar com e sem
      return d.startsWith('55') ? d.slice(2) : d;
    });

    // Buscar em vw_dim_cliente pelos 3 campos de telefone
    // Fazemos buscas individuais por OR não é suportado facilmente — buscamos por bloco
    const dimData = await sbQ('vw_dim_cliente',
      `select=id_cliente,nome_cliente,telefone1,telefone2,telefone3&or=(${
        telsParaBusca.filter(Boolean).map(t =>
          `telefone1.ilike.*${t}*,telefone2.ilike.*${t}*,telefone3.ilike.*${t}*`
        ).join(',')
      })`);

    const dimArr = Array.isArray(dimData) ? dimData : [];

    // Montar mapa: numero_limpo → cliente ERP
    const erpTelMap = new Map();
    for (const dim of dimArr) {
      for (const campo of ['telefone1','telefone2','telefone3']) {
        if (!dim[campo]) continue;
        const norm = dim[campo].replace(/\D/g,'');
        erpTelMap.set(norm, dim);
      }
    }

    // Para cada contato sem vínculo, ver se bate com ERP
    const inserir = [];
    const vinculadosAgora = new Set();
    for (const c of semVinculo) {
      const d = (c.telefone||'').replace(/\D/g,'');
      const dSem55 = d.startsWith('55') ? d.slice(2) : d;
      const match = erpTelMap.get(d) || erpTelMap.get(dSem55);
      if (match) {
        // Verificar se cliente já está na atac_crm_clientes (canal atacado)
        const naView = await sbQ('atac_crm_clientes', `select=id_cliente&id_cliente=eq.${match.id_cliente}`);
        const jaExiste = Array.isArray(naView) && naView.length > 0;

        if (!jaExiste) {
          // Não está na view — criar na atac_clientes para entrar na prospecção
          const jaAtac = await sbQ('atac_clientes', `select=id_cliente&id_cliente=eq.${match.id_cliente}`);
          if (!Array.isArray(jaAtac) || jaAtac.length === 0) {
            await sbInsert('atac_clientes', {
              id_cliente: match.id_cliente,
              nome_cliente: match.nome_cliente,
              situacao: 'A',
              origem: 'UMBLER',
              nao_comercial: false,
              criado_em: new Date().toISOString()
            });
          }
        }

        // Só vincula automaticamente se já estava na view (cliente atacado conhecido)
        if (jaExiste) {
          inserir.push({
            id_cliente: match.id_cliente,
            nome_cliente: match.nome_cliente,
            telefone: c.telefone,
            descricao: 'ERP',
            principal: false
          });
          vinculadosAgora.add(c.telefone);
        } else {
          // Não está no CRM — guardar sugestão para mostrar no card
          c.erpSugestao = { id: match.id_cliente, nome: match.nome_cliente };
        }
      }
    }

    // Inserir vínculos encontrados
    if (inserir.length > 0) {
      await sbInsert('atac_cliente_telefones', inserir);
      console.log(`Umbler auto-vinculou ${inserir.length} contato(s) ao ERP`);
    }

    // Remover da lista sem tratativa os que foram vinculados agora
    semVinculo = semVinculo.filter(c => !vinculadosAgora.has(c.telefone));
  }

  let umbler = semVinculo;

  // Filtro por vendedor
  if (F.vendedorId && S.umblerVendMap.length) {
    const uvMaps = S.umblerVendMap.filter(u => u.id_vendedor_erp === F.vendedorId);
    if (uvMaps.length) {
      const nomes = uvMaps.flatMap(u => [
        (u.usuario_umbler||'').toLowerCase(),
        (u.nome_vendedor_erp||'').toLowerCase()
      ]).filter(Boolean);
      umbler = umbler.filter(c => nomes.some(n => (c.nome_atendente||'').toLowerCase().includes(n) || n.includes((c.nome_atendente||'').toLowerCase().split(' ')[0])));
    } else umbler = [];
  }

  S.umbler = umbler;
  const cnt = S.umbler.length;
  const el = document.getElementById('umbl-cnt');
  if (el) { el.textContent = cnt; el.classList.toggle('hidden', cnt === 0); }
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
    sbQ('atac_crm_notas', `select=*,reagendado,qtd_reagendamentos&id_cliente=eq.${id}&order=data_criacao.desc`),
    sbQ('atac_cliente_telefones', `select=*&id_cliente=eq.${id}&order=principal.desc`),
    sbQ('atac_cliente_vinculos', `select=id,id_cliente_erp,nome_cliente_erp,cnpj_cpf_erp&id_cliente_crm=eq.${id}`),
  ]);
  S.notas = Array.isArray(notas) ? notas : [];
  S.vinculosERP = Array.isArray(vincErp) ? vincErp : [];

  // Sincronizar telefones do ERP (cliente + todos os vínculos ERP)
  const todosIdsERP = [id, ...S.vinculosERP.map(v => v.id_cliente_erp)];
  const dimData = await sbQ('vw_dim_cliente', `select=id_cliente,telefone1,telefone2,telefone3&id_cliente=in.(${todosIdsERP.join(',')})`);
  const dimArr = Array.isArray(dimData) ? dimData : [];

  // Montar lista de telefones do ERP para inserir se não existirem
  const telsExistentes = new Set((Array.isArray(tels) ? tels : []).map(t => (t.telefone||'').replace(/\D/g,'')));
  const inserirTels = [];
  for (const dim of dimArr) {
    for (const campo of ['telefone1','telefone2','telefone3']) {
      if (!dim[campo]) continue;
      const norm = dim[campo].replace(/\D/g,'');
      if (!norm || norm.length < 8) continue;
      // Normalizar: adicionar DDI 55 se não tiver
      const tel = norm.startsWith('55') && norm.length > 11 ? norm : '55' + norm;
      if (telsExistentes.has(tel) || telsExistentes.has(norm)) continue;
      telsExistentes.add(tel);
      inserirTels.push({ id_cliente: id, nome_cliente: S.selCliente?.nome_cliente || '', telefone: tel, descricao: 'ERP', principal: false });
    }
  }
  // Inserir novos telefones do ERP em batch
  if (inserirTels.length > 0) {
    await sbInsert('atac_cliente_telefones', inserirTels);
  }

  // Recarregar telefones após sync
  const telsAtual = inserirTels.length > 0
    ? await sbQ('atac_cliente_telefones', `select=*&id_cliente=eq.${id}&order=principal.desc`)
    : (Array.isArray(tels) ? tels : []);

  // Deduplicar telefones por número
  const telSeen = new Set();
  S.telefones = (Array.isArray(telsAtual) ? telsAtual : []).filter(t => {
    const k = (t.telefone||'').replace(/\D/g,'');
    if(!k || telSeen.has(k)) return false;
    telSeen.add(k); return true;
  });

  // Buscar contatos Umbler vinculados por telefone
  if (S.telefones.length > 0) {
    const telsParam = S.telefones.map(t => t.telefone).join(',');
    const umblerTels = await sbQ('atac_umbler_contatos', `select=telefone,nome_contato,nome_atendente,ultimo_contato&telefone=in.(${telsParam})`);
    S.umblerTelMap = new Map((Array.isArray(umblerTels) ? umblerTels : []).map(u => [u.telefone, u]));
  } else {
    S.umblerTelMap = new Map();
  }

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

  // Buscar títulos financeiros em aberto (vencidos) — todos os IDs vinculados
  const finData = await sbQ('cob_titulos_com_cliente',
    `select=id,saldo_real,dt_vencimento,dias_atraso,num_doc,chdados&id_contato=in.(${idsParam})&order=dt_vencimento.asc`);
  const fins = Array.isArray(finData) ? finData : [];
  if (fins.length > 0) {
    const totalAberto = fins.reduce((s, f) => s + (f.saldo_real || 0), 0);
    const maxAtraso = Math.max(...fins.map(f => f.dias_atraso || 0));
    S.finAlerta = { qtd: fins.length, total: totalAberto, maxAtraso, titulos: fins };
  } else {
    S.finAlerta = null;
  }
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

// Alertas CRM — linha fina, 3 chips + ocultar
// Estado persiste na sessão
let alertasOcultos = false;

async function renderAlertasCRM() {
  const el = document.getElementById('crm-alertas'); if(!el)return;

  if (alertasOcultos) {
    el.innerHTML = `
      <div style="height:28px;border-bottom:1px solid var(--border);padding:0 12px;display:flex;align-items:center;gap:6px;background:var(--surface2)">
        <span style="font-size:10px;color:var(--text-muted)">Alertas ocultos</span>
        <button onclick="toggleAlertasCRM()" style="font-size:10px;font-weight:600;color:var(--blue-mid);background:none;border:none;cursor:pointer">Mostrar</button>
      </div>`;
    return;
  }

  const hoje = new Date().toISOString().split('T')[0];
  const proxStr = new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  let base = 'select=id&resolvido=eq.false';
  if (F.vendedorId) base += `&id_vendedor_responsavel=eq.${F.vendedorId}`;

  const [atr, hj, prox] = await Promise.all([
    sbQ('atac_crm_notas', base + `&data_prevista=lt.${hoje}&limit=999`),
    sbQ('atac_crm_notas', base + `&data_prevista=eq.${hoje}&limit=999`),
    sbQ('atac_crm_notas', base + `&data_prevista=gt.${hoje}&data_prevista=lte.${proxStr}&limit=999`),
  ]);

  const nAtr = Array.isArray(atr)?atr.length:0;
  const nHj  = Array.isArray(hj)?hj.length:0;
  const nProx= Array.isArray(prox)?prox.length:0;

  if (!nAtr && !nHj && !nProx) { el.innerHTML=''; return; }

  // Uma única linha compacta
  el.innerHTML = `
    <div style="height:30px;border-bottom:1px solid var(--border);padding:0 12px;display:flex;align-items:center;gap:6px;background:var(--surface2);flex-shrink:0">
      ${nHj>0  ? `<span onclick="setMainTab('agenda')" style="background:var(--blue-pale);color:var(--blue-dark);font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;cursor:pointer;white-space:nowrap">📌 ${nHj} hoje</span>` : ''}
      ${nAtr>0 ? `<span onclick="setMainTab('agenda')" style="background:var(--red-bg);color:var(--red);font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;cursor:pointer;white-space:nowrap">⚠ ${nAtr} atrasada${nAtr>1?'s':''}</span>` : ''}
      ${nProx>0? `<span onclick="setMainTab('agenda')" style="background:var(--surface);color:var(--text-muted);font-size:10px;font-weight:600;padding:2px 9px;border-radius:20px;border:1px solid var(--border);cursor:pointer;white-space:nowrap">📅 ${nProx} próx. 7 dias</span>` : ''}
      <button onclick="toggleAlertasCRM()" style="margin-left:auto;font-size:10px;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:0 4px;flex-shrink:0">Ocultar ✕</button>
    </div>`;
}

function toggleAlertasCRM() {
  alertasOcultos = !alertasOcultos;
  renderAlertasCRM();
}

// Mantido para compatibilidade
function renderToday(tasks) {}

function renderUmbler() {
  const el=document.getElementById('umbl-wrap');if(!el)return;
  if(!S.umbler.length){el.innerHTML='';return;}
  const open=S.umblerOpen;
  // Altura de ~5 itens visíveis (~80px cada) com scroll para o resto
  el.innerHTML=`
    <div class="umbl-header${open?'':' coll'}" onclick="toggleUmbler()" style="border-bottom:1px solid var(--border)">
      <span style="font-size:11px;color:#f87171">${open?'▼':'▶'}</span>
      <span class="umbl-title">📲 Contatos Sem Tratativa</span>
      <span class="umbl-badge">${S.umbler.length}</span>
    </div>
    ${open?`<div class="umbl-body" style="max-height:400px;overflow-y:auto">
      ${S.umbler.map(c=>{
        const sug = c.erpSugestao;
        return `<div class="umbl-item">
        <div class="umbl-nome">${c.nome_contato||'Sem nome'}</div>
        <div class="umbl-info"><span>${fmtP(c.telefone)}</span><span>${sN(c.nome_atendente)}</span><span>${fmtDT(c.ultimo_contato)}</span></div>
        ${sug ? `<div style="display:flex;align-items:center;gap:6px;margin:4px 0;padding:5px 8px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.25);border-radius:6px">
          <span style="font-size:11px;color:var(--blue-mid);font-weight:600">🔗 Possível: ${sug.nome}</span>
          <button class="btn-vinc" style="margin-left:auto;border-color:var(--blue-mid);color:var(--blue-mid);font-size:10px;padding:2px 7px" onclick="abrirVincComSugestao('${esc(c.telefone)}','${esc(c.nome_contato)}','${esc(c.nome_atendente)}',${sug.id},'${esc(sug.nome)}')">Vincular</button>
        </div>` : ''}
        <div class="umbl-acts">
          <button class="btn-vinc" onclick="abrirVinc('${esc(c.telefone)}','${esc(c.nome_contato)}','${esc(c.nome_atendente)}')">🔗 Vincular</button>
          ${!sug ? `<button class="btn-vinc" style="border-color:var(--blue-mid);color:var(--blue-mid)" onclick="abrirNovoContato('${esc(c.telefone)}','${esc(c.nome_contato)}','${esc(c.nome_atendente)}')">👤 Criar Novo</button>` : ''}
          <button class="btn-nc" onclick="naoComercial('${esc(c.telefone)}')">✕ Não comercial</button>
        </div>
      </div>`;
      }).join('')}
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

    return`<div class="cl-item${sel?' sel':''}" style="cursor:default">
      <div style="display:flex;align-items:flex-start;gap:4px">
        <div style="flex:1;min-width:0" onclick="selCliente(${c.id_cliente})" style="cursor:pointer">
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
        </div>
        <button onclick="event.stopPropagation();descartarCliente(${c.id_cliente},'${esc(c.nome_cliente)}')"
          title="Descartar cliente"
          style="flex-shrink:0;margin-top:2px;width:22px;height:22px;border-radius:50%;border:1.5px solid var(--border);background:none;color:var(--text-muted);cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;transition:all .15s"
          onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)';this.style.background='var(--red-bg)'"
          onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)';this.style.background='none'">✕</button>
      </div>
    </div>`;
  }).join('');
}

function filteredCarteira(){
  let d = S.carteira;
  if (S.search && S.search.trim()) {
    const s = S.search.trim().toLowerCase();
    d = d.filter(c => {
      const nome = (c.nome_cliente || '').toLowerCase();
      if (nome.includes(s)) return true;
      const dim = S.dimMap.get(c.id_cliente) || {};
      if ((dim.cidade || '').toLowerCase().includes(s)) return true;
      const cnpj = (dim.cnpj_cpf || c.cnpj_cpf || '').replace(/\D/g,'');
      if (cnpj && cnpj.includes(s.replace(/\D/g,''))) return true;
      if (String(c.id_cliente).includes(s)) return true;
      return false;
    });
  }
  if (S.subFilter !== 'todos') {
    d = d.filter(c => {
      const st = getStatus(c);
      if (S.subFilter === 'ativo')    return st === 'ATIVO';
      if (S.subFilter === 'atencao')  return st === 'ATENCAO';
      if (S.subFilter === 'em_risco') return st === 'PERDIDO';
      return true;
    });
  }
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
  if(waEl) waEl.style.display='none';

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
        <button onclick="abrirEditarCliente(${c.id_cliente},'${esc(c.nome_cliente)}')" 
          style="font-size:11px;font-weight:600;padding:5px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text-secondary);background:var(--surface2);cursor:pointer;display:flex;align-items:center;gap:4px">
          ✎ Editar Cliente
        </button>
      </div>
    </div>

    <!-- CLIENTES ERP VINCULADOS -->
    ${S.vinculosERP.length ? `
    <div>
      <div class="sec-head" style="margin-bottom:6px">
        <span class="sec-lbl">🔗 Códigos ERP Vinculados (${S.vinculosERP.length})</span>
        <button onclick="abrirVincularERP(${c.id_cliente},'${esc(c.nome_cliente)}')" class="link-add">+ Adicionar</button>
      </div>
      <p style="font-size:10px;color:var(--text-muted);margin-bottom:8px">Pedidos, última compra e status consideram o mais recente entre todos os códigos.</p>
      ${S.vinculosERP.map(v=>`
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:6px;gap:8px">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.nome_cliente_erp||'—'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:1px">
              <span>#${v.id_cliente_erp}</span>
              ${v.cnpj_cpf_erp?`<span style="margin-left:8px">${fmtC(v.cnpj_cpf_erp)}</span>`:''}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button onclick="editarVincERP('${v.id}','${esc(v.nome_cliente_erp||'')}','${esc(v.cnpj_cpf_erp||'')}',${c.id_cliente})"
              style="font-size:11px;padding:4px 8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--blue-mid);background:var(--blue-pale);cursor:pointer;font-weight:500">
              ✎ Editar
            </button>
            <button onclick="desvincularERP('${v.id}',${c.id_cliente},'${esc(v.nome_cliente_erp||'')}')"
              style="font-size:11px;padding:4px 8px;border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--red);background:var(--red-bg);cursor:pointer;font-weight:500">
              ✕ Remover
            </button>
          </div>
        </div>`).join('')}
      <p style="font-size:10px;color:var(--text-muted);margin-top:4px">
        💡 Pedidos e datas consideram o mais recente entre todos os ERP vinculados
      </p>
    </div>` : ''}

    ${S.finAlerta ? `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#FEF2F2;border:1.5px solid #FCA5A5;border-radius:var(--radius-sm);margin-bottom:2px">
      <span style="font-size:18px">⚠️</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:#DC2626">Pendência Financeira</div>
        <div style="font-size:11px;color:#991B1B;margin-top:1px">
          ${S.finAlerta.qtd} título${S.finAlerta.qtd>1?'s':''} em aberto · ${fmt(S.finAlerta.total)} · maior atraso: ${S.finAlerta.maxAtraso}d
        </div>
      </div>
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
      ${S.telefones.map(t=>{
        const umbl = S.umblerTelMap?.get(t.telefone);
        return `<div class="phone-card">
          <div class="ph-info">
            <span class="ph-num">${fmtP(t.telefone)}</span>
            ${t.nome_contato?`<span class="ph-name">${t.nome_contato}${t.cargo?' · '+t.cargo:''}</span>`:''}
            ${t.descricao&&!t.nome_contato?`<span class="ph-name" style="color:var(--text-muted)">(${t.descricao})</span>`:''}
            ${t.principal?'<span class="ph-princ">Principal</span>':''}
            ${umbl?`<span style="font-size:10px;color:var(--blue-mid);font-weight:600">💬 Umbler · ${sN(umbl.nome_atendente)} · ${fmtD(umbl.ultimo_contato)}</span>`:''}
          </div>
          <div class="ph-acts">

            <button class="ph-del" title="Remover" onclick="delPhone('${t.id}')">✕</button>
          </div>
        </div>`;
      }).join('')||'<p style="color:#475569;font-size:12px">Nenhum telefone</p>'}
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
              <div style="display:flex;gap:4px;align-items:center">
                ${!n.resolvido && n.tipo==='TAREFA' && !n.reagendado ? `<button style="font-size:10px;padding:2px 7px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--surface2);color:var(--text-secondary);cursor:pointer" onclick="reagendarNotaDrawer('${n.id}','${n.data_prevista||''}',${n.qtd_reagendamentos||0})">↻</button>` : ''}
                ${!n.resolvido?`<button class="btn-res" onclick="resolverNotaDrawer('${n.id}',${c.id_cliente},'${esc(c.nome_cliente)}',${c.id_vendedor_responsavel||'null'})">✓ Resolver</button>`:'<span style="font-size:10px;color:#334155">Resolvido</span>'}
              </div>
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

  // Buscar email do usuário logado
  const sess = (await window.sb.auth.getSession()).data.session;
  const emailLogado = sess?.user?.email || '';
  const cfgUsuario = emailLogado ? await sbQ('atac_config_usuario', `select=*&email=eq.${encodeURIComponent(emailLogado)}`) : [];
  const cfgUser = Array.isArray(cfgUsuario) && cfgUsuario.length ? cfgUsuario[0] : null;

  el.innerHTML=`<div style="max-width:680px">

    <!-- Meu Perfil -->
    <div class="cfg-section">
      <h3>👤 Meu Perfil</h3>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">
        Vincule seu login ao seu vendedor. O CRM abrirá automaticamente filtrado no seu nome.
      </p>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px">Login (e-mail)</label>
          <input type="text" value="${emailLogado}" disabled
            style="width:100%;padding:7px 10px;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text-muted);font-size:12px;box-sizing:border-box">
        </div>
        <div style="flex:1;min-width:200px">
          <label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px">Meu Vendedor</label>
          <select id="cfg-meu-vendedor"
            style="width:100%;padding:7px 10px;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;box-sizing:border-box">
            <option value="">-- Não vincular --</option>
            ${S.vendedores.map(v=>`<option value="${v.id_vendedor}"${cfgUser?.id_vendedor_erp===v.id_vendedor?' selected':''}>${v.nome_vendedor}</option>`).join('')}
          </select>
        </div>
        <div style="padding-top:18px">
          <button onclick="salvarCfgUsuario('${emailLogado}')"
            style="padding:7px 16px;background:var(--blue-dark);color:#fff;border:none;border-radius:var(--radius-sm);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
            Salvar
          </button>
        </div>
      </div>
      ${cfgUser ? `<p style="font-size:11px;color:var(--green);margin-top:8px">✓ Perfil vinculado — CRM abre filtrado em <strong>${cfgUser.nome_vendedor}</strong></p>` : `<p style="font-size:11px;color:var(--text-muted);margin-top:8px">Sem vínculo — CRM abre com filtro "Todos"</p>`}
    </div>

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
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Relaciona o ID do membro Umbler ao vendedor do ERP. O <strong>ID Membro</strong> é crítico — a Edge Function usa ele para resolver o atendente.</p>

      <!-- Vendedores SEM vínculo configurado — alerta -->
      ${(()=>{
        const vendSemVinc = S.vendedores.filter(v => !uvRows.some(r => r.id_vendedor_erp === v.id_vendedor));
        return vendSemVinc.length ? `
          <div style="background:var(--orange-bg);border:1px solid rgba(224,123,0,.2);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:12px">
            <p style="font-size:11px;font-weight:700;color:var(--orange);margin-bottom:6px">⚠ Vendedores sem vínculo Umbler:</p>
            ${vendSemVinc.map(v=>`
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px;color:var(--text-primary)">${v.nome_vendedor}</span>
                <button onclick="newUVforVend(${v.id_vendedor},'${esc(v.nome_vendedor)}')"
                  style="font-size:11px;font-weight:600;padding:3px 10px;background:var(--blue-dark);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer">
                  + Configurar
                </button>
              </div>`).join('')}
          </div>` : '';
      })()}

      <div id="uv-list" style="display:flex;flex-direction:column;gap:6px">
        ${uvRows.length ? uvRows.map(r=>`
          <div class="uv-row" style="flex-direction:column;align-items:flex-start;gap:6px">
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
              <div>
                <div class="uv-vname">${r.nome_vendedor_erp||'Vendedor #'+r.id_vendedor_erp}</div>
                <div class="uv-umbler" style="display:flex;gap:10px;flex-wrap:wrap">
                  <span>Usuário: <strong>${r.usuario_umbler||'—'}</strong></span>
                  ${r.id_membro_umbler?`<span style="font-family:'DM Mono',monospace;color:var(--text-muted)">ID: ${r.id_membro_umbler}</span>`:'<span style="color:var(--red);font-weight:600">⚠ ID Membro não configurado</span>'}
                  ${r.inbox_umbler?`<span style="color:var(--text-muted)">Inbox: ${r.inbox_umbler}</span>`:''}
                  <span style="${r.ativo?'color:var(--green)':'color:var(--text-muted)'}">${r.ativo?'● Ativo':'○ Inativo'}</span>
                </div>
              </div>
              <div class="uv-acts">
                <button class="btn-sm" onclick="editUV('${r.id}','${esc(r.usuario_umbler||'')}',${r.id_vendedor_erp||0},'${esc(r.id_membro_umbler||'')}','${esc(r.inbox_umbler||'')}',${r.ativo!==false})">✎ Editar</button>
                <button class="btn-sm danger" onclick="delUV('${r.id}')">✕</button>
              </div>
            </div>
          </div>`).join('')
        : '<p style="color:var(--text-muted);font-size:12px;padding:8px 0">Nenhum vínculo cadastrado</p>'}
      </div>
      <button class="btn-sm" style="margin-top:10px;border-color:var(--blue-mid);color:var(--blue-mid)" onclick="newUV()">+ Novo Vínculo</button>
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

async function salvarCfgUsuario(email) {
  const sel = document.getElementById('cfg-meu-vendedor');
  if (!sel) return;
  const idVend = Number(sel.value);
  if (!idVend) {
    await sbDel('atac_config_usuario','email',email);
    toast('Vínculo removido — CRM abrirá sem filtro');
    renderConfig();
    return;
  }
  const nomeVend = S.vendedores.find(v=>v.id_vendedor===idVend)?.nome_vendedor||'';
  await sbUpsert('atac_config_usuario',
    {email, id_vendedor_erp:idVend, nome_vendedor:nomeVend, atualizado_em:new Date().toISOString()},
    'email');
  const f = document.getElementById('f-vend');
  if (f) { f.value = String(idVend); onVendChange(String(idVend)); }
  toast('✅ Perfil salvo — CRM filtrado em ' + nomeVend);
  renderConfig();
}

// vínculos umbler-vendedor
function newUV(){openUV(null,'',null,'','',true);}
function newUVforVend(vendId, vendNome){openUV(null,'',vendId,'','',true);}
function editUV(id,umbler,vendId,idMembro,inbox,ativo){openUV(id,umbler,vendId,idMembro,inbox,ativo);}
function openUV(id,umbler,vendId,idMembro,inbox,ativo){
  const m=document.getElementById('modal-uv');if(!m)return;
  m.dataset.uvid=id||'';
  document.getElementById('uv-umbler').value=umbler||'';
  document.getElementById('uv-title').textContent=id?'Editar Vínculo Umbler':'Novo Vínculo Umbler → Vendedor';
  const idMEl=document.getElementById('uv-id-membro'); if(idMEl) idMEl.value=idMembro||'';
  const inboxEl=document.getElementById('uv-inbox'); if(inboxEl) inboxEl.value=inbox||'';
  const ativoEl=document.getElementById('uv-ativo'); if(ativoEl) ativoEl.checked=ativo!==false;
  const sel=document.getElementById('uv-vend');
  sel.innerHTML='<option value="">Selecione...</option>'+S.vendedores.map(v=>`<option value="${v.id_vendedor}"${v.id_vendedor===vendId?' selected':''}>${v.nome_vendedor}</option>`).join('');
  m.classList.add('open');
}
function closeUV(){document.getElementById('modal-uv')?.classList.remove('open');}
async function saveUV(){
  const id = document.getElementById('modal-uv').dataset.uvid;
  const umbler = document.getElementById('uv-umbler').value.trim();
  const idMembro = document.getElementById('uv-id-membro')?.value?.trim() || null;
  const inboxUmbler = document.getElementById('uv-inbox')?.value?.trim() || null;
  const ativo = document.getElementById('uv-ativo')?.checked !== false;
  const vendId = Number(document.getElementById('uv-vend').value);
  if (!umbler || !vendId) { toast('Preencha usuário e vendedor','err'); return; }
  const vendNome = S.vendedores.find(v=>v.id_vendedor===vendId)?.nome_vendedor||'';
  const payload = { usuario_umbler:umbler, id_vendedor_erp:vendId, nome_vendedor_erp:vendNome,
    id_membro_umbler: idMembro, inbox_umbler: inboxUmbler, ativo };
  if (id && id.length > 0) {
    await sbUpdate('atac_umbler_vendedor','id',id, payload);
  } else {
    await sbInsert('atac_umbler_vendedor', payload);
  }
  toast('Vínculo salvo!');
  closeUV();
  await loadUmblerVendMap();
  renderConfig();
}
async function delUV(id){
  if(!confirm('Remover vínculo Umbler?'))return;
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
  await Promise.all([loadOverdue(), renderAlertasCRM()]);
  if(S.selId){await loadDetalhe(S.selId);renderDrawer();}
  renderLista();
  if(S.mainTab==='agenda') renderAgendaCRM();
}

// Resolver nota a partir do drawer — abre modal próximo contato
async function resolverNotaDrawer(id, idCliente, nomeCliente, idVendedor) {
  await sbUpdate('atac_crm_notas','id',id,{resolvido:true,reagendado:false,data_resolucao:new Date().toISOString()});
  toast('✅ Resolvido!');
  await Promise.all([loadOverdue(), renderAlertasCRM()]);
  if(S.selId){await loadDetalhe(S.selId);renderDrawer();}
  renderLista();
  // Abrir modal próximo contato
  const m = document.getElementById('modal-proximo-contato');
  if (!m) return;
  m.dataset.idcliente = idCliente || '';
  m.dataset.nomecliente = nomeCliente || '';
  const dt = new Date();
  dt.setDate(dt.getDate() + 21);
  document.getElementById('pc-data').value = dt.toISOString().split('T')[0];
  document.getElementById('pc-texto').value = '';
  document.getElementById('pc-nome').textContent = nomeCliente || '';
  // Pré-selecionar vendedor do cliente
  const sel = document.getElementById('pc-vend');
  if(sel) {
    sel.innerHTML = '<option value="">Sem vendedor</option>' +
      S.vendedores.map(v=>`<option value="${v.id_vendedor}"${v.id_vendedor===idVendedor?' selected':''}>${v.nome_vendedor}</option>`).join('');
  }
  m.classList.add('open');
}

// Reagendar nota a partir do drawer
function reagendarNotaDrawer(id, dataAtual, qtdReag) {
  const m = document.getElementById('modal-reagendar');
  if (!m) return;
  m.dataset.notaid = id;
  m.dataset.qtdreag = qtdReag;
  // Usar vendedor vinculado ao cliente atual
  m.dataset.idvendedor = S.selCliente?.id_vendedor_responsavel || '';
  const dt = new Date((dataAtual || new Date().toISOString().split('T')[0]) + 'T12:00:00');
  dt.setDate(dt.getDate() + 7);
  document.getElementById('reag-data').value = dt.toISOString().split('T')[0];
  m.classList.add('open');
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

// Abre modal de vincular com cliente do ERP pré-sugerido
async function abrirVincComSugestao(tel, nome, atend, erpId, erpNome) {
  const m = document.getElementById('modal-vinc');
  if (!m) return;
  m.dataset.tel = tel;
  m.dataset.nome = nome;
  m.dataset.atend = atend || '';
  m.dataset.extra = '';
  m.classList.add('open');

  // Pré-popular busca com nome do cliente sugerido
  const input = document.getElementById('vinc-search');
  if (input) input.value = erpNome;

  // Mostrar diretamente o cliente sugerido nos resultados
  const el = document.getElementById('vinc-results');
  if (el) {
    el.innerHTML = `
      <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:11px;color:var(--blue-mid)">
        🔗 Sugestão baseada no telefone — confirme se é o cliente correto
      </div>
      <button class="mres-btn" onclick="confirmarVinc(${erpId},'${esc(erpNome)}')" style="border-color:rgba(59,130,246,.3)">
        <div class="mres-nome">${erpNome}</div>
        <div class="mres-meta">Cód. ERP #${erpId}</div>
      </button>
      <button onclick="document.getElementById('vinc-search').value='';document.getElementById('vinc-results').innerHTML='<p class=\"empty-msg\">Digite para buscar outro cliente...</p>'"
        style="width:100%;margin-top:6px;padding:6px;font-size:11px;color:var(--text-muted);background:transparent;border:1px dashed var(--border);border-radius:6px;cursor:pointer">
        Não é esse — buscar outro
      </button>`;
  }
}
async function searchVinc(){
  const q=document.getElementById('vinc-search')?.value?.trim();
  if(!q||q.length<2)return;
  const el=document.getElementById('vinc-results');if(!el)return;
  el.innerHTML='<p class="empty-msg">Buscando...</p>';

  const qNum = isNaN(q) ? 0 : parseInt(q);
  const qCnpj = q.replace(/\D/g,'');

  // Buscar em vw_dim_cliente (todos os clientes do ERP)
  let params = `select=id_cliente,nome_cliente,cnpj,cidade,uf&limit=15`;
  if (qNum > 0) {
    params += `&or=(nome_cliente.ilike.*${encodeURIComponent(q)}*,id_cliente.eq.${qNum})`;
  } else if (qCnpj.length >= 8) {
    params += `&or=(nome_cliente.ilike.*${encodeURIComponent(q)}*,cnpj.ilike.*${qCnpj}*)`;
  } else {
    params += `&nome_cliente=ilike.*${encodeURIComponent(q)}*`;
  }

  const d = await sbQ('vw_dim_cliente', params);
  const res = Array.isArray(d) ? d : [];
  el.innerHTML = res.length
    ? res.map(c=>`<button class="mres-btn" onclick="confirmarVinc(${c.id_cliente},'${esc(c.nome_cliente)}')">
        <div class="mres-nome">${c.nome_cliente}</div>
        ${(c.cnpj||c.cidade)?`<div class="mres-meta">${c.cnpj?fmtC(c.cnpj)+' · ':''}${c.cidade||''}${c.uf?' - '+c.uf:''}</div>`:''}
      </button>`).join('')
    : '<p class="empty-msg">Nenhum cliente encontrado</p>';
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
  const el = document.getElementById('erp-results');
  if (!el) return;
  // Aviso de múltiplos vínculos
  const jaVinc = S.vinculosERP.length;
  el.innerHTML = `<p style="padding:8px;font-size:11px;color:var(--text-muted);border-bottom:1px solid var(--border);margin-bottom:6px">
    ${jaVinc > 0 ? `<strong>${jaVinc} código${jaVinc>1?'s':''} ERP já vinculado${jaVinc>1?'s':''}</strong> — pode adicionar mais. Pedidos serão agregados.` : 'Buscando...'}
  </p>`;

  // Busca em vw_dim_cliente (todos os clientes do ERP)
  const qNum = isNaN(q) ? 0 : parseInt(q);
  const qCnpj = q.replace(/\D/g,'');

  // Monta query OR correta para o Supabase
  let params = `select=id_cliente,nome_cliente,cnpj,cidade,uf&limit=20`;
  if (qNum > 0) {
    params += `&or=(nome_cliente.ilike.*${encodeURIComponent(q)}*,id_cliente.eq.${qNum})`;
  } else if (qCnpj.length >= 8) {
    params += `&or=(nome_cliente.ilike.*${encodeURIComponent(q)}*,cnpj.ilike.*${qCnpj}*)`;
  } else {
    params += `&nome_cliente=ilike.*${encodeURIComponent(q)}*`;
  }

  const data = await sbQ('vw_dim_cliente', params);
  const res = Array.isArray(data) ? data : [];

  if (!res.length) {
    el.innerHTML = '<p class="empty-msg">Nenhum cliente encontrado</p>';
    return;
  }

  const vincAtual = new Set(S.vinculosERP.map(v => v.id_cliente_erp));
  el.innerHTML = res.map(c => `
    <button onclick="confirmarVincERP(${c.id_cliente},'${esc(c.nome_cliente||'')}','${esc(c.cnpj||'')}')"
      ${vincAtual.has(c.id_cliente) ? 'disabled style="opacity:.5;cursor:default"' : ''}
      class="mres-btn" style="margin-bottom:4px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div class="mres-nome" style="flex:1">${c.nome_cliente||'—'}</div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          ${vincAtual.has(c.id_cliente) ? '<span style="font-size:10px;color:var(--green);font-weight:600">✓ Já vinculado</span>' : ''}
          <span style="font-size:11px;color:var(--text-muted)">#${c.id_cliente}</span>
        </div>
      </div>
      ${(c.cnpj||c.cidade) ? `<div class="mres-meta">${c.cnpj ? fmtC(c.cnpj)+' · ' : ''}${c.cidade||''}${c.uf ? ' - '+c.uf : ''}</div>` : ''}
    </button>`).join('');
}

async function confirmarVincERP(erpId, erpNome, cnpj) {
  const m = document.getElementById('modal-vinc-erp');
  if (!m) return;
  const crmId = Number(m.dataset.crmid);
  const crmNome = m.dataset.crmnome;

  // Verificar se já existe este ERP vinculado
  if (S.vinculosERP.some(v => Number(v.id_cliente_erp) === Number(erpId))) {
    toast('Este código ERP já está vinculado!', 'err'); return;
  }

  // Mostrar loading no modal
  const res = document.getElementById('erp-results');
  if (res) res.innerHTML = '<p class="empty-msg"><span class="spin">⟳</span> Vinculando...</p>';

  try {
    // 1. Salvar vínculo em atac_cliente_vinculos
    // Schema: id_cliente_crm, id_cliente_erp, nome_cliente_erp, cnpj_cpf_erp, vinculado_em, vinculado_por
    const rVinc = await sbInsert('atac_cliente_vinculos', {
      id_cliente_crm: crmId,
      id_cliente_erp: erpId,
      nome_cliente_erp: erpNome,
      cnpj_cpf_erp: cnpj || null,
      vinculado_por: 'CRM_MANUAL',
    });

    if (!rVinc.ok) {
      const err = await rVinc.text();
      // Pode ser conflito único — verificar
      if (err.includes('duplicate') || err.includes('unique')) {
        toast('Já vinculado (registro existente)', 'err');
      } else {
        toast(`Erro ao vincular: ${err.substring(0,80)}`, 'err');
      }
      if (res) res.innerHTML = '<p class="empty-msg">Digite para buscar...</p>';
      return;
    }

    // 2. Verificar última compra do ERP novo vinculado
    const lastPed = await sbQ('vw_comercial_docs_faturados',
      `select=data_faturamento,id_vendedor,nome_vendedor&tipo_saida=eq.DISTRIBUICAO&id_cliente=eq.${erpId}&order=data_faturamento.desc&limit=1`);
    const lp = Array.isArray(lastPed) ? lastPed[0] : null;
    const diasUlt = lp?.data_faturamento ? dias(lp.data_faturamento) : 9999;
    const isCarteira = diasUlt <= CFG.compra_risco_dias && lp;

    // 3. Comparar com compras dos outros vínculos já existentes
    // Se este ERP novo tem compra mais recente → atualizar vendedor responsável
    if (isCarteira && lp.id_vendedor && S.vinculosERP.length === 0) {
      // Primeiro vínculo ERP — atribuir vendedor da última venda
      await sbUpsert('atac_cliente_vendedor', {
        id_cliente: crmId,
        nome_cliente: crmNome,
        id_vendedor_responsavel: lp.id_vendedor,
        nome_vendedor_responsavel: lp.nome_vendedor,
        atualizado_por: 'VINCULO_ERP',
      }, 'id_cliente');
    }

    fecharVincularERP();

    const msg = isCarteira
      ? `✅ ${erpNome} (#${erpId}) vinculado — última compra há ${diasUlt}d`
      : `✅ ${erpNome} (#${erpId}) vinculado — sem compras recentes`;
    toast(msg);

  } catch(e) {
    toast('Erro inesperado: ' + e.message, 'err');
    if (res) res.innerHTML = '<p class="empty-msg">Erro — tente novamente</p>';
    return;
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


// ── EDITAR VÍNCULO ERP ────────────────────────────────────────
function editarVincERP(vincId, nomeAtual, cnpjAtual, crmId) {
  const m = document.getElementById('modal-edit-vinc-erp');
  if (!m) return;
  m.dataset.vincid = vincId;
  m.dataset.crmid = crmId;
  document.getElementById('ev-nome').value = nomeAtual || '';
  document.getElementById('ev-cnpj').value = cnpjAtual || '';
  m.classList.add('open');
}
function fecharEditVincERP() { document.getElementById('modal-edit-vinc-erp')?.classList.remove('open'); }

async function salvarEditVincERP() {
  const m = document.getElementById('modal-edit-vinc-erp');
  if (!m) return;
  const vincId = m.dataset.vincid;
  const crmId = Number(m.dataset.crmid);
  const nome = document.getElementById('ev-nome').value.trim();
  const cnpj = document.getElementById('ev-cnpj').value.trim();
  if (!nome) { toast('Nome obrigatório', 'err'); return; }
  const r = await sbUpdate('atac_cliente_vinculos', 'id', vincId, {
    nome_cliente_erp: nome.toUpperCase(),
    cnpj_cpf_erp: cnpj || null
  });
  if (!r.ok) { toast('Erro ao salvar', 'err'); return; }
  toast('Vínculo atualizado!');
  fecharEditVincERP();
  await loadDetalhe(crmId);
  renderDrawer();
}

// ── EDITAR CLIENTE CRM ────────────────────────────────────────
function abrirEditarCliente(cId, cNome) {
  const m = document.getElementById('modal-edit-cliente');
  if (!m) return;
  m.dataset.cid = cId;
  const c = S.selCliente;
  const dim = S.dimMap.get(cId) || {};
  document.getElementById('ec-nome').value = c?.nome_cliente || cNome || '';
  document.getElementById('ec-cidade').value = dim.cidade || c?.cidade || '';
  document.getElementById('ec-uf').value = dim.uf || c?.uf || '';
  document.getElementById('ec-cnpj').value = dim.cnpj_cpf || c?.cnpj_cpf || '';
  document.getElementById('ec-email').value = dim.email || c?.email || '';
  m.classList.add('open');
}
function fecharEditarCliente() { document.getElementById('modal-edit-cliente')?.classList.remove('open'); }

async function salvarEditarCliente() {
  const m = document.getElementById('modal-edit-cliente');
  if (!m) return;
  const cId = Number(m.dataset.cid);
  const nome = document.getElementById('ec-nome').value.trim();
  const cidade = document.getElementById('ec-cidade').value.trim();
  const uf = document.getElementById('ec-uf').value.trim().toUpperCase();
  const cnpj = document.getElementById('ec-cnpj').value.trim();
  const email = document.getElementById('ec-email').value.trim();
  if (!nome) { toast('Nome obrigatório', 'err'); return; }
  const r = await sbUpdate('atac_clientes', 'id_cliente', cId, {
    nome_cliente: nome.toUpperCase(),
    cidade: cidade || null,
    uf: uf || null,
    cnpj_cpf: cnpj || null,
    email: email || null,
    atualizado_em: new Date().toISOString()
  });
  if (!r.ok) { toast('Erro ao salvar', 'err'); return; }
  // Atualiza dimMap local
  const dim = S.dimMap.get(cId) || {};
  S.dimMap.set(cId, { ...dim, cidade, uf, cnpj_cpf: cnpj, email });
  if (S.selCliente) S.selCliente.nome_cliente = nome.toUpperCase();
  toast('Cliente atualizado!');
  fecharEditarCliente();
  await loadDetalhe(cId);
  renderDrawer();
  await Promise.all([loadCarteira(), loadProspeccao()]);
  renderLista();
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
  S.search = v;
  // Se está na agenda, muda para carteira sem resetar a busca
  if (S.mainTab === 'agenda') {
    S.mainTab = 'carteira';
    document.getElementById('tab-c')?.classList.add('on');
    document.getElementById('tab-a')?.classList.remove('on');
    const crmWrap = document.getElementById('crm-inner-wrap');
    const agPanel = document.getElementById('crm-agenda-panel');
    if (crmWrap) crmWrap.style.display = 'flex';
    if (agPanel) agPanel.style.display = 'none';
  }

  // Com texto: buscar no Supabase diretamente (não depende da lista local)
  if (v.trim().length >= 2) {
    buscarNoSupabase(v.trim());
  } else {
    // Sem texto: volta para a lista local completa
    renderLista();
  }
}

// Busca diretamente no Supabase — elimina dependência do S.carteira local
async function buscarNoSupabase(q) {
  const el = document.getElementById('cl-list');
  if (!el) return;
  el.innerHTML = '<div class="empty-msg" style="padding:16px"><div class="spinner" style="margin:0 auto 8px"></div>Buscando...</div>';

  const qEnc = encodeURIComponent(q);
  const tab = S.mainTab === 'carteira' ? 'carteira' : (S.prospTab === 'geral' ? 'geral' : 'prosp');
  
  let params;
  if (tab === 'geral') {
    params = `select=*&status_crm=eq.PROSPECCAO&id_vendedor_responsavel=is.null&nome_cliente=ilike.*${qEnc}*&order=dias_sem_compra.desc.nullslast&limit=50`;
  } else if (tab === 'prosp') {
    params = `select=*&status_crm=eq.PROSPECCAO&id_vendedor_responsavel=not.is.null&nome_cliente=ilike.*${qEnc}*&order=dias_sem_interacao.desc.nullslast&limit=50`;
    if (F.vendedorId) params += `&id_vendedor_responsavel=eq.${F.vendedorId}`;
  } else {
    // Carteira: busca sem filtro de status para pegar todos
    params = `select=*&nome_cliente=ilike.*${qEnc}*&order=dias_sem_interacao.desc.nullslast&limit=50`;
    if (F.vendedorId) params += `&id_vendedor_responsavel=eq.${F.vendedorId}`;
  }

  const data = await sbQ('atac_crm_clientes', params);
  let results = Array.isArray(data) ? data : [];

  // Filtrar carteira vs prospecção nos resultados (e excluir CPFs)
  // CPF já filtrado na view atac_crm_clientes
  if (tab === 'carteira') {
    results = results.filter(c => getStatus(c) !== 'PROSPECCAO');
    // Aplicar subfiltro
    if (S.subFilter !== 'todos') {
      results = results.filter(c => {
        const st = getStatus(c);
        if (S.subFilter === 'ativo')    return st === 'ATIVO';
        if (S.subFilter === 'atencao')  return st === 'ATENCAO';
        if (S.subFilter === 'em_risco') return st === 'PERDIDO';
        return true;
      });
    }
  }

  if (!results.length) {
    el.innerHTML = `<div class="empty-msg">Nenhum cliente encontrado para "<strong>${q}</strong>"</div>`;
    return;
  }

  // Renderizar igual ao renderLista mas com esses resultados
  el.innerHTML = results.map(c => {
    const st = getStatus(c);
    const dim = S.dimMap.get(c.id_cliente) || {};
    const sel = S.selId === c.id_cliente;
    const dc = c.dias_sem_compra ?? dias(c.ultima_compra);
    return `<button class="cl-item${sel?' sel':''}" onclick="selCliente(${c.id_cliente})">
      <div class="cl-row1">
        <span class="cl-nome">${c.nome_cliente}</span>
        ${bdg(st)}
        ${dc>=30?'<span style="color:var(--orange);font-size:12px;flex-shrink:0">⚠</span>':''}
        ${S.overdueIds.has(c.id_cliente)?'<span style="color:var(--red);font-size:12px;flex-shrink:0">🔔</span>':''}
      </div>
      ${semaforo(c)}
      <div class="cl-row2">${sN(c.nome_vendedor_responsavel)}</div>
      <div class="cl-row3">
        <span class="cl-row3-l">${dim.cidade?dim.cidade+(dim.uf?' - '+dim.uf:'')+'  ':''}Últ: ${c.ultima_compra?fmtD(c.ultima_compra):'—'}</span>
        ${(dim.cnpj_cpf||c.cnpj_cpf)?`<span class="cl-cnpj">${fmtC(dim.cnpj_cpf||c.cnpj_cpf)}</span>`:''}
      </div>
    </button>`;
  }).join('');
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
    // 1. Verificar se CNPJ já existe no ERP antes de criar
    let erpMatch = null;
    if (cnpj) {
      const cnpjDigits = cnpj.replace(/\D/g,'');
      const erpBusca = await sbQ('vw_dim_cliente',
        `select=id_cliente,nome_cliente&cnpj=ilike.*${cnpjDigits}*&limit=1`);
      if (Array.isArray(erpBusca) && erpBusca.length > 0) {
        erpMatch = erpBusca[0];
      }
    }

    let newId;
    if (erpMatch) {
      // CNPJ já existe no ERP — usar o ID do ERP diretamente
      newId = erpMatch.id_cliente;
      // Garantir que está na atac_clientes
      const jaExiste = await sbQ('atac_clientes', `select=id_cliente&id_cliente=eq.${newId}`);
      if (!Array.isArray(jaExiste) || jaExiste.length === 0) {
        await sbInsert('atac_clientes', {
          id_cliente: newId, nome_cliente: erpMatch.nome_cliente,
          cnpj_cpf: cnpj||null, situacao: 'A', origem: 'UMBLER',
          nao_comercial: false, criado_em: new Date().toISOString()
        });
      }
      toast(`🔗 CNPJ encontrado no ERP — vinculando ao cliente ${erpMatch.nome_cliente}`);
    } else {
      // Novo cliente — gerar ID sequencial a partir de 1000 (clientes CRM)
      const maxRes = await sbQ('atac_clientes', 'select=id_cliente&id_cliente=gte.1000&order=id_cliente.desc&limit=1');
      const maxId = Array.isArray(maxRes) && maxRes.length ? maxRes[0].id_cliente : 1000;
      newId = maxId + 1;
      await sbInsert('atac_clientes', {
        id_cliente: newId, nome_cliente: nome.toUpperCase(),
        cnpj_cpf: cnpj||null, cidade: cidade||null, uf: uf||null,
        situacao: 'A', origem: 'UMBLER', nao_comercial: false,
        criado_em: new Date().toISOString()
      });
    }

    // 2. Vincular telefone
    const telExiste = await sbQ('atac_cliente_telefones', `select=id&id_cliente=eq.${newId}&telefone=eq.${tel}`);
    if (!Array.isArray(telExiste) || telExiste.length === 0) {
      await sbInsert('atac_cliente_telefones', {
        id_cliente: newId, nome_cliente: nome,
        telefone: tel, descricao: 'Umbler', principal: true
      });
    }

    // 3. Vincular vendedor
    if (vendId) {
      const vend = S.vendedores.find(v => v.id_vendedor === Number(vendId));
      await sbUpsert('atac_cliente_vendedor', {
        id_cliente: newId, nome_cliente: nome,
        id_vendedor_responsavel: Number(vendId),
        nome_vendedor_responsavel: vend?.nome_vendedor || '',
        atualizado_por: 'UMBLER'
      }, 'id_cliente');
    }

    if (!erpMatch) toast(`✅ ${nome} criado na ${vendId ? 'Prospecção do Vendedor' : 'Prospecção Geral'}`);
    fecharNovoContato();
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
// Modal de confirmação para descartar
function confirmarDescartar(id, nome) {
  return new Promise(resolve => {
    const m = document.getElementById('modal-confirmar-descartar');
    if (!m) { resolve(false); return; }
    m.dataset.clienteid = id;
    document.getElementById('cd-nome').textContent = nome;
    document.getElementById('cd-motivo').value = '';
    // Botão confirmar
    document.getElementById('cd-btn-ok').onclick = () => {
      const motivo = document.getElementById('cd-motivo').value.trim();
      if (!motivo) { toast('Informe o motivo', 'err'); return; }
      S._descartarMotivo = motivo;
      m.classList.remove('open');
      resolve(true);
    };
    document.getElementById('cd-btn-cancel').onclick = () => {
      m.classList.remove('open');
      resolve(false);
    };
    m.classList.add('open');
  });
}

async function descartarCliente(id, nome) {
  // Usar modal de confirmação em vez de prompt nativo
  const confirmado = await confirmarDescartar(id, nome);
  if (!confirmado) return;
  const motivo = S._descartarMotivo || '';

  // Verifica se cliente já existe na atac_clientes
  const existe = await sbQ('atac_clientes', `select=id_cliente&id_cliente=eq.${id}`);
  if (Array.isArray(existe) && existe.length > 0) {
    await sbUpdate('atac_clientes', 'id_cliente', id, {
      situacao: 'I', nao_comercial: true, atualizado_em: new Date().toISOString()
    });
  } else {
    await sbInsert('atac_clientes', {
      id_cliente: id, nome_cliente: nome, situacao: 'I',
      nao_comercial: true, origem: 'DESCARTADO', criado_em: new Date().toISOString()
    });
  }
  // Remove vínculo de vendedor se houver
  await sbDel('atac_cliente_vendedor', 'id_cliente', id);
  toast(`${nome} descartado`);
  // Remove da lista local imediatamente
  S.prospeccao = S.prospeccao.filter(c => c.id_cliente !== id);
  S.prospGeral = S.prospGeral.filter(c => c.id_cliente !== id);
  renderLista();
  loadProspeccao();
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

const AG = {
  ano: new Date().getFullYear(),
  mes: new Date().getMonth(),
  diaSel: null,
  tarefas: [],
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
  let params = `select=id,tipo,id_cliente,nome_cliente,texto,data_prevista,criado_por,nome_vendedor_responsavel,resolvido,reagendado,qtd_reagendamentos&data_prevista=gte.${inicio}&data_prevista=lte.${fim}&order=data_prevista.asc`;
  if (F.vendedorId) params += `&id_vendedor_responsavel=eq.${F.vendedorId}`;
  const d = await sbQ('atac_crm_notas', params);
  AG.tarefas = Array.isArray(d) ? d : [];
}

function drawAgenda(el) {
  const hoje = new Date();
  const primeiroDia = new Date(AG.ano, AG.mes, 1);
  const diasNoMes   = new Date(AG.ano, AG.mes+1, 0).getDate();
  const inicioSem   = primeiroDia.getDay();
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DS = ['D','S','T','Q','Q','S','S'];

  const porDia = new Map();
  AG.tarefas.forEach(t => {
    if (!t.data_prevista) return;
    const d = t.data_prevista.substring(0,10);
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d).push(t);
  });

  if (!AG.diaSel) {
    AG.diaSel = (hoje.getFullYear()===AG.ano && hoje.getMonth()===AG.mes)
      ? hoje.toISOString().split('T')[0]
      : `${AG.ano}-${String(AG.mes+1).padStart(2,'0')}-01`;
  }

  const vendNome = F.vendedorId ? sN(S.vendedores.find(v=>v.id_vendedor===F.vendedorId)?.nome_vendedor||'') : 'Todos';
  const vencidas = AG.tarefas.filter(t=>!t.resolvido && !t.reagendado && t.data_prevista < hoje.toISOString().split('T')[0]).length;
  const deHoje   = AG.tarefas.filter(t=>!t.resolvido && !t.reagendado && t.data_prevista === hoje.toISOString().split('T')[0]).length;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden">
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0;display:flex;align-items:center;gap:10px">
        <button onclick="setMainTab('carteira')" style="font-size:11px;font-weight:600;color:var(--blue-mid);background:var(--blue-pale);border:1.5px solid rgba(0,119,204,.2);border-radius:var(--radius-sm);padding:4px 10px;cursor:pointer">← CRM</button>
        <div style="display:flex;align-items:center;gap:6px">
          <button onclick="navMes(-1)" style="width:24px;height:24px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center">‹</button>
          <span style="font-size:13px;font-weight:700;color:var(--text-primary);min-width:130px;text-align:center">${MESES[AG.mes]} ${AG.ano}</span>
          <button onclick="navMes(1)" style="width:24px;height:24px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center">›</button>
          <button onclick="navMes(0)" style="font-size:10px;font-weight:600;color:var(--text-muted);background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:3px 8px;cursor:pointer">Hoje</button>
        </div>
        <span style="font-size:11px;color:var(--text-muted)">— ${vendNome}</span>
        <div style="margin-left:auto;display:flex;gap:6px">
          ${vencidas?`<span style="background:var(--red-bg);color:var(--red);padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700">⚠ ${vencidas}</span>`:''}
          ${deHoje?`<span style="background:var(--blue-pale);color:var(--blue-dark);padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700">🔴 ${deHoje} hoje</span>`:''}
        </div>
      </div>
      <div style="display:flex;flex:1;overflow:hidden">
        <div style="width:240px;flex-shrink:0;display:flex;flex-direction:column;padding:10px 8px;border-right:1px solid var(--border)">
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:2px">
            ${DS.map(d=>`<div style="text-align:center;font-size:9px;font-weight:700;color:var(--text-muted);padding:2px">${d}</div>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">
            ${Array.from({length: inicioSem}, ()=>'<div></div>').join('')}
            ${Array.from({length: diasNoMes}, (_,i)=>{
              const dia = i+1;
              const dStr = `${AG.ano}-${String(AG.mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
              const eHoje = hoje.getFullYear()===AG.ano && hoje.getMonth()===AG.mes && hoje.getDate()===dia;
              const eSel  = AG.diaSel === dStr;
              const tt = porDia.get(dStr) || [];
              const temVenc = tt.some(t=>!t.resolvido && !t.reagendado && dStr < hoje.toISOString().split('T')[0]);
              const temAtiv = tt.some(t=>!t.resolvido && !t.reagendado);
              let bg = eSel ? 'var(--blue-dark)' : 'transparent';
              let border = eHoje && !eSel ? '2px solid var(--blue-mid)' : '1px solid transparent';
              let txt = eSel ? '#fff' : 'var(--text-primary)';
              let dot = '';
              if (tt.length && !eSel) {
                const dc = temVenc ? 'var(--red)' : temAtiv ? 'var(--blue-mid)' : 'var(--green)';
                dot = `<div style="width:4px;height:4px;border-radius:50%;background:${dc};margin:0 auto"></div>`;
              }
              return `<button onclick="selDia('${dStr}')" style="background:${bg};border:${border};border-radius:4px;padding:2px 1px;cursor:pointer;display:flex;flex-direction:column;align-items:center;min-height:28px;gap:1px" onmouseover="if('${eSel}'!=='true')this.style.background='var(--surface2)'" onmouseout="if('${eSel}'!=='true')this.style.background='transparent'">
                <span style="font-size:11px;font-weight:${eHoje||eSel?700:400};color:${txt};line-height:1.4">${dia}</span>
                ${dot}
              </button>`;
            }).join('')}
          </div>
          <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:4px">
            <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text-muted)"><div style="width:6px;height:6px;border-radius:50%;background:var(--red)"></div>Atrasada</div>
            <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text-muted)"><div style="width:6px;height:6px;border-radius:50%;background:var(--blue-mid)"></div>Pendente</div>
            <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text-muted)"><div style="width:6px;height:6px;border-radius:50%;background:var(--green)"></div>Resolvida</div>
          </div>
        </div>
        <div id="agenda-dia-panel" style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--surface)"></div>
      </div>
    </div>`;

  renderDiaPanel();
}

function selDia(dStr) {
  AG.diaSel = dStr;
  const cals = document.getElementById('crm-agenda-panel');
  if (cals) {
    cals.querySelectorAll('button[onclick^="selDia"]').forEach(btn => {
      const d = btn.getAttribute('onclick').match(/'(.+)'/)?.[1];
      const isHoje = btn.style.border && btn.style.border.includes('2px');
      if (d === dStr) { btn.style.background='var(--blue-dark)'; btn.style.border='1px solid var(--blue-dark)'; }
      else if (isHoje) {}
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
  const hoje = new Date().toISOString().split('T')[0];
  const tarefas = AG.tarefas.filter(t => t.data_prevista === dStr);
  const pendentes = tarefas.filter(t => !t.resolvido && !t.reagendado);
  const [ano,mes,dia] = dStr.split('-').map(Number);
  const dLabel = `${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${ano}`;
  const eHoje = dStr === hoje;
  const ePassado = dStr < hoje;

  el.innerHTML = `
    <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <div>
        <p style="font-size:14px;font-weight:700;color:var(--text-primary)">${dLabel}${eHoje?' &nbsp;<span style=\\"color:var(--blue-mid);font-size:12px\\">Hoje</span>':''}</p>
        <p style="font-size:11px;color:var(--text-muted)">${tarefas.length} atividade${tarefas.length!==1?'s':''}${pendentes.length?' · '+pendentes.length+' pendente'+(pendentes.length>1?'s':''):''}</p>
      </div>
      <button onclick="abrirNovaAtividade('${dStr}')" style="font-size:12px;font-weight:700;padding:6px 14px;background:var(--blue-dark);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer">+ Nova</button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px">
      ${tarefas.length ? tarefas.map(t => {
        const isVenc = !t.resolvido && !t.reagendado && ePassado;
        const isReag = t.reagendado;
        const borderColor = t.resolvido ? 'var(--green)' : isReag ? '#64748b' : isVenc ? 'var(--red)' : 'var(--blue-mid)';
        const opacity = t.resolvido || isReag ? '0.55' : '1';
        return `<div style="background:var(--surface);border:1px solid var(--border);border-left:3px solid ${borderColor};border-radius:var(--radius-sm);padding:12px 14px;opacity:${opacity}">
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
                <span style="font-size:10px;font-weight:700;color:var(--blue-mid);background:var(--blue-pale);padding:1px 6px;border-radius:10px">TAREFA</span>
                ${isVenc?'<span style="font-size:10px;color:var(--red);font-weight:700;background:var(--red-bg);padding:1px 6px;border-radius:10px">Atrasada</span>':''}
                ${isReag?`<span style="font-size:10px;color:#64748b;font-weight:700;background:var(--surface2);padding:1px 6px;border-radius:10px">Reagendado${t.qtd_reagendamentos>1?' ('+t.qtd_reagendamentos+'x)':''}</span>`:''}
                ${t.resolvido?'<span style="font-size:10px;color:var(--green);font-weight:700">✓ Resolvida</span>':''}
              </div>
              <p style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;text-decoration:underline dotted" onclick="abrirClienteAgenda('${t.id_cliente}','${esc(t.nome_cliente)}')">${t.nome_cliente}</p>
              <p style="font-size:12px;color:var(--text-secondary);line-height:1.5">${t.texto||'—'}</p>
              ${t.criado_por?`<p style="font-size:10px;color:var(--text-muted);margin-top:4px">Por: ${t.criado_por}</p>`:''}
            </div>
            ${!t.resolvido && !t.reagendado ? `<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
              <button onclick="resolverNotaAgenda('${t.id}','${t.id_cliente}','${esc(t.nome_cliente)}')" style="font-size:11px;font-weight:700;padding:4px 10px;background:var(--green-bg);color:var(--green);border:1.5px solid rgba(15,157,110,.3);border-radius:var(--radius-sm);cursor:pointer;white-space:nowrap">✓ Resolver</button>
              <button onclick="reagendarNota('${t.id}','${t.data_prevista}',${t.qtd_reagendamentos||0})" style="font-size:11px;font-weight:600;padding:4px 10px;background:var(--surface2);color:var(--text-secondary);border:1.5px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;white-space:nowrap">↻ Reagendar</button>
            </div>` : ''}
          </div>
        </div>`;
      }).join('') : `<div style="text-align:center;padding:40px 16px;color:var(--text-muted)">
        <div style="font-size:32px;margin-bottom:10px">📅</div>
        <p style="font-size:13px;font-weight:500">Nenhuma atividade</p>
        <p style="font-size:11px;margin-top:4px">Clique em + Nova para adicionar</p>
      </div>`}
    </div>`;
}

function navMes(delta) {
  if (delta===0){const n=new Date();AG.ano=n.getFullYear();AG.mes=n.getMonth();AG.diaSel=null;}
  else{AG.mes+=delta;if(AG.mes<0){AG.mes=11;AG.ano--;}if(AG.mes>11){AG.mes=0;AG.ano++;}AG.diaSel=null;}
  renderAgendaCRM();
}

async function abrirClienteAgenda(idCliente, nomeCliente) {
  if (!idCliente) { toast('Cliente sem ID vinculado', 'err'); return; }
  const agPanel = document.getElementById('crm-agenda-panel');
  const innerWrap = document.getElementById('crm-inner-wrap');
  if (agPanel) agPanel.style.display = 'none';
  if (innerWrap) innerWrap.style.display = 'flex';
  document.getElementById('tab-a')?.classList.remove('on');
  document.getElementById('tab-c')?.classList.add('on');
  S.mainTab = 'carteira';
  await selCliente(Number(idCliente));
  setTimeout(() => {
    const drawer = document.getElementById('drawer');
    if (!drawer) return;
    const secTarefas = Array.from(drawer.querySelectorAll('.sec-lbl')).find(el =>
      el.textContent.includes('Tarefa') || el.textContent.includes('Nota')
    );
    if (secTarefas) secTarefas.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 500);
}

function reagendarNota(id, dataAtual, qtdReag) {
  const m = document.getElementById('modal-reagendar');
  if (!m) return;
  m.dataset.notaid = id;
  m.dataset.qtdreag = qtdReag;
  const dt = new Date(dataAtual + 'T12:00:00');
  dt.setDate(dt.getDate() + 7);
  document.getElementById('reag-data').value = dt.toISOString().split('T')[0];
  m.classList.add('open');
}
function fecharReagendar() { document.getElementById('modal-reagendar')?.classList.remove('open'); }

async function salvarReagendar() {
  const m = document.getElementById('modal-reagendar');
  if (!m) return;
  const id = m.dataset.notaid;
  const qtd = Number(m.dataset.qtdreag) + 1;
  const novaData = document.getElementById('reag-data').value;
  if (!novaData) { toast('Informe a nova data', 'err'); return; }
  await sbUpdate('atac_crm_notas', 'id', id, { data_prevista: novaData, reagendado: true, qtd_reagendamentos: qtd });
  toast('\u21bb Reagendado!');
  fecharReagendar();
  await loadTarefasMes();
  renderDiaPanel();
  renderAlertasCRM();
}

function abrirNovaAtividade(dataPrevista) {
  const m = document.getElementById('modal-nova-ativ');
  if (!m) return;
  m.dataset.data = dataPrevista;
  document.getElementById('na-data').value = dataPrevista;
  document.getElementById('na-cliente').value = '';
  document.getElementById('na-texto').value = '';
  document.getElementById('na-criado').value = '';
  const sel = document.getElementById('na-vend');
  if(sel) sel.innerHTML = '<option value="">Sem vendedor</option>' +
    S.vendedores.map(v=>`<option value="${v.id_vendedor}"${v.id_vendedor===F.vendedorId?' selected':''}>${v.nome_vendedor}</option>`).join('');
  m.classList.add('open');
}
function fecharNovaAtividade() { document.getElementById('modal-nova-ativ')?.classList.remove('open'); }

async function salvarNovaAtividade() {
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
    nome_cliente: cliente, tipo: 'TAREFA', texto, criado_por: criado,
    data_prevista: data || null,
    id_vendedor_responsavel: vend?.id_vendedor || null,
    nome_vendedor_responsavel: vend?.nome_vendedor || null,
  });
  toast('Atividade criada!');
  fecharNovaAtividade();
  if(btn){btn.textContent='Salvar';btn.disabled=false;}
  await loadTarefasMes();
  renderDiaPanel();
}

async function resolverNotaAgenda(id, idCliente, nomeCliente) {
  await sbUpdate('atac_crm_notas','id',id,{resolvido:true,reagendado:false,data_resolucao:new Date().toISOString()});
  toast('\u2705 Resolvido!');
  const t = AG.tarefas.find(x=>x.id===id);
  if(t){t.resolvido=true;t.reagendado=false;}
  renderDiaPanel();
  renderAlertasCRM();
  // Sugerir próximo contato
  const m = document.getElementById('modal-proximo-contato');
  if (!m) return;
  m.dataset.idcliente = idCliente || '';
  m.dataset.nomecliente = nomeCliente || '';
  const dt = new Date();
  dt.setDate(dt.getDate() + 21);
  document.getElementById('pc-data').value = dt.toISOString().split('T')[0];
  document.getElementById('pc-texto').value = '';
  document.getElementById('pc-nome').textContent = nomeCliente || '';
  // Buscar vendedor vinculado ao cliente
  const clienteRef = [...S.carteira, ...S.prospeccao, ...S.prospGeral].find(c => String(c.id_cliente) === String(idCliente));
  const vendCliente = clienteRef?.id_vendedor_responsavel || F.vendedorId;
  const sel = document.getElementById('pc-vend');
  if(sel) sel.innerHTML = '<option value="">Sem vendedor</option>' +
    S.vendedores.map(v=>`<option value="${v.id_vendedor}"${v.id_vendedor===vendCliente?' selected':''}>${v.nome_vendedor}</option>`).join('');
  m.classList.add('open');
}

function fecharProximoContato() { document.getElementById('modal-proximo-contato')?.classList.remove('open'); }

async function salvarProximoContato() {
  const m = document.getElementById('modal-proximo-contato');
  if (!m) return;
  const idCliente = m.dataset.idcliente ? Number(m.dataset.idcliente) : null;
  const nomeCliente = m.dataset.nomecliente;
  const data  = document.getElementById('pc-data').value;
  const texto = document.getElementById('pc-texto').value.trim();
  const vendId = document.getElementById('pc-vend')?.value;
  if (!data || !texto) { toast('Preencha a data e o texto', 'err'); return; }
  const vend = vendId ? S.vendedores.find(v=>v.id_vendedor===Number(vendId)) : null;
  const btn = document.getElementById('pc-btn');
  if(btn){btn.textContent='Agendando...';btn.disabled=true;}
  const sess = (await window.sb.auth.getSession()).data.session;
  const meta = sess?.user?.user_metadata || {};
  const criadoPor = meta.nome || 'CRM';
  await sbInsert('atac_crm_notas', {
    id_cliente: idCliente, nome_cliente: nomeCliente,
    tipo: 'TAREFA', texto, criado_por: criadoPor,
    data_prevista: data,
    id_vendedor_responsavel: vend?.id_vendedor || null,
    nome_vendedor_responsavel: vend?.nome_vendedor || null,
  });
  toast('\U0001f4c5 Pr\u00f3ximo contato agendado!');
  fecharProximoContato();
  if(btn){btn.textContent='Agendar';btn.disabled=false;}
  await loadTarefasMes();
  AG.diaSel = data;
  renderDiaPanel();
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
window.confirmarDescartar=confirmarDescartar;
window.renderAgendaCRM=renderAgendaCRM;
window.selClienteByNome=selClienteByNome;
window.navMes=navMes;
window.selDia=selDia;
window.abrirNovaAtividade=abrirNovaAtividade;
window.fecharNovaAtividade=fecharNovaAtividade;
window.salvarNovaAtividade=salvarNovaAtividade;
window.resolverNotaAgenda=resolverNotaAgenda;
window.reagendarNota=reagendarNota;
window.fecharReagendar=fecharReagendar;
window.salvarReagendar=salvarReagendar;
window.abrirClienteAgenda=abrirClienteAgenda;
window.fecharProximoContato=fecharProximoContato;
window.salvarProximoContato=salvarProximoContato;
window.toggleAlertasCRM=toggleAlertasCRM;
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
window.buscarNoSupabase=buscarNoSupabase;
window.toggleVend=toggleVend;
window.selCliente=selCliente;
window.closeDrawer=closeDrawer;
window.resolverNota=resolverNota;
window.resolverNotaDrawer=resolverNotaDrawer;
window.reagendarNotaDrawer=reagendarNotaDrawer;
window.salvarNota=salvarNota;
window.togglePhForm=togglePhForm;
window.savePhone=savePhone;
window.delPhone=delPhone;
window.naoComercial=naoComercial;
window.abrirVinc=abrirVinc;
window.abrirVincComSugestao=abrirVincComSugestao;
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
window.salvarCfgUsuario=salvarCfgUsuario;
window.newUV=newUV;
window.newUVforVend=newUVforVend;
window.editUV=editUV;
window.closeUV=closeUV;
window.saveUV=saveUV;
window.delUV=delUV;
window.abrirVincularERP=abrirVincularERP;
window.fecharVincularERP=fecharVincularERP;
window.searchVincERP=searchVincERP;
window.confirmarVincERP=confirmarVincERP;
window.desvincularERP=desvincularERP;
window.editarVincERP=editarVincERP;
window.fecharEditVincERP=fecharEditVincERP;
window.salvarEditVincERP=salvarEditVincERP;
window.abrirEditarCliente=abrirEditarCliente;
window.fecharEditarCliente=fecharEditarCliente;
window.salvarEditarCliente=salvarEditarCliente;
window.abrirModalVendedor=abrirModalVendedor;
window.fecharModalVendedor=fecharModalVendedor;
window.salvarModalVendedor=salvarModalVendedor;
