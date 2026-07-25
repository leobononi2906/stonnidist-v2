// ═══ STONNI ATACADO — vendedor-modal.js ═══
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
      await logAcao('ALTERAR_VENDEDOR', {
        id_cliente: cId, nome_cliente: cNome,
        id_vendedor: Number(vendId), nome_vendedor: vend?.nome_vendedor||'',
      });
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

// Busca diretamente no Supabase — elimina dependência do S.carteira local
async function buscarNoSupabase(q) {
  const el = document.getElementById('cl-list');
  if (!el) return;
  el.innerHTML = '<div class="empty-msg" style="padding:16px"><div class="spinner" style="margin:0 auto 8px"></div>Buscando...</div>';

  const qEnc = encodeURIComponent(q);
  const tab = S.mainTab === 'carteira' ? 'carteira' : 'geral';
  
  let params;
  if (tab === 'geral') {
    params = `select=*&id_vendedor_responsavel=is.null&nome_cliente=ilike.*${qEnc}*&order=dias_sem_compra.desc.nullslast&limit=50`;
  } else {
    params = `select=*&id_vendedor_responsavel=not.is.null&nome_cliente=ilike.*${qEnc}*&order=dias_sem_interacao.desc.nullslast&limit=50`;
    if (F.vendedorId) params += `&id_vendedor_responsavel=eq.${F.vendedorId}`;
  }

  const data = await sbQ('atac_crm_clientes', params);
  let results = Array.isArray(data) ? data : [];

  // Filtrar carteira vs prospecção nos resultados (e excluir CPFs)
  // CPF já filtrado na view atac_crm_clientes
  if (tab === 'carteira') {
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
      situacao: 'I', nao_comercial: true, origem: 'DESCARTADO', motivo_descarte: motivo||null, atualizado_em: new Date().toISOString()
    });
  } else {
    await sbInsert('atac_clientes', {
      id_cliente: id, nome_cliente: nome, situacao: 'I',
      nao_comercial: true, origem: 'DESCARTADO', motivo_descarte: motivo||null, criado_em: new Date().toISOString()
    });
  }
  // Remove vínculo de vendedor se houver
  await sbDel('atac_cliente_vendedor', 'id_cliente', id);
  // Se ID do ERP, descartar também qualquer registro 500000+ com mesmo telefone
  if (Number(id) < 500000) {
    const tDoc = await sbQ('atac_cliente_telefones', `select=telefone&id_cliente=eq.${id}`);
    for (const t of (Array.isArray(tDoc)?tDoc:[])) {
      const dups = await sbQ('atac_cliente_telefones', `select=id_cliente&telefone=eq.${t.telefone}&id_cliente=gte.500000`);
      for (const d of (Array.isArray(dups)?dups:[])) {
        await sbUpdate('atac_clientes','id_cliente',d.id_cliente,{situacao:'I',nao_comercial:true,origem:'DESCARTADO',motivo_descarte:motivo||null,atualizado_em:new Date().toISOString()});
        await sbDel('atac_cliente_vendedor','id_cliente',d.id_cliente);
      }
    }
  }
  await logAcao('DESCARTAR_CLIENTE', {
    id_cliente: id, nome_cliente: nome,
    detalhe: { motivo: motivo || 'não informado' }
  });
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

  const ok = await new Promise(res => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
    div.innerHTML = `<div style='background:#fff;border-radius:12px;padding:24px;max-width:340px;width:90%;text-align:center'>
      <p style='margin-bottom:16px;font-size:14px'>Atribuir <b>${nomeCliente}</b> à carteira de <b>${sN(vNome)}</b>?<br><span style='font-size:12px;color:#64748b'>O vendedor terá ${CFG.prospeccao_prazo_contato_dias} dias para registrar uma interação.</span></p>
      <div style='display:flex;gap:8px;justify-content:center'>
        <button id='_ac_n' style='padding:8px 20px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer'>Cancelar</button>
        <button id='_ac_s' style='padding:8px 20px;border-radius:8px;border:none;background:#0077CC;color:#fff;cursor:pointer'>Assumir</button>
      </div></div>`;
    document.body.appendChild(div);
    div.querySelector('#_ac_s').onclick = () => { div.remove(); res(true); };
    div.querySelector('#_ac_n').onclick = () => { div.remove(); res(false); };
  });
  if (!ok) return;

  // Upsert em atac_cliente_vendedor — atualizado_em registra o momento da atribuição
  const r = await sbUpsert('atac_cliente_vendedor',{
    id_cliente: id,
    liberado_em: null,          // reassume: vínculo volta a valer
    motivo_liberacao: null,
    nome_cliente: nomeCliente,
    id_vendedor_responsavel: vId,
    nome_vendedor_responsavel: vNome,
    atualizado_em: new Date().toISOString(),
    atualizado_por: 'CRM_PROSP_GERAL',
  },'id_cliente');

  if(!r.ok){toast('Erro ao assumir cliente','err');return;}

  await logAcao('ASSUMIR_CLIENTE', {
    id_cliente: id, nome_cliente: nomeCliente,
    id_vendedor: vId, nome_vendedor: vNome
  });
  toast(
    `✅ ${nomeCliente} foi para a carteira de ${sN(vNome)} — prazo de ${CFG.prospeccao_prazo_contato_dias} dias`,
    'ok',
    { texto: 'Ver na carteira', fn: () => { gotoTab('crm'); setMainTab('carteira'); selCliente(id); } }
  );

  // Recarrega
  await Promise.all([loadCarteira(), loadProspeccao()]);
  renderLista();
}
