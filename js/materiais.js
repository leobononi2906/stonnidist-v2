// ═══ STONNI ATACADO — materiais.js ═══
// ══════════════════════════════════════════════════════════
// ABA MATERIAIS (Portal Parceiro) + PERGUNTAR À IA (assist-perguntar)
// Reaproveita a base compartilhada do grupo:
//   - Materiais: tabela public.prt_materiais (SELECT liberado p/ anon)
//   - IA: Edge Function assist-perguntar (exige JWT do usuário logado)
// ══════════════════════════════════════════════════════════

const MAT = { items: [], linha: '', busca: '', loaded: false, loading: false };

const MAT_LINHAS = [
  { key: '',                label: 'Todos',          icon: '📚' },
  { key: 'geladeira',       label: 'Geladeira',      icon: '🧊' },
  { key: 'ar_condicionado', label: 'Ar Condicionado',icon: '❄️' },
  { key: 'gerador',         label: 'Gerador',        icon: '⚡' },
];

// Mapa linha_produto -> rótulo de produto que a IA entende
const MAT_PRODUTO_IA = {
  geladeira: 'Geladeira',
  ar_condicionado: 'Ar Condicionado',
  gerador: 'Gerador',
  '': 'Outros',
};

function _matYtId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}
function _matEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

async function carregarMateriais() {
  const r = await fetch(
    `${window.SUPA_URL}/rest/v1/prt_materiais?select=*&ativo=eq.true&order=ordem.asc,criado_em.desc&limit=9999`,
    { headers: { apikey: window.SUPA_KEY, Authorization: 'Bearer ' + window.SUPA_KEY } }
  );
  if (!r.ok) { console.error('carregarMateriais', r.status, await r.text().catch(()=>'')); return []; }
  return r.json();
}

async function renderMateriais() {
  const el = document.getElementById('materiais-body');
  if (!el) return;

  if (!MAT.loaded) {
    if (MAT.loading) return;
    MAT.loading = true;
    el.innerHTML = '<div class="empty-msg"><div class="spinner" style="margin:0 auto 12px"></div>Carregando materiais...</div>';
    try { MAT.items = await carregarMateriais(); MAT.loaded = true; }
    catch (e) { console.error(e); el.innerHTML = '<div class="empty-msg">Erro ao carregar materiais.</div>'; MAT.loading = false; return; }
    MAT.loading = false;
  }

  const busca = MAT.busca.trim().toLowerCase();
  const lista = MAT.items.filter(m => {
    if (MAT.linha && (m.linha_produto || '') !== MAT.linha) return false;
    if (!busca) return true;
    return [m.titulo, m.descricao, m.modelo, m.categoria].some(c => String(c || '').toLowerCase().includes(busca));
  });

  const chips = MAT_LINHAS.map(l => {
    const n = l.key ? MAT.items.filter(m => (m.linha_produto || '') === l.key).length : MAT.items.length;
    const on = MAT.linha === l.key;
    return `<button onclick="matSetLinha('${l.key}')" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1.5px solid ${on ? 'var(--blue-mid)' : 'var(--border)'};background:${on ? 'var(--blue-pale)' : 'var(--surface)'};color:${on ? 'var(--blue-dark)' : 'var(--text-secondary)'};font-size:12.5px;font-weight:600;cursor:pointer">${l.icon} ${l.label} <span style="opacity:.7;font-weight:500">${n}</span></button>`;
  }).join('');

  const cards = lista.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px">${lista.map(matCard).join('')}</div>`
    : '<div class="empty-msg">Nenhum material encontrado.</div>';

  el.innerHTML = `
    <div class="scard">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <div>
          <div class="scard-title" style="margin-bottom:2px">📚 Materiais de apoio</div>
          <div style="font-size:12px;color:var(--text-muted)">Vídeos, PDFs e guias dos equipamentos Stonni</div>
        </div>
        <button onclick="iaAbrir()" style="display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border:none;border-radius:var(--radius,10px);background:var(--blue-mid);color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15)">🤖 Perguntar à IA</button>
      </div>
      <div class="sbox" style="margin-bottom:12px">
        <span class="si-icon">🔍</span>
        <input type="text" placeholder="Buscar por título, modelo, categoria..." value="${_matEsc(MAT.busca)}" oninput="matBusca(this.value)"/>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${chips}</div>
    </div>
    <div class="scard">${cards}</div>`;
}

