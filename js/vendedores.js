// ═══ STONNI ATACADO — vendedores.js ═══
// ══════════════════════════════════════════════════════════
// ABA VENDEDORES — Ranking de Equipe + Painel Individual
// ══════════════════════════════════════════════════════════

async function renderVendedores() {
  const el = document.getElementById('vend-body');
  if (!el) return;

  if (F.vendedorId) {
    renderVendedorIndividual(el);
  } else {
    await renderVendedorTeam(el);
  }
}

// ── MODE 1: Team Ranking ──────────────────────────────────
async function renderVendedorTeam(el) {
  el.innerHTML = '<div class="empty-msg"><span class="spin">&#x27F3;</span> Calculando ranking...</div>';

  const allowedIds = new Set(S.vendedores.map(v => v.id_vendedor));
  const vm = new Map();
  S.docs.forEach(d => {
    if (!allowedIds.has(d.id_vendedor)) return;
    if (!vm.has(d.id_vendedor)) vm.set(d.id_vendedor, { id: d.id_vendedor, nome: d.nome_vendedor || '', fat: 0, cli: new Set(), ped: new Set() });
    const v = vm.get(d.id_vendedor);
    v.fat += docFat(d);
    if (d.id_cliente) v.cli.add(d.id_cliente);
    if (d.id_doc) v.ped.add(d.id_doc);
  });

  const vl = [...vm.values()]
    .map(v => ({ ...v, clientes: v.cli.size, pedidos: v.ped.size, ticket: v.ped.size ? v.fat / v.ped.size : 0 }))
    .sort((a, b) => b.fat - a.fat);

  const fatTot = vl.reduce((s, v) => s + v.fat, 0);
  const maxF = Math.max(...vl.map(v => v.fat), 1);

  // Saude carteira por vendedor
  const crmH = new Map();
  S.carteira.forEach(c => {
    const vid = c.id_vendedor_responsavel;
    if (!vid) return;
    if (!crmH.has(vid)) crmH.set(vid, { a: 0, t: 0, r: 0 });
    const h = crmH.get(vid);
    const st = getStatus(c);
    if (st === 'ATIVO') h.a++;
    else if (st === 'ATENCAO') h.t++;
    else if (st === 'PERDIDO') h.r++;
  });

  el.innerHTML = `
    <div class="kgrid">
      ${kc('\u{1F4B0}', 'Faturamento', fmtK(fatTot), 'kc-b')}
      ${kc('\u{1F464}', 'Vendedores', vl.length, 'kc-p')}
      ${kc('\u{1F465}', 'Clientes', new Set(S.docs.filter(d => allowedIds.has(d.id_vendedor)).map(d => d.id_cliente).filter(Boolean)).size, 'kc-g')}
      ${kc('\u{1F6D2}', 'Pedidos', new Set(S.docs.filter(d => allowedIds.has(d.id_vendedor)).map(d => d.id_doc).filter(Boolean)).size, 'kc-y')}
    </div>

    <div class="scard">
      <div class="scard-title">\u{1F4CA} Ranking de Vendedores</div>
      ${vl.length ? `<div style="overflow-x:auto"><table class="data-table">
        <thead><tr>
          <th style="width:30px">#</th>
          <th>Vendedor</th>
          <th class="r">Faturamento</th>
          <th class="r">% Equipe</th>
          <th class="r">Clientes</th>
          <th class="r">Pedidos</th>
          <th class="r">Ticket M\u00e9dio</th>
          <th style="width:140px;min-width:100px"></th>
        </tr></thead>
        <tbody>
          ${vl.map((v, i) => {
            const h = crmH.get(v.id) || { a: 0, t: 0, r: 0 };
            const exp = S.expandVend === v.id;
            const medal = i === 0 ? '\u{1F947}' : i === 1 ? '\u{1F948}' : i === 2 ? '\u{1F949}' : '';
            const share = fatTot ? Math.round(v.fat / fatTot * 100) : 0;

            // Top 5 clientes deste vendedor
            const tc = new Map();
            S.docs.filter(d => d.id_vendedor === v.id).forEach(d => {
              if (!d.id_cliente) return;
              if (!tc.has(d.id_cliente)) tc.set(d.id_cliente, { nome: d.nome_cliente, fat: 0 });
              tc.get(d.id_cliente).fat += docFat(d);
            });
            const tcArr = [...tc.values()].sort((a, b) => b.fat - a.fat).slice(0, 5);

            return `<tr class="cl" onclick="toggleVend(${v.id})">
              <td style="text-align:center;font-size:12px;color:${exp ? 'var(--blue-mid)' : 'var(--text-muted)'}">${exp ? '\u25BC' : '\u25B6'}</td>
              <td style="font-weight:600;color:var(--text-primary);white-space:nowrap">${sN(v.nome)} ${medal}</td>
              <td class="r mono" style="font-weight:700;color:var(--text-primary)">${fmtK(v.fat)}</td>
              <td class="r"><span class="b-tag" style="background:var(--blue-pale,#E8F4FD);color:var(--blue-mid);font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:4px">${share}%</span></td>
              <td class="r mono" style="color:var(--text-secondary)">${v.clientes}</td>
              <td class="r mono" style="color:var(--text-secondary)">${v.pedidos}</td>
              <td class="r mono" style="color:var(--text-secondary)">${fmtK(v.ticket)}</td>
              <td><div class="bar-track" style="margin:0"><div class="bar-fill" style="width:${Math.round(v.fat / maxF * 100)}%"></div></div></td>
            </tr>
            ${exp ? `<tr class="expand-row"><td colspan="8"><div class="expand-inner">
              <div class="hgrid">
                <div class="hbox ha"><div class="n">${h.a}</div><div class="l">Ativos</div></div>
                <div class="hbox ht"><div class="n">${h.t}</div><div class="l">Aten\u00e7\u00e3o</div></div>
                <div class="hbox hr"><div class="n">${h.r}</div><div class="l">Em Risco</div></div>
              </div>
              <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Top 5 Clientes no Per\u00edodo</div>
              ${tcArr.map(c => `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;padding:6px 0;border-bottom:1px solid var(--border)">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-primary)">${sN(c.nome)}</span>
                <span class="mono" style="color:var(--text-secondary);flex-shrink:0;margin-left:8px;font-weight:600">${fmtK(c.fat)}</span>
              </div>`).join('') || '<div class="empty-msg">Sem pedidos no per\u00edodo</div>'}
            </div></td></tr>` : ''}`;
          }).join('')}
        </tbody>
      </table></div>` : '<div class="empty-msg">Sem faturamento no per\u00edodo selecionado</div>'}
    </div>`;
}

