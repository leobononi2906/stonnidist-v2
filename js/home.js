// ═══ STONNI ATACADO — home.js ═══
// ══════════════════════════════════════════════════════════
// ABA HOME — Dashboard
// ══════════════════════════════════════════════════════════

function kc(ic, lbl, val, cls) {
  return `<div class="kcard ${cls}"><div class="lbl">${ic} ${lbl}</div><div class="val">${val}</div></div>`;
}

function setTopPeriod(p) {
  S.topPeriod = p;
  renderHome();
}

// ── estado de ordenação ──────────────────────────────────
if (!S._homeSort) S._homeSort = { cliCresc:'delta', cliQueda:'delta', prodCresc:'delta', prodQueda:'delta' };

function setHomeSort(secao, modo) {
  S._homeSort[secao] = modo;
  renderHome();
}

// ── helpers internos ──────────────────────────────────────

function _sumField(arr, field) {
  return arr.reduce((s, r) => s + (Number(r[field]) || 0), 0);
}

function _truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function _monthKey(d) {
  return (d || '').substring(0, 7);
}

function _monthLabel(ym) {
  if (!ym || ym.length < 7) return ym;
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const parts = ym.split('-');
  return meses[parseInt(parts[1], 10) - 1] + '/' + parts[0].substring(2);
}

function _grupoColor(g) {
  const u = (g || '').toUpperCase();
  if (u.includes('AR CONDICIONADO') || u.includes('AR-CONDICIONADO')) return 'var(--blue-mid)';
  if (u.includes('DIVERSOS'))       return 'var(--purple)';
  if (u.includes('GELADEIRA') || u.includes('REFRIGERA')) return 'var(--green)';
  return 'var(--text-muted)';
}

// ── botões de ordenação ──────────────────────────────────
function _sortBtns(secao, opcoes) {
  const atual = S._homeSort[secao] || opcoes[0].v;
  return `<div style="display:flex;gap:3px;flex-shrink:0">${opcoes.map(o =>
    `<button onclick="setHomeSort('${secao}','${o.v}')" style="padding:2px 8px;font-size:10px;font-weight:600;border-radius:4px;cursor:pointer;border:1px solid ${atual===o.v?'var(--blue-dark)':'var(--border)'};background:${atual===o.v?'var(--blue-dark)':'transparent'};color:${atual===o.v?'#fff':'var(--text-muted)'}">${o.l}</button>`
  ).join('')}</div>`;
}

function _sortArr(arr, secao) {
  const modo = S._homeSort[secao] || 'delta';
  if (modo === 'valor') return [...arr].sort((a, b) => b.cur - a.cur);
  if (modo === 'qtd')   return [...arr].sort((a, b) => (b.qtd||0) - (a.qtd||0));
  return [...arr]; // delta — já vem ordenado
}

