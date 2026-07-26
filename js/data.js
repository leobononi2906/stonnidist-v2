// ═══ STONNI ATACADO — data.js ═══
// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
async function init() {
  initPeriod();
  await Promise.all([loadConfig(), loadVendedores(), loadDimMap(), loadCardMap()]);
  populateVendFilter();
  // Aplicar filtro automático pelo usuário logado
  await aplicarFiltroUsuario();
  await Promise.all([loadDocs(), loadCarteira(), loadProspeccao(), loadUmbler(), loadUmblerVendMap(), loadOverdue(), loadToday()]);
  // Gestão carrega em background — não bloqueia o CRM
  refreshGestao().catch(e => console.warn('refreshGestao:', e));
  gotoTab('crm'); // abre direto no CRM
  // Log de sessão iniciada
  logAcao('SESSAO_INICIADA', { detalhe: { hora: new Date().toLocaleString('pt-BR') } });

  // Captura global de erros JS não tratados
  window.onerror = function(msg, src, linha, col, err) {
    logAcao('ERRO_JS', {
      nivel: 'ERROR',
      erro: `${msg} | ${src?.split('/').pop()}:${linha}:${col}`,
      detalhe: { stack: err?.stack?.substring(0,400) || '' }
    });
  };
  window.onunhandledrejection = function(e) {
    logAcao('ERRO_PROMISE', {
      nivel: 'ERROR',
      erro: e?.reason?.message || String(e?.reason).substring(0,300),
      detalhe: { stack: e?.reason?.stack?.substring(0,400) || '' }
    });
  };
}

