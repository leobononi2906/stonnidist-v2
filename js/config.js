// ═══ STONNI ATACADO — config.js ═══
// ═══════════════════════════════════════════════════════════
// STONNI ATACADO — crm.js  v4
// window.SUPA_URL, window.SUPA_KEY, window.sb → index.html
// ═══════════════════════════════════════════════════════════

// ── CONFIG DEFAULTS (overridden by atac_config_crm) ────────
const CFG = {
  compra_saudavel_dias: 60,
  compra_atencao_dias: 90,
  compra_risco_dias: 180,
  interacao_saudavel_dias: 30,
  interacao_atencao_dias: 60,
  prospeccao_prazo_contato_dias: 15,
  prospeccao_perda_vinculo_dias: 180,
};

// ── FILTROS GLOBAIS ────────────────────────────────────────
const F = {
  period: 'mes_atual',
  dtStart: '', dtEnd: '',
  vendedorId: null,  // number | null
  empresaId: null,   // number | null
};

// ── ESTADO ─────────────────────────────────────────────────
const S = {
  tab: 'home',
  docs: [], vendedores: [], empresas: [], dimMap: new Map(),
  carteira: [], prospeccao: [], umbler: [], umblerVendMap: [], vendPainel: [],
  meuVendedor: null,   // {id, nome} do login — nao confundir com F.vendedorId, que e filtro de tela
  meuNome: '',         // nome de quem esta logado — usado em criado_por
  dupSugestao: null,   // sugestao de card duplicado no cliente aberto
  notas: [], telefones: [], pedidos: [], vinculosERP: [], membrosSecundarios: [], umblerTelMap: new Map(), finAlerta: null, _descartarMotivo: '',  // vínculos ERP do cliente aberto
  overdueIds: new Set(),
  mainTab: 'carteira',  // 'carteira' | 'prospeccao' | 'agenda'
  topPeriod: '1m',       // período do Top 10 Clientes
  subFilter: 'todos',
  pSub: 'todos', pSort: 'nome_az', cSort: 'contato_ant',
  search: '',
  selId: null, selCliente: null,
  expandVend: null,
  vendDrill: null,
  cardOf: new Map(), cardMembers: new Map(),
  nomeCli: new Map(),  // fallback de nome de cliente do ERP (vw_dim_cliente) p/ ids fora da atac_clientes
  umblerOpen: true,
  // prospecção geral (sem vendedor) e vencidos (prazo expirado)
  prospGeral: [],
  prospVencidos: new Set(),
  // CPF filtrado direto na view atac_crm_clientes (campo nao_comercial)
  // modal novo contato umbler
  novoContatoTel: null,
  novoContatoNome: '',
  novoContatoAtend: '',
  // ── GESTÃO (Home + Vendedores) ──
  itens: [],          // vw_comercial_itens_faturados no período
  itensPrev: [],      // mesma view, período anterior (para comparativo)
  atividades: [],     // atac_crm_notas no período
  contatosUmbler: [], // atac_umbler_contatos no período
  // ── LINHAS (análise por grupo/subgrupo ao longo do tempo) ──
  linhas: [],         // vw_comercial_itens_faturados dos últimos 12 meses
  linhaGrupo: '',     // grupo selecionado ('' = todos)
  linhaSubgrupo: '',  // subgrupo selecionado ('' = todos)
  linhaJanela: 12,    // meses exibidos na série (6 | 12)
  linhaSort: 'impacto', // ordenação da tabela de produtos (Δ R$ = maior impacto no faturamento)
};