// ── MODE 2: Individual Panel ──────────────────────────────
function renderVendedorIndividual(el) {
  const vid = F.vendedorId;
  const vInfo = S.vendedores.find(v => v.id_vendedor === vid);
  const nomeVend = vInfo ? vInfo.nome_vendedor : '';

  // Docs filtrados por vendedor
  const myDocs = S.docs.filter(d => d.id_vendedor === vid);
  const myItens = S.itens.filter(i => i.id_vendedor === vid);
  const myItensPrev = S.itensPrev.filter(i => i.id_vendedor === vid);
  const myCarteira = S.carteira.filter(c => c.id_vendedor_responsavel === vid);

  // KPIs basicos
  const fatTotal = myDocs.reduce((s, d) => s + docFat(d), 0);
  const pedidoSet = new Set(myDocs.map(d => d.id_doc).filter(Boolean));
  const pedidos = pedidoSet.size;
  const clienteSet = new Set(myDocs.map(d => d.id_cliente).filter(Boolean));
  const clientesAtendidos = clienteSet.size;
  const ticketMedio = pedidos ? fatTotal / pedidos : 0;
  const carteiraTotal = myCarteira.length;

  // Novos clientes (vinculo_em dentro do periodo)
  const dtS = F.dtStart ? new Date(F.dtStart + 'T00:00:00') : null;
  const dtE = F.dtEnd ? new Date(F.dtEnd + 'T23:59:59') : null;
  const novosClientes = myCarteira.filter(c => {
    if (!c.vinculo_em) return false;
    const dv = new Date(c.vinculo_em);
    return (!dtS || dv >= dtS) && (!dtE || dv <= dtE);
  }).length;

  // Saude da carteira
  let hAtivos = 0, hAtencao = 0, hRisco = 0;
  myCarteira.forEach(c => {
    const st = getStatus(c);
    if (st === 'ATIVO') hAtivos++;
    else if (st === 'ATENCAO') hAtencao++;
    else if (st === 'PERDIDO') hRisco++;
  });
  const semContato30 = myCarteira.filter(c => c.dias_sem_interacao > 30).length;

  // Metricas CRM
  const myAtividades = S.atividades.filter(a => a.id_vendedor_responsavel === vid);
  const atividadesTotal = myAtividades.length;
  const tarefasResolvidas = myAtividades.filter(a => a.tipo === 'TAREFA' && a.resolvido === true).length;

  // Contatos Umbler
  const umblerMap = (S.umblerVendMap || []).find(m => m.id_vendedor_erp === vid);
  const umblerUser = umblerMap ? umblerMap.usuario_umbler : null;
  const nomeVendErp = umblerMap ? umblerMap.nome_vendedor_erp : nomeVend;
  const contatosUmbler = umblerUser
    ? (S.contatosUmbler || []).filter(c => c.nome_atendente === umblerUser).length
    : 0;

  // Clientes sem venda (prospeccao ativa)
  const clientesSemVenda = myCarteira.filter(c => c.status_crm === 'PROSPECCAO').length;

  // Faturamento por Linha (grupo)
  const grupoMap = new Map();
  myItens.forEach(it => {
    const g = it.grupo || 'Sem grupo';
    if (!grupoMap.has(g)) grupoMap.set(g, 0);
    grupoMap.set(g, grupoMap.get(g) + (Number(it.total_item) || 0));
  });
  const grupoArr = [...grupoMap.entries()]
    .map(([nome, val]) => ({ nome, val }))
    .sort((a, b) => b.val - a.val);
  const grupoMax = Math.max(...grupoArr.map(g => g.val), 1);
  const grupoTotal = grupoArr.reduce((s, g) => s + g.val, 0);

  // Top 10 Clientes
  const cliMap = new Map();
  myDocs.forEach(d => {
    if (!d.id_cliente) return;
    if (!cliMap.has(d.id_cliente)) cliMap.set(d.id_cliente, { id: d.id_cliente, nome: d.nome_cliente, fat: 0 });
    cliMap.get(d.id_cliente).fat += docFat(d);
  });
  // Fat previo por cliente
  const cliPrevMap = new Map();
  myItensPrev.forEach(it => {
    if (!it.id_cliente) return;
    if (!cliPrevMap.has(it.id_cliente)) cliPrevMap.set(it.id_cliente, 0);
    cliPrevMap.set(it.id_cliente, cliPrevMap.get(it.id_cliente) + (Number(it.total_item) || 0));
  });
  const topClientes = [...cliMap.values()].sort((a, b) => b.fat - a.fat).slice(0, 10);
  const topCliMax = Math.max(...topClientes.map(c => c.fat), 1);

  // Clientes sem contato > 30 dias
  const semContato = myCarteira
    .filter(c => c.dias_sem_interacao > 30)
    .sort((a, b) => b.dias_sem_interacao - a.dias_sem_interacao)
    .slice(0, 10);

  el.innerHTML = `
    <!-- Header -->
    <div style="margin-bottom:20px">
      <h2 style="margin:0;font-size:22px;font-weight:700;color:var(--text-primary)">${sN(nomeVend) !== '\u2014' ? nomeVend : 'Vendedor'}</h2>
      ${vInfo && vInfo.departamento ? `<span style="font-size:13px;color:var(--text-muted)">${vInfo.departamento}</span>` : ''}
    </div>

    <!-- KPIs 2x3 -->
    <div class="kgrid" style="grid-template-columns:repeat(3,1fr)">
      ${kc('\u{1F4B0}', 'Faturamento', fmtK(fatTotal), 'kc-b')}
      ${kc('\u{1F6D2}', 'Pedidos', pedidos, 'kc-y')}
      ${kc('\u{1F465}', 'Clientes atendidos', clientesAtendidos, 'kc-g')}
      ${kc('\u{1F3AF}', 'Ticket M\u00e9dio', fmtK(ticketMedio), 'kc-p')}
      ${kc('\u{1F4CB}', 'Carteira total', carteiraTotal, 'kc-b')}
      ${kc('\u{1F195}', 'Novos clientes', novosClientes, 'kc-g')}
    </div>

    <!-- Saude da Carteira -->
    <div class="scard">
      <div class="scard-title">\u{1F3E5} Sa\u00fade da Carteira</div>
      <div class="hgrid">
        <div class="hbox ha"><div class="n">${hAtivos}</div><div class="l">Ativos</div></div>
        <div class="hbox ht"><div class="n">${hAtencao}</div><div class="l">Aten\u00e7\u00e3o</div></div>
        <div class="hbox hr"><div class="n">${hRisco}</div><div class="l">Em Risco</div></div>
      </div>
      ${semContato30 > 0 ? `<div style="margin-top:12px;padding:8px 12px;background:var(--yellow-pale,#FFF8E1);border-radius:8px;font-size:12.5px;color:var(--text-secondary)">
        \u26A0 <strong>${semContato30}</strong> clientes sem contato h\u00e1 mais de 30 dias
      </div>` : ''}
    </div>

    <!-- Metricas CRM -->
    <div class="scard">
      <div class="scard-title">\u{1F4C8} M\u00e9tricas de Atividade CRM</div>
      <div class="kgrid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
        ${kc('\u{1F4DD}', 'Atividades registradas', atividadesTotal, 'kc-b')}
        ${kc('\u2705', 'Tarefas resolvidas', tarefasResolvidas, 'kc-g')}
        ${kc('\u{1F4AC}', 'Contatos Umbler', contatosUmbler, 'kc-p')}
        ${kc('\u{1F50D}', 'Clientes sem venda', clientesSemVenda, 'kc-y')}
      </div>
    </div>

    <!-- Atividade Diária / Semanal -->
    ${_renderAtividadeDiaria(myAtividades, S.contatosUmbler || [], umblerUser)}

    <!-- Faturamento por Linha -->
    <div class="scard">
      <div class="scard-title">\u{1F4CA} Faturamento por Linha</div>
      ${grupoArr.length ? grupoArr.map(g => {
        const pct = grupoTotal ? Math.round(g.val / grupoTotal * 100) : 0;
        const barW = Math.round(g.val / grupoMax * 100);
        return `<div class="bar-row">
          <span style="flex:1;font-size:12.5px;font-weight:500;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.nome}</span>
          <span class="mono bar-val" style="flex-shrink:0;margin:0 8px;font-size:12px">${fmtK(g.val)} (${pct}%)</span>
          <div class="bar-track" style="width:120px;flex-shrink:0"><div class="bar-fill" style="width:${barW}%"></div></div>
        </div>`;
      }).join('') : '<div class="empty-msg">Sem dados no per\u00edodo</div>'}
    </div>

    <!-- Top 10 Clientes -->
    <div class="scard">
      <div class="scard-title">\u{1F3C6} Top 10 Clientes do Vendedor</div>
      ${topClientes.length ? topClientes.map((c, i) => {
        const prevFat = cliPrevMap.get(c.id) || 0;
        const delta = prevFat > 0 ? Math.round((c.fat / prevFat - 1) * 100) : null;
        const deltaHtml = delta !== null
          ? `<span class="${delta >= 0 ? 'delta-pos' : 'delta-neg'}" style="flex-shrink:0;margin-left:6px">${delta > 0 ? '+' : ''}${delta}%</span>`
          : '';
        const barW = Math.round(c.fat / topCliMax * 100);
        return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
          <span style="width:20px;height:20px;border-radius:6px;background:var(--surface2);color:var(--text-secondary);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12.5px;font-weight:500;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sN(c.nome)}</div>
            <div class="bar-track" style="height:4px;margin-top:4px"><div class="bar-fill" style="width:${barW}%"></div></div>
          </div>
          <span class="mono" style="font-size:12.5px;font-weight:700;color:var(--text-primary);flex-shrink:0">${fmtK(c.fat)}</span>
          ${deltaHtml}
        </div>`;
      }).join('') : '<div class="empty-msg">Sem pedidos no per\u00edodo</div>'}
    </div>

    <!-- Clientes sem contato > 30 dias -->
    ${semContato.length ? `<div class="scard">
      <div class="scard-title">\u{1F6A8} Clientes sem contato &gt; 30 dias</div>
      <div style="max-height:400px;overflow-y:auto">
        ${semContato.map(c => {
          const st = getStatus(c);
          const bdgCls = st === 'ATIVO' ? 'bdg-a' : st === 'ATENCAO' ? 'bdg-t' : 'bdg-r';
          const stLabel = st === 'ATIVO' ? 'Ativo' : st === 'ATENCAO' ? 'Aten\u00e7\u00e3o' : st === 'PERDIDO' ? 'Perdido' : st;
          return `<div class="cl" onclick="selCliente(${c.id_cliente});gotoTab('crm')" style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);cursor:pointer">
            <div style="flex:1;min-width:0">
              <div style="font-size:12.5px;font-weight:500;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sN(c.nome_cliente)}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">\u00dalt. compra: ${c.faturamento_total ? fmtK(c.faturamento_total) : '\u2014'}</div>
            </div>
            <span style="font-size:11px;font-weight:600;color:var(--red-mid,#E53935);flex-shrink:0">${c.dias_sem_interacao} dias</span>
            <span class="bdg ${bdgCls}" style="flex-shrink:0">${stLabel}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;
}

