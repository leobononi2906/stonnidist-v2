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

  // ── 5. Crescimento / Queda Clientes ─────────────────────
  const cliCur = new Map();
  itens.forEach(r => {
    if (!r.id_cliente) return;
    if (!cliCur.has(r.id_cliente)) cliCur.set(r.id_cliente, { nome: r.nome_cliente || '', fat: 0 });
    cliCur.get(r.id_cliente).fat += Number(r.total_item) || 0;
  });
  const cliPrev = new Map();
  itensPrev.forEach(r => {
    if (!r.id_cliente) return;
    if (!cliPrev.has(r.id_cliente)) cliPrev.set(r.id_cliente, { nome: r.nome_cliente || '', fat: 0 });
    cliPrev.get(r.id_cliente).fat += Number(r.total_item) || 0;
  });

  const cliDeltas = [];
  cliCur.forEach((cur, id) => {
    const prev = cliPrev.get(id);
    if (prev && prev.fat > 0) {
      cliDeltas.push({ nome: cur.nome, cur: cur.fat, prev: prev.fat, delta: ((cur.fat - prev.fat) / prev.fat) * 100 });
    }
  });

  const crescCliRaw = [...cliDeltas].filter(c => c.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10);
  const quedaCliRaw = [...cliDeltas].filter(c => c.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 10);
  const crescCli = _sortArr(crescCliRaw, 'cliCresc');
  const quedaCli = _sortArr(quedaCliRaw, 'cliQueda');

  function _cliRow(c) {
    const cls = c.delta >= 0 ? 'delta-pos' : 'delta-neg';
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-size:12px;font-weight:500;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(_truncate(c.nome, 28))}</span>
      <span style="font-size:11px;color:var(--text-muted);flex-shrink:0;width:55px;text-align:right;font-family:'DM Mono',monospace">${fmtK(c.cur)}</span>
      <span class="${cls}" style="flex-shrink:0;width:55px;text-align:right">${fmtPct(c.delta)}</span>
    </div>`;
  }

  const sortOptsCli = [{v:'delta',l:'% Delta'},{v:'valor',l:'R$ Valor'}];

  // ── 6. Crescimento / Queda Produtos ─────────────────────
  const prodCur = new Map();
  itens.forEach(r => {
    const p = (r.produto || '').trim();
    if (!p) return;
    const e = prodCur.get(p) || { fat: 0, qtd: 0 };
    e.fat += Number(r.total_item) || 0;
    e.qtd += Number(r.qtd) || 0;
    prodCur.set(p, e);
  });
  const prodPrev = new Map();
  itensPrev.forEach(r => {
    const p = (r.produto || '').trim();
    if (!p) return;
    const e = prodPrev.get(p) || { fat: 0, qtd: 0 };
    e.fat += Number(r.total_item) || 0;
    e.qtd += Number(r.qtd) || 0;
    prodPrev.set(p, e);
  });

  const prodDeltas = [];
  prodCur.forEach((cur, nome) => {
    const prev = prodPrev.get(nome);
    const prevFat = prev ? prev.fat : 0;
    if (cur.fat < 1000 && prevFat < 1000) return;
    if (prevFat > 0) {
      prodDeltas.push({ nome, cur: cur.fat, prev: prevFat, qtd: cur.qtd, qtdPrev: prev ? prev.qtd : 0, delta: ((cur.fat - prevFat) / prevFat) * 100 });
    }
  });
  prodPrev.forEach((prev, nome) => {
    if (!prodCur.has(nome) && prev.fat >= 1000) {
      prodDeltas.push({ nome, cur: 0, prev: prev.fat, qtd: 0, qtdPrev: prev.qtd, delta: -100 });
    }
  });

  const prodCrescRaw = [...prodDeltas].filter(p => p.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10);
  const prodQuedaRaw = [...prodDeltas].filter(p => p.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 10);
  const prodCresc = _sortArr(prodCrescRaw, 'prodCresc');
  const prodQueda = _sortArr(prodQuedaRaw, 'prodQueda');

  function _prodRow(p) {
    const cls = p.delta >= 0 ? 'delta-pos' : 'delta-neg';
    const qtdDelta = p.qtdPrev > 0 ? Math.round(p.qtd - p.qtdPrev) : null;
    const qtdStr = p.qtd ? `${Math.round(p.qtd)} un` : '';
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-size:11px;font-weight:500;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escH(p.nome)}">${escH(_truncate(p.nome, 30))}</span>
      <span style="font-size:10px;color:var(--text-muted);flex-shrink:0;width:45px;text-align:right">${qtdStr}</span>
      ${qtdDelta !== null ? `<span style="font-size:9px;flex-shrink:0;width:35px;text-align:right;color:${qtdDelta>=0?'var(--green)':'var(--red)'}">${qtdDelta>=0?'+':''}${qtdDelta}</span>` : '<span style="width:35px"></span>'}
      <span style="font-size:11px;color:var(--text-muted);flex-shrink:0;width:55px;text-align:right;font-family:'DM Mono',monospace">${fmtK(p.cur)}</span>
      <span class="${cls}" style="flex-shrink:0;width:55px;text-align:right">${fmtPct(p.delta)}</span>
    </div>`;
  }

  function _prodHeader() {
    return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:2px solid var(--border);margin-bottom:2px">
      <span style="flex:1;font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase">Produto</span>
      <span style="font-size:9px;font-weight:700;color:var(--text-muted);width:45px;text-align:right">Qtd</span>
      <span style="font-size:9px;font-weight:700;color:var(--text-muted);width:35px;text-align:right">Dif</span>
      <span style="font-size:9px;font-weight:700;color:var(--text-muted);width:55px;text-align:right">Valor</span>
      <span style="font-size:9px;font-weight:700;color:var(--text-muted);width:55px;text-align:right">Delta</span>
    </div>`;
  }

  const sortOptsProd = [{v:'delta',l:'% Delta'},{v:'valor',l:'R$ Valor'},{v:'qtd',l:'Qtd'}];

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

    <!-- Clientes Crescimento / Queda -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="scard" style="margin-bottom:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div class="scard-title" style="margin-bottom:0">📈 Clientes que mais Cresceram</div>
          ${_sortBtns('cliCresc', sortOptsCli)}
        </div>
        ${crescCli.length ? crescCli.map(_cliRow).join('') : emptyMsg}
      </div>
      <div class="scard" style="margin-bottom:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div class="scard-title" style="margin-bottom:0">📉 Clientes que mais Caíram</div>
          ${_sortBtns('cliQueda', sortOptsCli)}
        </div>
        ${quedaCli.length ? quedaCli.map(_cliRow).join('') : emptyMsg}
      </div>
    </div>

    <!-- Produtos Crescimento / Queda -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="scard" style="margin-bottom:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div class="scard-title" style="margin-bottom:0">📈 Produtos que mais Cresceram</div>
          ${_sortBtns('prodCresc', sortOptsProd)}
        </div>
        ${prodCresc.length ? _prodHeader() + prodCresc.map(_prodRow).join('') : emptyMsg}
      </div>
      <div class="scard" style="margin-bottom:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div class="scard-title" style="margin-bottom:0">📉 Produtos que mais Caíram</div>
          ${_sortBtns('prodQueda', sortOptsProd)}
        </div>
        ${prodQueda.length ? _prodHeader() + prodQueda.map(_prodRow).join('') : emptyMsg}
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