async function aplicarFiltroUsuario() {
  try {
    const sess = (await window.sb.auth.getSession()).data.session;
    const email = sess?.user?.email;
    if (!email) return;
    S.userEmail = email; // salva para uso no logAcao
    window._userEmail = email;
    // Fallback do nome antes de saber o vendedor: metadata do login, senao o email.
    // criado_por virou campo de auditoria — nunca mais digitado a mao.
    S.meuNome = sess?.user?.user_metadata?.nome || email.split('@')[0];
    const cfg = await sbQ('atac_config_usuario', `select=id_vendedor_erp,nome_vendedor&email=eq.${encodeURIComponent(email)}`);
    if (Array.isArray(cfg) && cfg.length > 0) {
      const { id_vendedor_erp, nome_vendedor } = cfg[0];
      S.meuVendedor = { id: id_vendedor_erp, nome: nome_vendedor };
      S.meuNome = nome_vendedor;
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
  // sincroniza o select com o período padrão (evita mostrar opção errada no load)
  const sel=document.getElementById('f-period'); if(sel) sel.value=F.period;
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
  if(v==='ult_7d')      setRange(new Date(y,m,n.getDate()-6), n);
  else if(v==='ult_30d') setRange(new Date(y,m,n.getDate()-29), n);
  else if(v==='ult_90d') setRange(new Date(y,m,n.getDate()-89), n);
  else if(v==='mes_atual')   setRange(new Date(y,m,1),new Date(y,m+1,0));
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
  S.vendDrill=null; // filtro do topo manda: sai do drill
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
  if(S.tab==='linhas'){ await loadLinhas(); if(window.renderLinhas) renderLinhas(); return; }
  await loadDocs();
  if(S.tab==='home'||S.tab==='vendedores') await refreshGestao();
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
  const [d, inativos] = await Promise.all([
    sbQ('vw_dim_vendedor','select=id_vendedor,nome_vendedor,departamento'),
    sbQ('atac_config_usuario','select=id_vendedor_erp&ativo=eq.false')
  ]);
  const idsInativos = new Set((Array.isArray(inativos)?inativos:[]).map(u=>Number(u.id_vendedor_erp)));
  S.vendedores=(Array.isArray(d)?d:[]).filter(v=>{
    const dept=(v.departamento||'').trim().toUpperCase();
    const okDept = dept==='DISTRIBUIDOR'||dept==='DISTRIBUICAO REPRESENTANTES';
    return okDept && !idsInativos.has(Number(v.id_vendedor));
  });
}
async function loadDimMap() {
  const d=await sbQ('atac_clientes','select=id_cliente,nome_cliente,cnpj_cpf,cidade,uf,telefone1,email&situacao=eq.A');
  S.dimMap=new Map();(Array.isArray(d)?d:[]).forEach(r=>S.dimMap.set(r.id_cliente,r));
}
// CPF filtrado na view atac_crm_clientes via campo nao_comercial — sem necessidade de lista no frontend

// ── Mapa de CARDS ─────────────────────────────────────────
// A operação trata CARD, não cliente: um card agrupa 2-3 cadastros (duplicados
// do ERP). Sem isso, compra/atividade que cai no cadastro irmão faz o dono
// parecer "carteira parada". Carrega uma vez (é estático, ~900 linhas).
async function loadCardMap() {
  S.cardOf = new Map();      // id_cliente -> id_card
  S.cardMembers = new Map(); // id_card -> [id_cliente,...]
  try {
    const d = await sbQ('atac_card_membro', 'select=id_card,id_cliente');
    (Array.isArray(d) ? d : []).forEach(r => {
      if (r.id_cliente == null || r.id_card == null) return;
      S.cardOf.set(r.id_cliente, r.id_card);
      if (!S.cardMembers.has(r.id_card)) S.cardMembers.set(r.id_card, []);
      S.cardMembers.get(r.id_card).push(r.id_cliente);
    });
  } catch (e) { console.warn('loadCardMap:', e); }
}
// Todos os id_cliente do mesmo card (inclui ele próprio). Cliente sem card → [id].
function cardIds(id) {
  if (id == null) return [];
  const card = S.cardOf && S.cardOf.get(id);
  if (card == null) return [id];
  const m = S.cardMembers.get(card);
  return (m && m.length) ? m : [id];
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
  // Carteira = TODO cliente com dono efetivo. A view v5 já exclui vínculo
  // liberado e vendedor inativo, então basta id_vendedor_responsavel != null.
  // Inclui quem ainda não comprou: a Prospecção agora é só balcão de garimpo,
  // e sem isso esses clientes sumiriam da tela do vendedor.
  let params='select=*&id_vendedor_responsavel=not.is.null&order=dias_sem_interacao.desc.nullslast';
  if(F.vendedorId) params+=`&id_vendedor_responsavel=eq.${F.vendedorId}`;
  const d=await sbQ('atac_crm_clientes',params);
  S.carteira=(Array.isArray(d)?d:[]);
}
async function loadProspeccao() {
  // Prospecção = BALCÃO. Só o que está disponível para garimpo: sem vínculo,
  // vínculo liberado, ou vendedor inativo — a view v5 resolve os três.
  // O vencimento de prazo saiu daqui e virou cron no banco (antes só rodava
  // se alguém abrisse esta aba no navegador).
  const d = await sbQ('atac_crm_clientes',
    'select=*&id_vendedor_responsavel=is.null&order=dias_sem_compra.desc.nullslast');
  S.prospGeral = (Array.isArray(d) ? d : []);
  S.prospeccao = [];
  S.prospVencidos = new Set();
  atualizaBadgeProsp();
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

  // Se há filtro de vendedor ativo, mostrar APENAS contatos do inbox/atendente dele
  // Contatos sem atendente de inbox geral ("ATACADO") não aparecem para ninguém específico
  if (F.vendedorId) {
    const vId = Number(F.vendedorId);
    const mapsDoVendedor = S.umblerVendMap.filter(u => Number(u.id_vendedor_erp) === vId);
    const inboxesDoVendedor = mapsDoVendedor.map(u => (u.inbox_umbler||'').toLowerCase()).filter(Boolean);
    const nomesDoVendedor   = mapsDoVendedor.flatMap(u => [
      (u.usuario_umbler||'').toLowerCase(),
      (u.nome_vendedor_erp||'').toLowerCase()
    ]).filter(Boolean);

    semVinculo = semVinculo.filter(c => {
      const atend = (c.nome_atendente||'').toLowerCase().trim();
      const inbox = (c.inbox_umbler||'').toLowerCase().trim();

      // 1. Tem atendente preenchido — checar se é do vendedor pelo nome
      if (atend) {
        return nomesDoVendedor.some(n =>
          atend.includes(n.split(' ')[0]) || n.split(' ')[0].includes(atend.split(' ')[0])
        );
      }

      // 2. Sem atendente — checar pelo inbox exclusivo
      if (inbox && inboxesDoVendedor.length) {
        return inboxesDoVendedor.some(i => inbox === i || inbox.includes(i) || i.includes(inbox));
      }

      // 3. Sem atendente e inbox geral → não aparece para nenhum vendedor específico
      return false;
    });
  }

  // Para os sem vínculo, verificar se o telefone existe no ERP (vw_dim_cliente)
  if (semVinculo.length > 0) {
    // Normalizar telefones para busca: remover DDI 55 para comparar com ERP
    const telsParaBusca = semVinculo.map(c => {
      const d = (c.telefone||'').replace(/\D/g,'');
      // ERP armazena sem DDI — tentar com e sem
      return d.startsWith('55') ? d.slice(2) : d;
    });

    // Buscar em vw_dim_cliente em lotes de 20 para evitar URL gigante (500 error)
    const LOTE = 20;
    const dimArr = [];
    const telsFiltrados = telsParaBusca.filter(Boolean);
    for (let i = 0; i < telsFiltrados.length; i += LOTE) {
      const lote = telsFiltrados.slice(i, i + LOTE);
      const orClause = lote.map(t =>
        `telefone1.ilike.*${t}*,telefone2.ilike.*${t}*,telefone3.ilike.*${t}*`
      ).join(',');
      const loteData = await sbQ('vw_dim_cliente',
        `select=id_cliente,nome_cliente,telefone1,telefone2,telefone3&or=(${orClause})`);
      if (Array.isArray(loteData)) dimArr.push(...loteData);
    }

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
      // Filtrar por inbox_umbler (preciso) ou nome como fallback
      const inboxes = uvMaps.map(u=>(u.inbox_umbler||'').toLowerCase()).filter(Boolean);
      const nomes = uvMaps.flatMap(u=>[(u.usuario_umbler||'').toLowerCase(),(u.nome_vendedor_erp||'').toLowerCase()]).filter(Boolean);
      umbler = umbler.filter(c => {
        const atend = (c.nome_atendente||'').toLowerCase();
        const cInbox = (c.inbox_umbler||'').toLowerCase();
        if (inboxes.length && cInbox) return inboxes.some(i => cInbox.includes(i) || i.includes(cInbox));
        return nomes.some(n => atend.includes(n.split(' ')[0]) || n.split(' ')[0].includes(atend.split(' ')[0]));
      });
    } else umbler = [];
  }

  S.umbler = umbler;
  const cnt = S.umbler.length;
  const el = document.getElementById('umbl-cnt');
  if (el) { el.textContent = cnt; el.classList.toggle('hidden', cnt === 0); }
}
async function loadUmblerVendMap() {
  const d=await sbQ('atac_umbler_vendedor','select=id,id_membro_umbler,id_vendedor_erp,usuario_umbler,nome_vendedor_erp,inbox_umbler,ativo&ativo=eq.true');
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
  // ── Fundação de card: descobrir o card do cliente e todos os seus membros ──
  const membroSelf = await sbQ('atac_card_membro', `select=id_card&id_cliente=eq.${id}`);
  const idCard = (Array.isArray(membroSelf) && membroSelf.length) ? membroSelf[0].id_card : null;
  let membrosCard = [];
  if (idCard != null) {
    const mm = await sbQ('atac_card_membro', `select=id_cliente,origem&id_card=eq.${idCard}`);
    membrosCard = Array.isArray(mm) ? mm : [];
  }
  const idsSecundarios = membrosCard.map(m=>Number(m.id_cliente)).filter(x=>x!==Number(id));
  const idsCard = [Number(id), ...idsSecundarios];

  const [notas, tels, vincErp, dup] = await Promise.all([
    sbQ('atac_crm_notas', `select=*,reagendado,qtd_reagendamentos&id_cliente=eq.${id}&order=data_criacao.desc`),
    sbQ('atac_cliente_telefones', `select=*&id_cliente=eq.${id}&order=principal.desc`),
    sbQ('atac_cliente_vinculos', `select=id,id_cliente_erp,nome_cliente_erp,cnpj_cpf_erp&id_cliente_crm=eq.${id}`),
    sbQ('atac_duplicados_sugestao', `select=*&id_manual=eq.${id}`),
  ]);
  S.notas = Array.isArray(notas) ? notas : [];
  S.vinculosERP = Array.isArray(vincErp) ? vincErp : [];
  S.dupSugestao = (Array.isArray(dup) && dup.length) ? dup[0] : null;

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

  // Buscar pedidos de TODOS os membros do card (fundação) + vínculos ERP legados
  const todosIds = Array.from(new Set([...idsCard, ...S.vinculosERP.map(v => Number(v.id_cliente_erp))]));
  const idsParam = todosIds.join(',');
  const peds = await sbQ('vw_comercial_docs_faturados',
    `select=id_doc,data_faturamento,faturamento_doc,faturamento_liquido,qtd_itens_doc,nome_cliente,nome_vendedor&tipo_saida=eq.DISTRIBUICAO&id_cliente=in.(${idsParam})&order=data_faturamento.desc&limit=15`);
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

  // ── Membros secundários do card: nome + telefones + notas de cada cadastro vinculado ──
  S.membrosSecundarios = [];
  if (idsSecundarios.length > 0) {
    const inSec = idsSecundarios.join(',');
    const [telSec, notasSec, dimSec, manualSec] = await Promise.all([
      sbQ('atac_cliente_telefones', `select=*&id_cliente=in.(${inSec})&order=principal.desc`),
      sbQ('atac_crm_notas', `select=*&id_cliente=in.(${inSec})&order=data_criacao.desc`),
      sbQ('vw_dim_cliente', `select=id_cliente,nome_cliente,cnpj,cpf,cidade,uf&id_cliente=in.(${inSec})`),
      sbQ('atac_clientes', `select=id_cliente,nome_cliente,cnpj_cpf,cidade,uf&id_cliente=in.(${inSec})`),
    ]);
    const telArr = Array.isArray(telSec) ? telSec : [];
    const notasArr = Array.isArray(notasSec) ? notasSec : [];
    const nomeMap = new Map();
    (Array.isArray(dimSec) ? dimSec : []).forEach(r => nomeMap.set(Number(r.id_cliente), { ...r, cnpj_cpf: r.cnpj || r.cpf || '' }));
    (Array.isArray(manualSec) ? manualSec : []).forEach(r => { if (!nomeMap.has(Number(r.id_cliente))) nomeMap.set(Number(r.id_cliente), r); });
    S.membrosSecundarios = idsSecundarios.map(cid => {
      const membro = membrosCard.find(m => Number(m.id_cliente) === cid) || {};
      const info = nomeMap.get(cid) || {};
      const seen = new Set();
      const tls = telArr.filter(t => Number(t.id_cliente) === cid).filter(t => {
        const k = (t.telefone || '').replace(/\D/g, ''); if (!k || seen.has(k)) return false; seen.add(k); return true;
      });
      return {
        id_cliente: cid,
        origem: membro.origem || 'ERP',
        nome: info.nome_cliente || `#${cid}`,
        cnpj_cpf: info.cnpj_cpf || '',
        cidade: info.cidade || '', uf: info.uf || '',
        telefones: tls,
        notas: notasArr.filter(n => Number(n.id_cliente) === cid),
      };
    });
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
// GESTÃO — dados para Home e Vendedores
// ══════════════════════════════════════════════════════════

// Itens faturados no período atual (com detalhe de produto/linha)
async function loadItens() {
  let params=`select=id_doc,id_cliente,id_vendedor,id_produto,produto,referencia,id_grupo,grupo,id_subgrupo,subgrupo,qtd,total_item,custo_total,margem_item,data_faturamento&tipo_saida=eq.DISTRIBUICAO&data_faturamento=gte.${F.dtStart}&data_faturamento=lte.${F.dtEnd}&order=data_faturamento.desc`;
  if(F.vendedorId) params+=`&id_vendedor=eq.${F.vendedorId}`;
  if(F.empresaId)  params+=`&id_empresa=eq.${F.empresaId}`;
  const d=await sbQ('vw_comercial_itens_faturados',params);
  S.itens=Array.isArray(d)?d:[];
}

// Itens do período anterior (mesmo tamanho do período atual, deslocado pra trás)
async function loadItensPrev() {
  const ds=new Date(F.dtStart+'T12:00:00'), de=new Date(F.dtEnd+'T12:00:00');
  const diff=de.getTime()-ds.getTime()+86400000; // duração em ms
  const pe=new Date(ds.getTime()-86400000); // dia anterior ao início
  const ps=new Date(pe.getTime()-diff+86400000);
  const p=n=>String(n).padStart(2,'0');
  const prevStart=`${ps.getFullYear()}-${p(ps.getMonth()+1)}-${p(ps.getDate())}`;
  const prevEnd=`${pe.getFullYear()}-${p(pe.getMonth()+1)}-${p(pe.getDate())}`;
  let params=`select=id_doc,id_cliente,id_vendedor,id_produto,produto,grupo,qtd,total_item,data_faturamento&tipo_saida=eq.DISTRIBUICAO&data_faturamento=gte.${prevStart}&data_faturamento=lte.${prevEnd}`;
  if(F.vendedorId) params+=`&id_vendedor=eq.${F.vendedorId}`;
  if(F.empresaId)  params+=`&id_empresa=eq.${F.empresaId}`;
  const d=await sbQ('vw_comercial_itens_faturados',params);
  S.itensPrev=Array.isArray(d)?d:[];
}

// Atividades CRM (notas/tarefas) no período
async function loadAtividades() {
  let params=`select=id,tipo,id_cliente,nome_cliente,id_vendedor_responsavel,nome_vendedor_responsavel,criado_por,data_criacao,resolvido&data_criacao=gte.${F.dtStart}&data_criacao=lte.${F.dtEnd}T23:59:59`;
  if(F.vendedorId) params+=`&id_vendedor_responsavel=eq.${F.vendedorId}`;
  const d=await sbQ('atac_crm_notas',params);
  S.atividades=Array.isArray(d)?d:[];
}

// Contatos Umbler no período
async function loadContatos() {
  let params=`select=telefone,nome_contato,nome_atendente,ultimo_contato&nao_comercial=eq.false&ultimo_contato=gte.${F.dtStart}&ultimo_contato=lte.${F.dtEnd}T23:59:59`;
  const d=await sbQ('atac_umbler_contatos',params);
  S.contatosUmbler=Array.isArray(d)?d:[];
}

// Análise de tendência para a Home: ÚLTIMOS 30 DIAS vs MÉDIA MENSAL DOS 3 MESES ANTERIORES.
// Ancorado na última data faturada (evita o falso "-100%" de mês incompleto).
// Independente do filtro de período do topo; respeita vendedor/empresa.
async function loadTrailing() {
  const p=n=>String(n).padStart(2,'0');
  const fmtDt=dt=>`${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}`;
  const DAY=86400000;
  // 1. última nota faturada = âncora da janela
  const last=await sbQ('vw_comercial_itens_faturados','select=data_faturamento&tipo_saida=eq.DISTRIBUICAO&order=data_faturamento.desc&limit=1');
  const anchor=(Array.isArray(last)&&last[0]&&last[0].data_faturamento)
    ? new Date(last[0].data_faturamento+'T12:00:00') : new Date();
  // 2. janelas (30 dias atuais; 90 dias anteriores = 3 meses, sem sobreposição)
  const curEnd=anchor;
  const curStart=new Date(anchor.getTime()-29*DAY);
  const baseEnd=new Date(curStart.getTime()-DAY);
  const baseStart=new Date(baseEnd.getTime()-89*DAY);
  S.trailAnchor=fmtDt(anchor);
  S.trailCur=[fmtDt(curStart),fmtDt(curEnd)];
  S.trailBase=[fmtDt(baseStart),fmtDt(baseEnd)];
  // 3. filtros opcionais
  let f='';
  if(F.vendedorId) f+=`&id_vendedor=eq.${F.vendedorId}`;
  if(F.empresaId)  f+=`&id_empresa=eq.${F.empresaId}`;
  const sel='select=id_cliente,id_produto,produto,grupo,subgrupo,qtd,total_item,data_faturamento';
  const base='tipo_saida=eq.DISTRIBUICAO';
  const [cur,bse]=await Promise.all([
    sbQ('vw_comercial_itens_faturados',`${sel}&${base}&data_faturamento=gte.${fmtDt(curStart)}&data_faturamento=lte.${fmtDt(curEnd)}${f}`),
    sbQ('vw_comercial_itens_faturados',`${sel}&${base}&data_faturamento=gte.${fmtDt(baseStart)}&data_faturamento=lte.${fmtDt(baseEnd)}${f}`)
  ]);
  S.itens30d=Array.isArray(cur)?cur:[];
  S.itensBase3m=Array.isArray(bse)?bse:[]; // total de 90 dias; dividir por 3 no render p/ média mensal
}

// Itens dos últimos 12 meses para a aba Produtos (grupo/subgrupo ao longo do tempo).
// Análise GLOBAL da empresa: NÃO usa os filtros master (período/vendedor/empresa) —
// a aba tem os próprios subfiltros (grupo/subgrupo/janela). Isso evita o master "zerar" a aba.
async function loadLinhas() {
  const p=n=>String(n).padStart(2,'0');
  const now=new Date();
  const start=new Date(now.getFullYear(), now.getMonth()-11, 1); // início de 12 meses atrás
  const s=`${start.getFullYear()}-${p(start.getMonth()+1)}-01`;
  const sel='select=id_grupo,grupo,id_subgrupo,subgrupo,produto,qtd,total_item,data_faturamento';
  const d=await sbQ('vw_comercial_itens_faturados',`${sel}&tipo_saida=eq.DISTRIBUICAO&data_faturamento=gte.${s}&order=data_faturamento.asc`);
  S.linhas=Array.isArray(d)?d:[];
}

// Refresh completo para Home e Vendedores (chamado por refreshDocs)
async function refreshGestao() {
  await Promise.all([loadItens(), loadItensPrev(), loadTrailing(), loadAtividades(), loadContatos()]);
}
