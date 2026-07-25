// ═══ STONNI ATACADO — linhas.js ═══
// ══════════════════════════════════════════════════════════
// ABA LINHAS — desempenho de grupo/subgrupo ao longo do tempo
// Fonte: S.linhas (vw_comercial_itens_faturados, últimos 12 meses)
// ══════════════════════════════════════════════════════════

function setLinhaGrupo(g){ S.linhaGrupo = (S.linhaGrupo===g ? '' : g); S.linhaSubgrupo=''; renderLinhas(); }
function setLinhaSubgrupo(sg){ S.linhaSubgrupo = sg || ''; renderLinhas(); }
function setLinhaJanela(n){ S.linhaJanela = Number(n)||12; renderLinhas(); }
function setLinhaSort(v){ S.linhaSort = v; renderLinhas(); }

function _linPill(delta){
  if(delta>900) return `<span class="trend-pill trend-new">Novo</span>`;
  const cls = delta>=0 ? 'trend-up' : 'trend-down';
  return `<span class="trend-pill ${cls}">${fmtPct(delta)}</span>`;
}

// Janelas 30d (atual) e 90d/3 (média mensal), ancoradas na última data dos dados
function _linWindows(rows){
  const p=n=>String(n).padStart(2,'0');
  const fmt=dt=>`${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}`;
  const DAY=86400000;
  let max=''; rows.forEach(r=>{ if((r.data_faturamento||'')>max) max=r.data_faturamento; });
  const anchor = max ? new Date(max+'T12:00:00') : new Date();
  const curStart=new Date(anchor.getTime()-29*DAY);
  const baseEnd =new Date(curStart.getTime()-DAY);
  const baseStart=new Date(baseEnd.getTime()-89*DAY);
  return { anchor:fmt(anchor), curStart:fmt(curStart), curEnd:fmt(anchor), baseStart:fmt(baseStart), baseEnd:fmt(baseEnd) };
}