// ── FORMATADORES ───────────────────────────────────────────
const R = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const fmt  = v => (v==null||isNaN(v))?'—':R.format(v);
const fmtK = v => { if(v==null||isNaN(v))return'—';const a=Math.abs(v);if(a>=1e6)return`R$${(v/1e6).toFixed(1)}M`;if(a>=1e3)return`R$${(v/1e3).toFixed(0)}k`;return fmt(v);};
const fmtD = d => { if(!d)return'—';return new Date(d.substring(0,10)+'T12:00:00').toLocaleDateString('pt-BR');};
const fmtDT= d => { if(!d)return'—';const dt=new Date(d);return`${dt.toLocaleDateString('pt-BR')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;};
const fmtP = p => { if(!p)return'—';const d=p.replace(/\D/g,'');if(d.length===11)return`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;if(d.length===10)return`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;return p;};
const fmtC = v => { if(!v)return'—';const d=v.replace(/\D/g,'');if(d.length===14)return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');return v;};
const sN   = n => { if(!n)return'—';const p=n.trim().split(' ');if(p.length===1)return p[0];return`${p[0]} ${p[p.length-1][0]}.`;};
const dias = d => { if(!d)return 9999;return Math.floor((Date.now()-new Date(d.substring(0,10)+'T12:00:00').getTime())/86400000);};
const docFat = d => d?.faturamento_liquido ?? d?.faturamento_doc ?? 0;
const fmtPct = p => { if(p==null||isNaN(p))return'—';return(p>0?'+':'')+p.toFixed(0)+'%'; };
const esc  = s => (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
const escH = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── STATUS (dois semáforos) ────────────────────────────────
function getStatusCompra(d) {
  if(d<=CFG.compra_saudavel_dias) return 'SAUDAVEL';
  if(d<=CFG.compra_atencao_dias)  return 'ATENCAO';
  if(d<=CFG.compra_risco_dias)    return 'RISCO';
  return 'PERDIDO';
}
function getStatusInteracao(d) {
  if(d<=CFG.interacao_saudavel_dias) return 'SAUDAVEL';
  if(d<=CFG.interacao_atencao_dias)  return 'ATENCAO';
  return 'FRIO';
}
function getStatus(c) {
  const dc = c.dias_sem_compra ?? dias(c.ultima_compra);
  const di = c.dias_sem_interacao ?? dc;
  if(dc > CFG.compra_risco_dias) return 'PROSPECCAO';
  const lvl = ['SAUDAVEL','ATENCAO','RISCO','FRIO','PERDIDO'];
  const pior = Math.max(lvl.indexOf(getStatusCompra(dc)), lvl.indexOf(getStatusInteracao(di)));
  if(pior<=0) return 'ATIVO';
  if(pior<=2) return 'ATENCAO';
  return 'PERDIDO';
}
function bdg(s) {
  const m = {ATIVO:['bdg-a','Ativo'],ATENCAO:['bdg-t','Atenção'],PERDIDO:['bdg-r','Em Risco'],PROSPECCAO:['bdg-p','Prospecção']};
  const [cls,lbl]=m[s]||m.PROSPECCAO;
  return `<span class="bdg ${cls}">${lbl}</span>`;
}
function tipoBdg(t) {
  const m={OBSERVACAO:'bdg-obs',TAREFA:'bdg-tar',FOLLOWUP:'bdg-fol',LIGACAO:'bdg-lig',SISTEMA:'bdg-sis'};
  return `<span class="bdg-tipo ${m[t]||'bdg-obs'}">${t}</span>`;
}
function semaforo(c) {
  const dc=c.dias_sem_compra??dias(c.ultima_compra);
  const di=c.dias_sem_interacao??dc;
  const sc=getStatusCompra(dc); const si=getStatusInteracao(di);
  const cls={SAUDAVEL:'sem-ok',ATENCAO:'sem-at',RISCO:'sem-ri',FRIO:'sem-ri',PERDIDO:'sem-ri'};
  return `<div class="semaforo">
    <span class="sem-item ${cls[sc]}" title="Compra: ${dc}d">🛒 ${dc}d</span>
    <span class="sem-item ${cls[si]}" title="Interação: ${di}d">💬 ${di}d</span>
  </div>`;
}
