// ═══ STONNI ATACADO — ui.js ═══
// ── TOAST ──────────────────────────────────────────────────
function toast(msg,tipo='ok',acao) {
  const el=document.createElement('div');
  el.style.cssText=`position:fixed;bottom:20px;right:20px;z-index:9999;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:opacity .3s;background:${tipo==='err'?'#dc2626':'#16a34a'};color:#fff;display:flex;align-items:center;gap:12px`;
  const txt=document.createElement('span'); txt.textContent=msg; el.appendChild(txt);
  // Carteira e Prospeccao viraram telas separadas: sem isso o card some e o
  // vendedor nao ve pra onde foi.
  if(acao && typeof acao.fn==='function'){
    const b=document.createElement('button');
    b.textContent=acao.texto||'Ver';
    b.style.cssText='background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.4);color:#fff;font-size:12px;font-weight:700;padding:3px 10px;border-radius:6px;cursor:pointer;white-space:nowrap';
    b.onclick=()=>{el.remove();acao.fn();};
    el.appendChild(b);
  }
  document.body.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300);},acao?6000:2500);
}

function gotoTab(tab) {
  S.tab=tab;
  if(window.setPageInfo) window.setPageInfo(tab);
  // sidebar active
  ['home','vendedores','linhas','crm','prospeccao','agenda','config'].forEach(t=>{
    document.getElementById(`si-${t}`)?.classList.toggle('active',t===tab);
  });
  // páginas: pg-home, pg-vendedores, pg-linhas, pg-crm (usa pg-crm.active), pg-config
  ['home','vendedores','linhas','config','agenda'].forEach(t=>{
    const el=document.getElementById(`pg-${t}`);
    if(el){ el.classList.toggle('active',t===tab); }
  });
  // CRM e Prospeccao dividem o mesmo container (lista + drawer);
  // o que muda e qual mainTab fica ativa.
  const crmEl=document.getElementById('pg-crm');
  if(crmEl){ crmEl.classList.toggle('active',tab==='crm'||tab==='prospeccao'); }
  if(tab==='prospeccao') setMainTab('prospeccao');
  else if(tab==='crm' && S.mainTab==='prospeccao') setMainTab('carteira');
  // Filtros: no CRM só vendedor; config oculta tudo; resto mostra tudo
  const tf = document.getElementById('topbar-filters');
  if (tab === 'config' || tab === 'linhas') {
    // Produtos é análise global com subfiltros próprios — não usa o filtro master
    if(tf) tf.style.display = 'none';
  } else if (tab === 'crm' || tab === 'prospeccao') {
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
  if(tab==='home'||tab==='vendedores'){
    // Carrega dados de gestão se ainda não carregados
    if(!S.itens.length) refreshGestao().then(()=>{
      if(tab==='home')renderHome();
      if(tab==='vendedores')renderVendedores();
    }); else {
      if(tab==='home')renderHome();
      if(tab==='vendedores')renderVendedores();
    }
  }
  if(tab==='linhas'){
    if(!S.linhas.length) loadLinhas().then(()=>{ if(window.renderLinhas) renderLinhas(); });
    else if(window.renderLinhas) renderLinhas();
  }
  if(tab==='crm')renderCRM();
  if(tab==='config')renderConfig();
  
}

function setMainTab(tab){
  S.mainTab=tab;
  // a Prospeccao virou item da sidebar: manter os dois em sincronia
  if(tab==='prospeccao') S.tab='prospeccao';
  else if(S.tab==='prospeccao') S.tab='crm';
  document.getElementById('si-crm')?.classList.toggle('active',S.tab==='crm');
  document.getElementById('si-prospeccao')?.classList.toggle('active',S.tab==='prospeccao');
  if(window.setPageInfo) window.setPageInfo(S.tab);
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
  if(ctrlPP) ctrlPP.style.display=(tab==='prospeccao')?'':'none';
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
function atualizaBadgeProsp(){
  const el=document.getElementById('prosp-cnt'); if(!el)return;
  const n=(S.prospGeral||[]).length;
  el.textContent=n;
  el.classList.toggle('hidden',n===0);
}
function setSub(f){S.subFilter=f;document.querySelectorAll('[data-sf]').forEach(el=>el.classList.toggle('on',el.dataset.sf===f));renderLista();}
function setPSub(v){S.pSub=v;document.querySelectorAll('[data-psub]').forEach(el=>el.classList.toggle('on',el.dataset.psub===v));renderLista();}
function setPSort(v){S.pSort=v;renderLista();}
function setCSort(v){S.cSort=v;renderLista();}
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