// ══════════════════════════════════════════════════════════
// RENDER HOME
// ══════════════════════════════════════════════════════════
function renderHome() {
  const el = document.getElementById('home-body');
  if (!el) return;
  if (!S.topPeriod) S.topPeriod = '1m';
  if (!S._homeSort) S._homeSort = { cliCresc:'delta', cliQueda:'delta', prodCresc:'delta', prodQueda:'delta' };

  const d = S.docs;
  const itens = S.itens || [];
  const itensPrev = S.itensPrev || [];

  // ── 1. KPIs ─────────────────────────────────────────────
  const fat = d.reduce((s, r) => s + docFat(r), 0);
  const ped = new Set(d.map(r => r.id_doc)).size;
  const cli = new Set(d.map(r => r.id_cliente).filter(Boolean)).size;
  const ticket = ped ? fat / ped : 0;

  // ── 2. Faturamento por Linha ────────────────────────────
  const grupoMap = new Map();
  itens.forEach(r => {
    const g = (r.grupo || 'Sem grupo').trim();
    grupoMap.set(g, (grupoMap.get(g) || 0) + (Number(r.total_item) || 0));
  });
  const grupoPrevMap = new Map();
  itensPrev.forEach(r => {
    const g = (r.grupo || 'Sem grupo').trim();
    grupoPrevMap.set(g, (grupoPrevMap.get(g) || 0) + (Number(r.total_item) || 0));
  });
  const totalLinhas = [...grupoMap.values()].reduce((a, b) => a + b, 0) || 1;

  let grupos = [];
  let outrosVal = 0, outrosPrev = 0;
  grupoMap.forEach((val, g) => {
    if (val / totalLinhas < 0.01) { outrosVal += val; outrosPrev += (grupoPrevMap.get(g) || 0); }
    else { grupos.push({ nome: g, val, prev: grupoPrevMap.get(g) || 0 }); }
  });
  if (outrosVal > 0) grupos.push({ nome: 'Outros', val: outrosVal, prev: outrosPrev });
  grupos.sort((a, b) => b.val - a.val);

  const linhasHTML = grupos.map(g => {
    const pct = ((g.val / totalLinhas) * 100).toFixed(1);
    let deltaHTML = '';
    if (g.prev > 0) {
      const delta = ((g.val - g.prev) / g.prev) * 100;
      deltaHTML = `<span class="${delta >= 0 ? 'delta-pos' : 'delta-neg'}">${fmtPct(delta)}</span>`;
    } else if (g.val > 0) {
      deltaHTML = `<span class="delta-pos">Novo</span>`;
    }
    return `<div class="ccard" style="padding:14px 16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${escH(g.nome)}</span>
        ${deltaHTML}
      </div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <span style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace;color:var(--blue-mid)">${fmtK(g.val)}</span>
        <span style="font-size:11px;color:var(--text-muted)">${pct}%</span>
      </div>
    </div>`;
  }).join('');

  // ── 3. Evolução Mensal ──────────────────────────────────
  const monthGrupo = new Map();
  const allGrupos = new Set();
  itens.forEach(r => {
    const mk = _monthKey(r.data_faturamento);
    if (!mk) return;
    const g = (r.grupo || 'Outros').trim();
    allGrupos.add(g);
    if (!monthGrupo.has(mk)) monthGrupo.set(mk, new Map());
    const mg = monthGrupo.get(mk);
    mg.set(g, (mg.get(g) || 0) + (Number(r.total_item) || 0));
  });
  const months = [...monthGrupo.keys()].sort();
  let maxMonth = 0;
  months.forEach(m => { let t = 0; monthGrupo.get(m).forEach(v => t += v); if (t > maxMonth) maxMonth = t; });
  if (!maxMonth) maxMonth = 1;
  const grupoOrder = [...allGrupos].sort((a, b) => (grupoMap.get(b) || 0) - (grupoMap.get(a) || 0));

  const legendHTML = grupoOrder.slice(0, 6).map(g =>
    `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted)"><span style="width:8px;height:8px;border-radius:2px;background:${_grupoColor(g)}"></span>${escH(g)}</span>`
  ).join(' ');

  const evolHTML = months.map(m => {
    const mg = monthGrupo.get(m);
    let total = 0; mg.forEach(v => total += v);
    const pctTotal = (total / maxMonth) * 100;
    const segments = grupoOrder.map(g => {
      const v = mg.get(g) || 0;
      if (v <= 0) return '';
      return `<div style="width:${((v / total) * 100).toFixed(1)}%;height:100%;background:${_grupoColor(g)}" title="${escH(g)}: ${fmtK(v)}"></div>`;
    }).join('');
    return `<div class="bar-row">
      <span class="bar-lbl">${_monthLabel(m)}</span>
      <div class="bar-track" style="height:14px;border-radius:4px;display:flex;overflow:hidden;width:${pctTotal.toFixed(1)}%">${segments}</div>
      <span class="bar-val">${fmtK(total)}</span>
    </div>`;
  }).join('');

  // ── 4. Top 10 Clientes ─────────────────────────────────
  const hoje = new Date();
  const meses = S.topPeriod === '6m' ? 6 : S.topPeriod === '3m' ? 3 : 1;
  const dtCorte = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1);
  const dtCorteStr = dtCorte.toISOString().split('T')[0];
  const dTop = d.filter(r => (r.data_faturamento || '') >= dtCorteStr);

  const cm = new Map();
  dTop.forEach(r => {
    if (!r.id_cliente) return;
    if (!cm.has(r.id_cliente)) cm.set(r.id_cliente, { nome: r.nome_cliente, fat: 0 });
    cm.get(r.id_cliente).fat += docFat(r);
  });
  const topCli = [...cm.values()].sort((a, b) => b.fat - a.fat).slice(0, 10);
  const topMax = topCli.length ? topCli[0].fat : 1;

  const topHTML = topCli.map((c, i) => {
    const pct = Math.round((c.fat / topMax) * 100);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:10px;font-weight:700;color:var(--text-muted);width:16px;text-align:right">${i + 1}</span>
      <span style="flex:1;font-size:12px;color:var(--text-primary);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(c.nome)}</span>
      <div style="width:80px;flex-shrink:0"><div class="bar-track" style="height:5px"><div class="bar-fill" style="width:${pct}%"></div></div></div>
      <span style="font-size:12px;font-weight:700;color:var(--blue-mid);flex-shrink:0;width:60px;text-align:right">${fmtK(c.fat)}</span>
    </div>`;
  }).join('') || '<p style="color:var(--text-muted);font-size:12px">Sem dados</p>';

  // ── 5/6. Tendência: ÚLTIMOS 30 DIAS vs MÉDIA MENSAL 3 MESES ──
  // Fonte fixa (independe do filtro de período do topo). Base 3m = total 90d ÷ 3.
  const it30  = S.itens30d || [];
  const itB3m = S.itensBase3m || [];

  function _trendPill(delta) {
    if (delta > 900) return `<span class="trend-pill trend-new">Novo</span>`;
    const cls = delta >= 0 ? 'trend-up' : 'trend-down';
    return `<span class="trend-pill ${cls}">${fmtPct(delta)}</span>`;
  }

  // ── Clientes ── (nome resolvido pelo dimMap; a view de itens só traz id_cliente)
  const _cliNome = id => (S.dimMap && S.dimMap.get(id)?.nome_cliente) || `Cliente #${id}`;
  const cliCur = new Map();
  it30.forEach(r => {
    if (!r.id_cliente) return;
    cliCur.set(r.id_cliente, (cliCur.get(r.id_cliente) || 0) + (Number(r.total_item) || 0));
  });
  const cliBase = new Map();
  itB3m.forEach(r => {
    if (!r.id_cliente) return;
    cliBase.set(r.id_cliente, (cliBase.get(r.id_cliente) || 0) + (Number(r.total_item) || 0));
  });

  const cliDeltas = [];
  const MIN_CLI = 500; // piso mensal para evitar ruído
  new Set([...cliCur.keys(), ...cliBase.keys()]).forEach(id => {
    const cur  = cliCur.get(id) || 0;
    const media = (cliBase.get(id) || 0) / 3; // média mensal dos 3 meses
    if (cur < MIN_CLI && media < MIN_CLI) return;
    const delta = media > 0 ? ((cur - media) / media) * 100 : 999; // sem base = cliente novo
    cliDeltas.push({ nome: _cliNome(id), cur, prev: media, delta });
  });

  const crescCliRaw = [...cliDeltas].filter(c => c.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10);
  const quedaCliRaw = [...cliDeltas].filter(c => c.delta < 0 && c.cur > 0).sort((a, b) => a.delta - b.delta).slice(0, 10);
  const churnCli    = [...cliDeltas].filter(c => c.cur === 0 && c.prev > 0).sort((a, b) => b.prev - a.prev);
  const crescCli = _sortArr(crescCliRaw, 'cliCresc');
  const quedaCli = _sortArr(quedaCliRaw, 'cliQueda');

  function _cliRow(c) {
    return `<div style="display:grid;grid-template-columns:1fr 58px 58px 54px;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px">
      <span style="font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escH(c.nome)}">${escH(_truncate(c.nome, 28))}</span>
      <span style="text-align:right;color:var(--text-muted);font-family:'DM Mono',monospace;font-size:10px">${c.prev ? fmtK(c.prev) : '—'}</span>
      <span style="text-align:right;font-family:'DM Mono',monospace;font-weight:600;color:var(--text-primary);font-size:10px">${c.cur ? fmtK(c.cur) : 'R$0'}</span>
      <span style="text-align:right">${_trendPill(c.delta)}</span>
    </div>`;
  }

  function _cliHeader() {
    return `<div style="display:grid;grid-template-columns:1fr 58px 58px 54px;gap:6px;padding:4px 0;border-bottom:2px solid var(--border);margin-bottom:2px;font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em">
      <span>Cliente</span>
      <span style="text-align:right">Média 3M</span>
      <span style="text-align:right">Últ. 30D</span>
      <span style="text-align:right">Var.</span>
    </div>`;
  }

  const sortOptsCli = [{v:'delta',l:'% Delta'},{v:'valor',l:'R$ Valor'}];

  // ── Produtos ──
  const prodCur = new Map();
  it30.forEach(r => {
    const p = (r.produto || '').trim();
    if (!p) return;
    const e = prodCur.get(p) || { fat: 0, qtd: 0 };
    e.fat += Number(r.total_item) || 0;
    e.qtd += Number(r.qtd) || 0;
    prodCur.set(p, e);
  });
  const prodBase = new Map();
  itB3m.forEach(r => {
    const p = (r.produto || '').trim();
    if (!p) return;
    const e = prodBase.get(p) || { fat: 0, qtd: 0 };
    e.fat += Number(r.total_item) || 0;
    e.qtd += Number(r.qtd) || 0;
    prodBase.set(p, e);
  });

  const prodDeltas = [];
  const MIN_PROD = 2000; // piso mensal para evitar ruído
  new Set([...prodCur.keys(), ...prodBase.keys()]).forEach(nome => {
    const cur   = prodCur.get(nome)?.fat || 0;
    const qtd   = prodCur.get(nome)?.qtd || 0;
    const media = (prodBase.get(nome)?.fat || 0) / 3; // média mensal
    const qtdM  = (prodBase.get(nome)?.qtd || 0) / 3;
    if (cur < MIN_PROD && media < MIN_PROD) return;
    const delta = media > 0 ? ((cur - media) / media) * 100 : 999; // sem base = produto novo
    prodDeltas.push({ nome, cur, prev: media, qtd, qtdPrev: qtdM, delta });
  });

  const prodCrescRaw = [...prodDeltas].filter(p => p.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10);
  const prodQuedaRaw = [...prodDeltas].filter(p => p.delta < 0 && p.cur > 0).sort((a, b) => a.delta - b.delta).slice(0, 10);
  const churnProd    = [...prodDeltas].filter(p => p.cur === 0 && p.prev > 0).sort((a, b) => b.prev - a.prev);
  const prodCresc = _sortArr(prodCrescRaw, 'prodCresc');
  const prodQueda = _sortArr(prodQuedaRaw, 'prodQueda');

  // rodapé de churn (zeraram nos últimos 30d, mas vendiam antes)
  function _churnFoot(arr, label) {
    if (!arr.length) return '';
    const top = arr.slice(0, 6).map(x =>
      `<span class="churn-chip" title="${escH(x.nome)} · média ${fmtK(x.prev)}/mês">${escH(_truncate(x.nome, 22))}</span>`
    ).join('');
    const resto = arr.length > 6 ? `<span class="churn-more">+${arr.length - 6}</span>` : '';
    return `<div class="churn-foot">
      <div class="churn-foot-lbl">⚠ ${arr.length} ${label} zeraram <span style="font-weight:500;color:var(--text-muted)">(vendiam, sem compra há 30d)</span></div>
      <div class="churn-chips">${top}${resto}</div>
    </div>`;
  }

  function _prodRow(p) {
    return `<div style="display:grid;grid-template-columns:1fr 40px 58px 58px 54px;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px">
      <span style="font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escH(p.nome)}">${escH(_truncate(p.nome, 30))}</span>
      <span style="text-align:right;color:var(--text-muted);font-size:10px">${p.qtd ? Math.round(p.qtd) : '—'}</span>
      <span style="text-align:right;color:var(--text-muted);font-family:'DM Mono',monospace;font-size:10px">${p.prev ? fmtK(p.prev) : '—'}</span>
      <span style="text-align:right;font-family:'DM Mono',monospace;font-weight:600;color:var(--text-primary);font-size:10px">${p.cur ? fmtK(p.cur) : 'R$0'}</span>
      <span style="text-align:right">${_trendPill(p.delta)}</span>
    </div>`;
  }

  function _prodHeader() {
    return `<div style="display:grid;grid-template-columns:1fr 40px 58px 58px 54px;gap:6px;padding:4px 0;border-bottom:2px solid var(--border);margin-bottom:2px;font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em">
      <span>Produto</span>
      <span style="text-align:right">Qtd</span>
      <span style="text-align:right">Média 3M</span>
      <span style="text-align:right">Últ. 30D</span>
      <span style="text-align:right">Var.</span>
    </div>`;
  }

  const sortOptsProd = [{v:'delta',l:'% Delta'},{v:'valor',l:'R$ Valor'},{v:'qtd',l:'Qtd'}];

  // legenda explicativa do comparativo
  const trailCapHTML = `<div class="panel-cap">Últimos 30 dias vs média mensal dos 3 meses anteriores${S.trailAnchor ? ` · base até ${fmtD(S.trailAnchor)}` : ''}</div>`;

  const emptyMsg = '<p style="color:var(--text-muted);font-size:12px;padding:8px 0">Sem dados comparativos</p>';

  // ── 7. Últimos Pedidos ──────────────────────────────────
  const ultPedidos = d.slice(0, 10).map(r => `<tr>
    <td style="font-size:12px;color:var(--text-secondary)">${fmtD(r.data_faturamento)}</td>
    <td class="r" style="font-weight:700;color:var(--blue-mid);font-size:13px">${fmt(docFat(r))}</td>
    <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;color:var(--text-primary)">${escH(r.nome_cliente || '')}</td>
    <td style="font-size:12px;font-weight:600;color:var(--green)">${sN(r.nome_vendedor)}</td>
  </tr>`).join('');

  // ══════════════════════════════════════════════════════════
  // MONTAR HTML
  // ══════════════════════════════════════════════════════════
  el.innerHTML = `
    <!-- KPIs -->
    <div class="kgrid">
      ${kc('💰', 'Faturamento', fmtK(fat), 'kc-b')}
      ${kc('🛒', 'Pedidos', ped, 'kc-p')}
      ${kc('👥', 'Clientes', cli, 'kc-g')}
      ${kc('🎯', 'Ticket Medio', fmtK(ticket), 'kc-y')}
    </div>

    <!-- Faturamento por Linha -->
    <div class="scard">
      <div class="scard-title">📊 Faturamento por Linha</div>
      <div class="cgrid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        ${linhasHTML || '<p style="color:var(--text-muted);font-size:12px">Sem dados de itens</p>'}
      </div>
    </div>

    <!-- Evolução Mensal -->
    <div class="scard">
      <div class="scard-title">📈 Evolução Mensal</div>
      <div style="margin-bottom:8px">${legendHTML}</div>
      ${evolHTML || '<p style="color:var(--text-muted);font-size:12px">Sem dados</p>'}
    </div>

    <!-- Top 10 Clientes -->
    <div class="scard">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="scard-title" style="margin-bottom:0">🏆 Top 10 Clientes</div>
        <div style="display:flex;gap:4px">
          ${['1m', '3m', '6m'].map(p => `<button onclick="setTopPeriod('${p}')" style="padding:3px 10px;font-size:11px;font-weight:600;border-radius:6px;cursor:pointer;border:1.5px solid ${S.topPeriod === p ? 'var(--blue-dark)' : 'var(--border)'};background:${S.topPeriod === p ? 'var(--blue-dark)' : 'transparent'};color:${S.topPeriod === p ? '#fff' : 'var(--text-secondary)'}">${p}</button>`).join('')}
        </div>
      </div>
      ${topHTML}
    </div>

    <!-- Tendência: Clientes e Produtos (Últimos 30D vs Média 3M) -->
    <div class="trend-section-head">
      <span class="trend-section-title">Tendência — Últimos 30 dias</span>
      ${trailCapHTML}
    </div>

    <!-- Clientes Crescimento / Queda -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="scard scard-up" style="margin-bottom:0">
        <div class="panel-head">
          <div class="scard-title" style="margin-bottom:0">📈 Clientes em Alta</div>
          ${_sortBtns('cliCresc', sortOptsCli)}
        </div>
        ${crescCli.length ? _cliHeader() + crescCli.map(_cliRow).join('') : emptyMsg}
      </div>
      <div class="scard scard-down" style="margin-bottom:0">
        <div class="panel-head">
          <div class="scard-title" style="margin-bottom:0">📉 Clientes em Queda</div>
          ${_sortBtns('cliQueda', sortOptsCli)}
        </div>
        ${quedaCli.length ? _cliHeader() + quedaCli.map(_cliRow).join('') : emptyMsg}
        ${_churnFoot(churnCli, 'clientes')}
      </div>
    </div>

    <!-- Produtos Crescimento / Queda -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="scard scard-up" style="margin-bottom:0">
        <div class="panel-head">
          <div class="scard-title" style="margin-bottom:0">📈 Produtos em Alta</div>
          ${_sortBtns('prodCresc', sortOptsProd)}
        </div>
        ${prodCresc.length ? _prodHeader() + prodCresc.map(_prodRow).join('') : emptyMsg}
      </div>
      <div class="scard scard-down" style="margin-bottom:0">
        <div class="panel-head">
          <div class="scard-title" style="margin-bottom:0">📉 Produtos em Queda</div>
          ${_sortBtns('prodQueda', sortOptsProd)}
        </div>
        ${prodQueda.length ? _prodHeader() + prodQueda.map(_prodRow).join('') : emptyMsg}
        ${_churnFoot(churnProd, 'produtos')}
      </div>
    </div>

    <!-- Últimos Pedidos -->
    <div class="scard">
      <div class="scard-title">📦 Últimos Pedidos</div>
      <div style="overflow-x:auto"><table class="data-table">
        <thead><tr><th>Data</th><th class="r">Valor</th><th>Cliente</th><th>Vendedor</th></tr></thead>
        <tbody>${ultPedidos || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">Sem pedidos no periodo</td></tr>'}</tbody>
      </table></div>
    </div>`;
}
