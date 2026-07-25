// ═══ STONNI ATACADO — erp.js ═══
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
    await logAcao('VINCULAR_ERP', {
      id_cliente: crmId, nome_cliente: crmNome,
      detalhe: { id_erp: erpId, nome_erp: erpNome, cnpj, tem_compras: !!isCarteira }
    });
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

async function fundirDuplicado() {
  const d = S.dupSugestao;
  if (!d) return;
  const ok = await confirmarModal({
    titulo: `Fundir com ${sN(d.nome_erp)}?`,
    corpo: `O card <strong>${escH(sN(d.nome_manual))}</strong> vai ser vinculado ao cadastro do ERP <strong>${escH(sN(d.nome_erp))}</strong>. As notas, telefones e o vendedor deste card passam a valer para o cliente do ERP, e o faturamento aparece junto. Nada é apagado.`,
    okTexto: 'Fundir', okCor: 'var(--green)'
  });
  if (!ok) return;
  try {
    // reusa a maquina de vinculo ERP: card manual (crm) aponta pro codigo ERP
    const r = await sbInsert('atac_cliente_vinculos', {
      id_cliente_crm: d.id_manual,
      id_cliente_erp: d.id_erp,
      nome_cliente_erp: d.nome_erp,
      cnpj_cpf_erp: d.cnpj_erp || null,
      vinculado_por: S.meuNome || 'CRM',
    });
    if (r && r.ok === false) { toast('Falha ao fundir', 'err'); return; }
    await logAcao('FUNDIR_DUPLICADO', { id_cliente: d.id_manual, nome_cliente: d.nome_manual,
      detalhe: { id_erp: d.id_erp, motivo: d.motivo } });
    toast(`✅ Cards fundidos — ${sN(d.nome_erp)}`);
    S.dupSugestao = null;
    await Promise.all([loadCarteira(), loadProspeccao()]);
    await selCliente(d.id_manual);
  } catch(e) { toast('Erro: ' + (e?.message||e), 'err'); }
}

async function ignorarDuplicado() {
  const d = S.dupSugestao;
  if (!d) return;
  try {
    await sbInsert('atac_duplicados_ignorados', {
      id_card_a: d.id_manual, id_card_b: d.id_erp, ignorado_por: S.meuNome || 'CRM'
    });
    S.dupSugestao = null;
    toast('Sugestão dispensada');
    renderDrawer();
  } catch(e) { toast('Erro: ' + (e?.message||e), 'err'); }
}

async function desvincularERP(vincId, crmId, erpNome) {
  const okDesvincular = await new Promise(res => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
    d.innerHTML = `<div style='background:#fff;border-radius:12px;padding:24px;max-width:320px;width:90%;text-align:center'>
      <p style='margin-bottom:16px;font-size:14px'>Desvincular <b>${erpNome}</b>?<br><span style='font-size:12px;color:#64748b'>Telefones importados deste ERP também serão removidos.</span></p>
      <div style='display:flex;gap:8px;justify-content:center'>
        <button id='_dv_n' style='padding:8px 20px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer'>Cancelar</button>
        <button id='_dv_s' style='padding:8px 20px;border-radius:8px;border:none;background:#dc2626;color:#fff;cursor:pointer'>Desvincular</button>
      </div></div>`;
    document.body.appendChild(d);
    d.querySelector('#_dv_s').onclick = () => { d.remove(); res(true); };
    d.querySelector('#_dv_n').onclick = () => { d.remove(); res(false); };
  });
  if (!okDesvincular) return;
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