function matCard(m) {
  const tipo = (m.tipo || 'link').toLowerCase();
  const titulo = _matEsc(m.titulo || 'Sem título');
  const sub = _matEsc(m.categoria || m.modelo || '');
  let thumb;
  if (tipo === 'video') {
    const id = _matYtId(m.url);
    thumb = id
      ? `<div style="position:relative;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden"><img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover" loading="lazy"/><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="width:46px;height:46px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px">▶</span></div></div>`
      : matThumbIcon('▶', 'VÍDEO', '#dc2626');
  } else if (tipo === 'imagem') {
    thumb = `<div style="aspect-ratio:16/9;background:var(--surface2);border-radius:8px;overflow:hidden"><img src="${_matEsc(m.url)}" style="width:100%;height:100%;object-fit:cover" loading="lazy"/></div>`;
  } else if (tipo === 'pdf') {
    thumb = matThumbIcon('📄', 'PDF', '#0077CC');
  } else {
    thumb = matThumbIcon('🔗', 'LINK', '#16a34a');
  }
  return `<div onclick="matAbrir(${m.id})" title="Abrir" style="cursor:pointer;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface);transition:box-shadow .15s,transform .1s" onmouseover="this.style.boxShadow='0 4px 14px rgba(0,0,0,.12)'" onmouseout="this.style.boxShadow='none'">
    ${thumb}
    <div style="padding:10px 12px">
      <div style="font-size:13px;font-weight:600;color:var(--text-primary);line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${titulo}</div>
      ${sub ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">${sub}</div>` : ''}
    </div>
  </div>`;
}
function matThumbIcon(icon, label, cor) {
  return `<div style="aspect-ratio:16/9;background:var(--surface2);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
    <span style="font-size:32px">${icon}</span>
    <span style="font-size:10px;font-weight:800;letter-spacing:1px;color:${cor}">${label}</span>
  </div>`;
}

function matSetLinha(l) { MAT.linha = l; renderMateriais(); }
function matBusca(v) { MAT.busca = v; renderMateriais(); }

function matAbrir(id) {
  const m = MAT.items.find(x => Number(x.id) === Number(id));
  if (!m) return;
  const tipo = (m.tipo || 'link').toLowerCase();
  if (tipo === 'video') {
    const yt = _matYtId(m.url);
    if (yt) return matVisor(`<div style="position:relative;width:100%;aspect-ratio:16/9;background:#000"><iframe src="https://www.youtube.com/embed/${yt}?autoplay=1" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="autoplay;encrypted-media;fullscreen" allowfullscreen></iframe></div>`, m.titulo);
    return window.open(m.url, '_blank');
  }
  if (tipo === 'imagem') return matVisor(`<img src="${_matEsc(m.url)}" style="max-width:100%;max-height:80vh;display:block;margin:0 auto;border-radius:8px"/>`, m.titulo);
  // pdf e link: abrir em nova aba
  window.open(m.url, '_blank');
}

function matVisor(inner, titulo) {
  let ov = document.getElementById('mat-visor');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'mat-visor';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px';
    ov.onclick = e => { if (e.target === ov) matFecharVisor(); };
    document.body.appendChild(ov);
  }
  ov.innerHTML = `<div style="width:min(880px,100%);background:var(--surface);border-radius:12px;overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)">
      <span style="font-size:13px;font-weight:700;color:var(--text-primary)">${_matEsc(titulo || '')}</span>
      <button onclick="matFecharVisor()" style="background:none;border:none;font-size:20px;color:var(--text-muted);cursor:pointer;line-height:1">×</button>
    </div>
    <div style="padding:0">${inner}</div>
  </div>`;
  ov.style.display = 'flex';
}
function matFecharVisor() { const ov = document.getElementById('mat-visor'); if (ov) { ov.innerHTML = ''; ov.style.display = 'none'; } }

// ── PERGUNTAR À IA (Edge Function assist-perguntar) ──────────
function iaAbrir() {
  let ov = document.getElementById('ia-modal');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ia-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto';
    ov.onclick = e => { if (e.target === ov) iaFechar(); };
    document.body.appendChild(ov);
  }
  const prodDefault = MAT_PRODUTO_IA[MAT.linha] || 'Outros';
  ov.innerHTML = `<div style="width:min(560px,100%);background:var(--surface);border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.35)">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">🤖</span><span style="font-size:15px;font-weight:700;color:var(--text-primary)">Perguntar à IA</span></div>
      <button onclick="iaFechar()" style="background:none;border:none;font-size:20px;color:var(--text-muted);cursor:pointer;line-height:1">×</button>
    </div>
    <div style="padding:16px 18px">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Tira dúvidas técnicas sobre os equipamentos Stonni. A resposta já vem pronta pra mandar pro cliente.</div>
      <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">Produto</label>
      <select id="ia-produto" style="width:100%;height:38px;border:1.5px solid var(--border);border-radius:var(--radius-sm,8px);padding:0 10px;font-size:13px;background:var(--surface2);color:var(--text-primary);outline:none;margin-bottom:12px">
        ${['Ar Condicionado','Geladeira','Gerador','Outros'].map(p => `<option value="${p}"${p === prodDefault ? ' selected' : ''}>${p}</option>`).join('')}
      </select>
      <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px">Pergunta</label>
      <textarea id="ia-pergunta" rows="3" placeholder="Ex: Ar G3 pingando água na cabine, o que faço?" style="width:100%;border:1.5px solid var(--border);border-radius:var(--radius-sm,8px);padding:8px 10px;font-size:13px;background:var(--surface2);color:var(--text-primary);outline:none;resize:vertical;font-family:inherit;box-sizing:border-box" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter')iaPerguntar()"></textarea>
      <button id="ia-btn" onclick="iaPerguntar()" style="margin-top:12px;width:100%;padding:11px;border:none;border-radius:var(--radius,10px);background:var(--blue-mid);color:#fff;font-size:14px;font-weight:700;cursor:pointer">Perguntar</button>
      <div id="ia-resp" style="margin-top:14px"></div>
    </div>
  </div>`;
  ov.style.display = 'flex';
  setTimeout(() => { const t = document.getElementById('ia-pergunta'); if (t) t.focus(); }, 50);
}
function iaFechar() { const ov = document.getElementById('ia-modal'); if (ov) { ov.style.display = 'none'; ov.innerHTML = ''; } }

async function iaPerguntar() {
  const pergunta = (document.getElementById('ia-pergunta')?.value || '').trim();
  const produto = document.getElementById('ia-produto')?.value || undefined;
  const btn = document.getElementById('ia-btn');
  const box = document.getElementById('ia-resp');
  if (!pergunta) { if (box) box.innerHTML = '<div style="font-size:12px;color:var(--red)">Escreva uma pergunta.</div>'; return; }
  btn.disabled = true; btn.textContent = 'Pensando...';
  box.innerHTML = '<div class="empty-msg" style="padding:14px"><div class="spinner" style="margin:0 auto 8px"></div>Consultando a base Stonni...</div>';
  try {
    const { data, error } = await sb.functions.invoke('assist-perguntar', { body: { pergunta, produto } });
    if (error) throw error;
    if (!data || data.ok === false) throw new Error((data && data.erro) || 'Sem resposta.');
    box.innerHTML = iaRespHtml(data);
  } catch (e) {
    console.error('assist-perguntar', e);
    const msg = /401|jwt|auth/i.test(String(e && e.message)) ? 'Sessão expirada — saia e entre de novo pra usar a IA.' : 'Não consegui responder agora. Tente de novo.';
    box.innerHTML = `<div style="font-size:12.5px;color:var(--red);background:var(--red-bg,#fef2f2);border:1px solid var(--border);border-radius:8px;padding:10px 12px">${msg}</div>`;
  } finally { btn.disabled = false; btn.textContent = 'Perguntar'; }
}

function iaRespHtml(d) {
  const conf = { alta: ['Alta', 'var(--green)'], media: ['Média', 'var(--orange)'], baixa: ['Baixa', 'var(--red)'] }[String(d.confianca || '').toLowerCase()] || ['—', 'var(--text-muted)'];
  const videos = Array.isArray(d.videos) ? d.videos.filter(Boolean) : [];
  const resposta = _matEsc(d.resposta || '').replace(/\n/g, '<br>');
  const vids = videos.length
    ? `<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Vídeos relacionados</div>${videos.map(v => {
        const id = _matYtId(v);
        return `<a href="${_matEsc(v)}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12.5px;color:var(--blue-mid);text-decoration:none">▶ ${id ? 'youtu.be/' + id : _matEsc(v)}</a>`;
      }).join('')}</div>`
    : '';
  return `<div style="border:1px solid var(--border);border-radius:10px;padding:14px;background:var(--surface2)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px">Resposta</span>
      <span style="font-size:11px;font-weight:700;color:${conf[1]}">Confiança: ${conf[0]}</span>
    </div>
    <div style="font-size:13.5px;color:var(--text-primary);line-height:1.6">${resposta}</div>
    ${vids}
    <button onclick="iaCopiar(this)" data-resp="${_matEsc(d.resposta || '')}" style="margin-top:12px;padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text-secondary);font-size:12px;font-weight:600;cursor:pointer">📋 Copiar resposta</button>
  </div>`;
}
function iaCopiar(btn) {
  const txt = btn.getAttribute('data-resp') || '';
  navigator.clipboard?.writeText(txt).then(() => { btn.textContent = '✓ Copiado'; setTimeout(() => { btn.textContent = '📋 Copiar resposta'; }, 1500); });
}

// Expor pro onclick inline e pro gotoTab
window.renderMateriais = renderMateriais;
window.matSetLinha = matSetLinha;
window.matBusca = matBusca;
window.matAbrir = matAbrir;
window.matFecharVisor = matFecharVisor;
window.iaAbrir = iaAbrir;
window.iaFechar = iaFechar;
window.iaPerguntar = iaPerguntar;
window.iaCopiar = iaCopiar;