// ── Atividade Diária / Semanal ────────────────────────────
function _renderAtividadeDiaria(atividades, contatosUmbler, umblerUser) {
  // Agrupar atividades CRM por dia
  const porDia = new Map();
  atividades.forEach(a => {
    const dia = (a.data_criacao || '').substring(0, 10);
    if (!dia) return;
    if (!porDia.has(dia)) porDia.set(dia, { notas: 0, tarefas: 0, followups: 0, ligacoes: 0, resolvidas: 0, clientes: new Set() });
    const d = porDia.get(dia);
    d.notas++;
    if (a.tipo === 'TAREFA') d.tarefas++;
    if (a.tipo === 'FOLLOWUP') d.followups++;
    if (a.tipo === 'LIGACAO') d.ligacoes++;
    if (a.resolvido) d.resolvidas++;
    if (a.id_cliente) d.clientes.add(a.id_cliente);
  });

  // Agrupar contatos Umbler por dia
  const umblerPorDia = new Map();
  if (umblerUser) {
    contatosUmbler.filter(c => c.nome_atendente === umblerUser).forEach(c => {
      const dia = (c.ultimo_contato || '').substring(0, 10);
      if (!dia) return;
      umblerPorDia.set(dia, (umblerPorDia.get(dia) || 0) + 1);
    });
  }

  // Unificar dias e ordenar desc
  const todosDias = new Set([...porDia.keys(), ...umblerPorDia.keys()]);
  const diasArr = [...todosDias].sort((a, b) => b.localeCompare(a));

  if (!diasArr.length) return '';

  // Agrupar por semana (ISO week)
  function _getWeek(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const oneJan = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
    return `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`;
  }

  const porSemana = new Map();
  diasArr.forEach(dia => {
    const sem = _getWeek(dia);
    if (!porSemana.has(sem)) porSemana.set(sem, { notas: 0, resolvidas: 0, umbler: 0, clientes: new Set(), dias: 0 });
    const s = porSemana.get(sem);
    const dd = porDia.get(dia);
    if (dd) { s.notas += dd.notas; s.resolvidas += dd.resolvidas; dd.clientes.forEach(c => s.clientes.add(c)); }
    s.umbler += (umblerPorDia.get(dia) || 0);
    s.dias++;
  });

  const semanasArr = [...porSemana.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const maxNotas = Math.max(...diasArr.map(d => (porDia.get(d)?.notas || 0) + (umblerPorDia.get(d) || 0)), 1);

  // Tabela diária (últimos 14 dias)
  const dias14 = diasArr.slice(0, 14);
  const tabelaDia = dias14.map(dia => {
    const dd = porDia.get(dia) || { notas: 0, tarefas: 0, followups: 0, ligacoes: 0, resolvidas: 0, clientes: new Set() };
    const umb = umblerPorDia.get(dia) || 0;
    const total = dd.notas + umb;
    const barW = Math.round((total / maxNotas) * 100);
    const dtLabel = new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:11px;color:var(--text-muted);width:80px;flex-shrink:0">${dtLabel}</span>
      <div class="bar-track" style="flex:1;height:10px"><div class="bar-fill" style="width:${barW}%;background:var(--blue-mid)"></div></div>
      <span style="font-size:10px;color:var(--text-secondary);width:25px;text-align:right;font-weight:700">${total}</span>
      <span style="font-size:9px;color:var(--text-muted);width:80px;flex-shrink:0;text-align:right">${dd.tarefas?dd.tarefas+'T ':''}${dd.followups?dd.followups+'F ':''}${dd.ligacoes?dd.ligacoes+'L ':''}${umb?umb+'U':''}</span>
      <span style="font-size:9px;color:var(--green);width:35px;flex-shrink:0;text-align:right">${dd.clientes.size?dd.clientes.size+' cli':''}</span>
    </div>`;
  }).join('');

  // Resumo semanal
  const tabelaSem = semanasArr.slice(0, 8).map(([sem, s]) => {
    const mediaDia = s.dias ? (s.notas / s.dias).toFixed(1) : '0';
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:11px;font-weight:600;color:var(--text-primary);width:60px;flex-shrink:0">${sem}</span>
      <span style="font-size:10px;color:var(--text-muted);width:35px;text-align:right">${s.notas} reg</span>
      <span style="font-size:10px;color:var(--green);width:35px;text-align:right">${s.resolvidas} \u2713</span>
      <span style="font-size:10px;color:var(--purple);width:35px;text-align:right">${s.umbler} umb</span>
      <span style="font-size:10px;color:var(--text-secondary);width:35px;text-align:right">${s.clientes.size} cli</span>
      <span style="font-size:10px;color:var(--text-muted);width:50px;text-align:right">${mediaDia}/dia</span>
    </div>`;
  }).join('');

  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div class="scard" style="margin-bottom:0">
      <div class="scard-title">\u{1F4C5} Atividade Di\u00e1ria (\u00falt. 14 dias)</div>
      <div style="font-size:9px;color:var(--text-muted);margin-bottom:6px">T=Tarefa F=Follow-up L=Liga\u00e7\u00e3o U=Umbler</div>
      ${tabelaDia || '<div class="empty-msg">Sem atividade no per\u00edodo</div>'}
    </div>
    <div class="scard" style="margin-bottom:0">
      <div class="scard-title">\u{1F4CA} Resumo Semanal</div>
      ${tabelaSem || '<div class="empty-msg">Sem dados</div>'}
    </div>
  </div>`;
}

function toggleVend(id) {
  S.expandVend = S.expandVend === id ? null : id;
  renderVendedores();
}
