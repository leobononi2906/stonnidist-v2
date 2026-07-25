// ═══ STONNI ATACADO — agenda.js ═══
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
  // criado_por sai do login (era input livre — gerou 19 grafias para 6 pessoas)
  const elC = document.getElementById('na-criado');
  if (elC) { elC.value = S.meuNome || ''; elC.readOnly = true; elC.style.opacity = '.7'; elC.title = 'Vem do seu login'; }
  const sel = document.getElementById('na-vend');
  if(sel) sel.innerHTML = '<option value="">Sem vendedor</option>' +
    S.vendedores.map(v=>`<option value="${v.id_vendedor}"${v.id_vendedor===(S.meuVendedor?.id||F.vendedorId)?' selected':''}>${v.nome_vendedor}</option>`).join('');
  m.classList.add('open');
}
function fecharNovaAtividade() { document.getElementById('modal-nova-ativ')?.classList.remove('open'); }

async function salvarNovaAtividade() {
  const cliente = document.getElementById('na-cliente')?.value?.trim();
  const texto   = document.getElementById('na-texto')?.value?.trim();
  const criado  = S.meuNome || document.getElementById('na-criado')?.value?.trim();
  const data    = document.getElementById('na-data')?.value;
  const vendId  = document.getElementById('na-vend')?.value;
  if (!cliente || !texto || !criado) { toast('Preencha cliente, texto e criado por', 'err'); return; }
  const vend = vendId ? S.vendedores.find(v=>v.id_vendedor===Number(vendId)) : null;
  const btn = document.getElementById('na-btn');
  if(btn){btn.textContent='Salvando...';btn.disabled=true;}
  // Buscar id_cliente pelo nome para vincular corretamente
  const cRef = [...S.carteira,...S.prospeccao,...S.prospGeral].find(c=>c.nome_cliente===cliente);
  await sbInsert('atac_crm_notas', {
    id_cliente: cRef?.id_cliente || null,
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