// Gráfico de barras — série mensal de faturamento (mês corrente marcado como parcial)
function _linSerieSVG(serie, mesCorrente){
  const W=680,H=200,padL=8,padR=8,padT=24,padB=24, n=serie.length||1;
  const max=Math.max(1,...serie.map(s=>s.val));
  const step=(W-padL-padR)/n, gap=Math.min(10,step*0.25), bw=step-gap, plotH=H-padT-padB;
  const bars=serie.map((s,i)=>{
    const x=padL+i*step+gap/2;
    const h=s.val>0?Math.max(2,(s.val/max)*plotH):0;
    const y=padT+plotH-h;
    const parcial=s.ym===mesCorrente;
    const fill=parcial?'var(--blue-light)':'var(--blue-mid)';
    const lbl=s.val>0?fmtK(s.val):'';
    const mLbl=(_monthLabel(s.ym)||'').split('/')[0];
    return `<g><title>${_monthLabel(s.ym)}: ${fmtK(s.val)}${parcial?' (parcial)':''}</title>`+
      (h>0?`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${fill}" fill-opacity="${parcial?'0.5':'1'}"/>`:'')+
      (lbl?`<text x="${(x+bw/2).toFixed(1)}" y="${(y-5).toFixed(1)}" text-anchor="middle" font-size="9" font-family="'DM Mono',monospace" fill="var(--text-secondary)">${lbl}</text>`:'')+
      `<text x="${(x+bw/2).toFixed(1)}" y="${H-9}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${mLbl}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Faturamento mensal" style="display:block;overflow:visible">${bars}</svg>`;
}

function renderLinhas(){
  const el=document.getElementById('linhas-body');
  if(!el) return;
  try{
    const all=S.linhas||[];
    if(!all.length){ el.innerHTML=`<div class="empty-msg" style="padding:48px;text-align:center;color:var(--text-muted)">Sem dados de itens nos últimos 12 meses.</div>`; return; }

    const _q=s=>(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const W=_linWindows(all);
    const g=S.linhaGrupo, sg=S.linhaSubgrupo;
    const sel=all.filter(r=>(!g||(r.grupo||'')===g)&&(!sg||(r.subgrupo||'')===sg));

    // grupos por faturamento total — chips só para participação relevante (≥0,5%); o resto fica em "Todos"
    const gTot=new Map();
    all.forEach(r=>{ const k=(r.grupo||'Sem grupo').trim(); gTot.set(k,(gTot.get(k)||0)+(Number(r.total_item)||0)); });
    const gGrand=[...gTot.values()].reduce((a,b)=>a+b,0)||1;
    const gEntries=[...gTot.entries()].sort((a,b)=>b[1]-a[1]);
    let grupos=gEntries.filter(e=>e[1]/gGrand>=0.005).map(e=>e[0]);
    if(!grupos.length) grupos=gEntries.slice(0,6).map(e=>e[0]);
    // se o grupo selecionado não estiver entre os chips (cauda), inclui para poder desmarcar
    if(g && !grupos.includes(g)) grupos.push(g);

    // subgrupos do grupo selecionado
    let subgrupos=[];
    if(g){
      const sT=new Map();
      all.filter(r=>(r.grupo||'')===g).forEach(r=>{ const k=(r.subgrupo||'Sem subgrupo').trim(); sT.set(k,(sT.get(k)||0)+(Number(r.total_item)||0)); });
      subgrupos=[...sT.entries()].sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
    }

    // série mensal (janela 6/12)
    const Nm=S.linhaJanela||12, now=new Date();
    const months=[];
    for(let i=Nm-1;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }
    const mMap=new Map(months.map(m=>[m,0]));
    sel.forEach(r=>{ const mk=_monthKey(r.data_faturamento); if(mMap.has(mk)) mMap.set(mk,mMap.get(mk)+(Number(r.total_item)||0)); });
    const serie=months.map(m=>({ym:m,val:mMap.get(m)||0}));
    const mesCorrente=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

    // KPIs 30d vs média 3m
    const inCur=r=>r.data_faturamento>=W.curStart&&r.data_faturamento<=W.curEnd;
    const inBase=r=>r.data_faturamento>=W.baseStart&&r.data_faturamento<=W.baseEnd;
    const fat30=sel.filter(inCur).reduce((s,r)=>s+(Number(r.total_item)||0),0);
    const qtd30=sel.filter(inCur).reduce((s,r)=>s+(Number(r.qtd)||0),0);
    const media3=sel.filter(inBase).reduce((s,r)=>s+(Number(r.total_item)||0),0)/3;
    const deltaKpi=media3>0?((fat30-media3)/media3)*100:(fat30>0?999:0);

    // quebra por subgrupo (só quando grupo sem subgrupo)
    let subBreakHTML='';
    if(g&&!sg&&subgrupos.length){
      const cur=new Map(),base=new Map();
      all.filter(r=>(r.grupo||'')===g&&inCur(r)).forEach(r=>{ const k=(r.subgrupo||'Sem subgrupo').trim(); cur.set(k,(cur.get(k)||0)+(Number(r.total_item)||0)); });
      all.filter(r=>(r.grupo||'')===g&&inBase(r)).forEach(r=>{ const k=(r.subgrupo||'Sem subgrupo').trim(); base.set(k,(base.get(k)||0)+(Number(r.total_item)||0)); });
      const totCur=[...cur.values()].reduce((a,b)=>a+b,0)||1;
      const arr=[...new Set([...cur.keys(),...base.keys()])].map(k=>{
        const c=cur.get(k)||0,m=(base.get(k)||0)/3;
        return {k,cur:c,media:m,delta:m>0?((c-m)/m)*100:(c>0?999:0),share:c/totCur*100};
      }).sort((a,b)=>b.cur-a.cur);
      subBreakHTML=`<div class="scard"><div class="scard-title">📦 Por Subgrupo · Últimos 30 dias</div>`+
        arr.map(x=>`<div style="display:grid;grid-template-columns:1fr 62px 62px 56px;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
          <div style="min-width:0"><div class="nm" style="margin-bottom:4px">${escH(_truncate(x.k,34))}</div>
            <div class="bar-track" style="height:5px"><div class="bar-fill" style="width:${Math.round(x.share)}%"></div></div></div>
          <span class="r mut mono">${x.media?fmtK(x.media):'—'}</span>
          <span class="r cur">${x.cur?fmtK(x.cur):'R$0'}</span>
          <span class="r">${_linPill(x.delta)}</span>
        </div>`).join('')+`</div>`;
    }

    // tabela de produtos da seleção
    const cur=new Map(),base=new Map();
    sel.filter(inCur).forEach(r=>{ const k=(r.produto||'').trim(); if(!k)return; const e=cur.get(k)||{fat:0,qtd:0}; e.fat+=Number(r.total_item)||0; e.qtd+=Number(r.qtd)||0; cur.set(k,e); });
    sel.filter(inBase).forEach(r=>{ const k=(r.produto||'').trim(); if(!k)return; const e=base.get(k)||{fat:0}; e.fat+=Number(r.total_item)||0; base.set(k,e); });
    let prods=[...new Set([...cur.keys(),...base.keys()])].map(k=>{
      const c=cur.get(k)||{fat:0,qtd:0}, m=(base.get(k)?.fat||0)/3;
      return {nome:k,cur:c.fat,qtd:c.qtd,media:m,delta:m>0?((c.fat-m)/m)*100:(c.fat>0?999:0)};
    });
    const sort=S.linhaSort||'delta';
    prods.sort((a,b)=> sort==='valor'? b.cur-a.cur : sort==='qtd'? b.qtd-a.qtd : sort==='nome'? a.nome.localeCompare(b.nome) : (b.delta===a.delta? b.cur-a.cur : b.delta-a.delta));

    // ── FILTROS ──
    const grpChips=`<button class="lin-chip${!g?' on':''}" onclick="setLinhaGrupo('')">Todos</button>`+
      grupos.map(gr=>`<button class="lin-chip${g===gr?' on':''}" onclick="setLinhaGrupo('${_q(gr)}')">${escH(gr)}</button>`).join('');
    const subSel= g ? `<span class="lin-sep"></span><select class="lin-select" onchange="setLinhaSubgrupo(this.value)"><option value="">Todos subgrupos</option>`+
      subgrupos.map(s=>`<option value="${escH(s)}"${sg===s?' selected':''}>${escH(s)}</option>`).join('')+`</select>` : '';
    const janBtns=[6,12].map(nn=>`<button class="lin-chip${(S.linhaJanela||12)===nn?' on':''}" onclick="setLinhaJanela(${nn})">${nn}M</button>`).join('');
    const sortSel=`<select class="lin-select" onchange="setLinhaSort(this.value)">
      <option value="delta"${sort==='delta'?' selected':''}>Variação</option>
      <option value="valor"${sort==='valor'?' selected':''}>R$ Últ.30D</option>
      <option value="qtd"${sort==='qtd'?' selected':''}>Qtd</option>
      <option value="nome"${sort==='nome'?' selected':''}>Nome</option></select>`;

    const titulo = sg ? `${g} · ${sg}` : g ? g : 'Todas as linhas';
    const tHead=`<div class="lin-trow lin-thead"><span>Produto</span><span class="r">Qtd</span><span class="r">Média 3M</span><span class="r">Últ.30D</span><span class="r">Var.</span></div>`;
    const tRows=prods.map(p=>`<div class="lin-trow">
      <span class="nm" title="${escH(p.nome)}">${escH(_truncate(p.nome,44))}</span>
      <span class="r mut">${p.qtd?Math.round(p.qtd):'—'}</span>
      <span class="r mut mono">${p.media?fmtK(p.media):'—'}</span>
      <span class="r cur">${p.cur?fmtK(p.cur):'R$0'}</span>
      <span class="r">${_linPill(p.delta)}</span></div>`).join('')
      || `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:12px">Nenhum produto na seleção.</div>`;

    el.innerHTML=`
      <div class="lin-filters">
        ${grpChips}${subSel}
        <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">Série:</span>${janBtns}
      </div>

      <div class="kgrid" style="margin-bottom:16px">
        <div class="kcard kc-b"><div class="lbl">💰 Faturamento · Últ. 30D</div><div class="val">${fmtK(fat30)}</div></div>
        <div class="kcard"><div class="lbl">📊 Média Mensal · 3M</div><div class="val">${fmtK(media3)}</div></div>
        <div class="kcard"><div class="lbl">📈 Variação</div><div class="val" style="font-size:18px">${_linPill(deltaKpi)}</div></div>
        <div class="kcard kc-g"><div class="lbl">📦 Qtd Vendida · 30D</div><div class="val">${Math.round(qtd30)}</div></div>
      </div>

      <div class="scard">
        <div class="panel-head"><div class="scard-title" style="margin-bottom:0">📈 Evolução Mensal · ${escH(titulo)}</div>
          <span style="font-size:11px;color:var(--text-muted)"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--blue-light);opacity:.6;vertical-align:middle;margin-right:3px"></span>mês parcial</span></div>
        ${_linSerieSVG(serie,mesCorrente)}
      </div>

      ${subBreakHTML}

      <div class="scard">
        <div class="panel-head"><div class="scard-title" style="margin-bottom:0">🧾 Produtos · ${escH(titulo)} <span style="color:var(--text-muted);font-weight:600">(${prods.length})</span></div>
          <div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;color:var(--text-muted)">Ordenar</span>${sortSel}</div></div>
        <div class="lin-cap">Últimos 30 dias vs média mensal dos 3 meses anteriores · base até ${fmtD(W.anchor)}</div>
        ${tHead}${tRows}
      </div>`;
  }catch(err){
    console.error('renderLinhas',err);
    if(window.logAcao) try{ logAcao('ERRO_LINHAS',{nivel:'ERROR',erro:err?.message}); }catch(e){}
    el.innerHTML=`<div style="background:var(--red-bg);border:1px solid rgba(217,48,37,.3);border-radius:var(--radius);padding:16px;color:var(--red);font-size:13px">Não foi possível carregar a análise de linhas.<br><span style="color:var(--text-muted);font-size:11px">${escH(err?.message||'')}</span></div>`;
  }
}

window.setLinhaGrupo=setLinhaGrupo;
window.setLinhaSubgrupo=setLinhaSubgrupo;
window.setLinhaJanela=setLinhaJanela;
window.setLinhaSort=setLinhaSort;
window.renderLinhas=renderLinhas;
