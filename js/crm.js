// ═══ STONNI ATACADO — crm.js ═══
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
  if(S.mainTab==='prospeccao'){
    const data=filteredProsp();
    if(!data.length){
      el.innerHTML=`<div class="empty-msg">
        <p style="margin-bottom:8px">Nenhum cliente disponível na prospecção</p>
        <p style="font-size:11px;color:#334155">Aparecem aqui os clientes sem vendedor, os liberados por prazo vencido e os de vendedor inativado</p>
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
              ${bdg(c.status_crm||'PROSPECCAO')}
              ${c.nome_ultimo_responsavel?`<span title="${c.ex_vendedor_inativo?'Vendedor saiu da equipe':'Vínculo liberado por prazo vencido'} — disponível para assumir" style="font-size:9.5px;font-weight:700;background:var(--orange-bg);color:var(--orange);border-radius:4px;padding:1px 6px;white-space:nowrap">era de ${sN(c.nome_ultimo_responsavel)}</span>`:''}
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

    // Prazo de conversão: cliente assumido que ainda não comprou vive na Carteira
    let prazoBdg='';
    if(S.mainTab==='carteira' && c.status_crm==='PROSPECCAO' && c.vinculo_em){
      const diasAtrib=Math.floor((Date.now()-new Date(c.vinculo_em).getTime())/86400000);
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
      // Sem compra = nunca comprou ou não compra há mais de 180d (status PROSPECCAO na view)
      if (S.subFilter === 'sem_compra') return c.status_crm === 'PROSPECCAO';
      if (c.status_crm === 'PROSPECCAO') return false; // não polui Ativo/Atenção/Em Risco
      const st = getStatus(c);
      if (S.subFilter === 'ativo')    return st === 'ATIVO';
      if (S.subFilter === 'atencao')  return st === 'ATENCAO';
      if (S.subFilter === 'em_risco') return st === 'PERDIDO';
      return true;
    });
  }
  return [...d].sort(cmpClientes(S.cSort));
}
// Ordenacao compartilhada Carteira/Prospeccao.
// Datas nulas SEMPRE por ultimo, nos dois sentidos — cliente sem compra no topo
// de "ultima compra" nao ajuda ninguem.
function cmpClientes(modo){
  const d = v => v ? new Date(v).getTime() : null;
  const porData = (campo, desc) => (a,b) => {
    const x=d(a[campo]), y=d(b[campo]);
    if(x===null && y===null) return (a.nome_cliente||'').localeCompare(b.nome_cliente||'');
    if(x===null) return 1;
    if(y===null) return -1;
    return desc ? y-x : x-y;
  };
  switch(modo){
    case 'compra_rec':  return porData('ultima_compra', true);
    case 'compra_ant':  return porData('ultima_compra', false);
    case 'contato_rec': return porData('ultima_interacao', true);
    case 'contato_ant': return porData('ultima_interacao', false);
    case 'fat_desc':    return (a,b) => Number(b.faturamento_total||0) - Number(a.faturamento_total||0);
    case 'vendedor_az': return (a,b) => (a.nome_ultimo_responsavel||'zzz').localeCompare(b.nome_ultimo_responsavel||'zzz');
    default:            return (a,b) => (a.nome_cliente||'').localeCompare(b.nome_cliente||'');
  }
}
function filteredProsp(){
  let d = S.prospGeral;
  if (S.search) {
    const q = S.search.toLowerCase();
    d = d.filter(c => (c.nome_cliente||'').toLowerCase().includes(q) || String(c.id_cliente).includes(q));
  }
  // Filtros: comprou nos últimos 180d  vs  não compra há +180d (ou nunca).
  // A view já traduz isso em status_crm — PROSPECCAO == não compra há +180d/nunca.
  if (S.pSub === 'comprou')    d = d.filter(c => c.status_crm !== 'PROSPECCAO');
  if (S.pSub === 'sem_compra') d = d.filter(c => c.status_crm === 'PROSPECCAO');

  return [...d].sort(cmpClientes(S.pSort));
}
