// ═══ STONNI ATACADO — config-page.js ═══
// ══════════════════════════════════════════════════════════
// ABA CONFIG
// ══════════════════════════════════════════════════════════
async function renderConfig() {
  const el=document.getElementById('cfg-body');if(!el)return;
  el.innerHTML='<div class="empty-msg"><span class="spin">⟳</span> Carregando...</div>';

  // Carrega uvMap atualizado
  await loadUmblerVendMap();

  const uvRows=S.umblerVendMap;
  // Contatos Umbler todos (com e sem vínculo)
  const allUmbl=await sbQ('atac_umbler_contatos','select=telefone,nome_contato,nome_atendente,ultimo_contato,nao_comercial&order=ultimo_contato.desc&limit=50');
  const telVinc=await sbQ('atac_cliente_telefones','select=telefone,nome_cliente');
  const telVincSet=new Set((Array.isArray(telVinc)?telVinc:[]).map(t=>t.telefone));
  const telVincMap=new Map((Array.isArray(telVinc)?telVinc:[]).map(t=>[t.telefone,t.nome_cliente]));

  // Buscar email do usuário logado
  const sess = (await window.sb.auth.getSession()).data.session;
  const emailLogado = sess?.user?.email || '';
  const cfgUsuario = emailLogado ? await sbQ('atac_config_usuario', `select=*&email=eq.${encodeURIComponent(emailLogado)}`) : [];
  const cfgUser = Array.isArray(cfgUsuario) && cfgUsuario.length ? cfgUsuario[0] : null;

  el.innerHTML=`<div style="max-width:680px">

    <!-- Tabs Config -->
    <div style="display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid var(--border);padding-bottom:0">
      <button id="cfg-tab-config" onclick="setCfgTab('config')"
        style="padding:8px 16px;border:none;background:none;cursor:pointer;font-size:12px;font-weight:600;color:var(--blue-dark);border-bottom:2px solid var(--blue-dark);margin-bottom:-2px">
        ⚙️ Configurações
      </button>
      <button id="cfg-tab-vendedores" onclick="setCfgTab('vendedores')"
        style="padding:8px 16px;border:none;background:none;cursor:pointer;font-size:12px;font-weight:600;color:var(--text-muted)">
        👥 Vendedores
      </button>
      <button id="cfg-tab-log" onclick="setCfgTab('log')"
        style="padding:8px 16px;border:none;background:none;cursor:pointer;font-size:12px;font-weight:600;color:var(--text-muted)">
        📋 Log de Ações
      </button>
    </div>

    <!-- Painel Vendedores -->
    <div id="cfg-painel-vendedores" style="display:none">
      <div class="cfg-section">
        <h3>👥 Equipe de Vendas</h3>
        <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">
          Marque como inativo quem saiu da equipe. A carteira dele passa a aparecer na
          <b>Prospecção → Geral</b> para os outros assumirem, sem perder o registro de quem era o dono.
        </p>
        <div id="cfg-vend-body"></div>
      </div>
    </div>

    <!-- Painel Config -->
    <div id="cfg-painel-config">

    <!-- Meu Perfil -->
    <div class="cfg-section">
      <h3>👤 Meu Perfil</h3>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">
        Vincule seu login ao seu vendedor. O CRM abrirá automaticamente filtrado no seu nome.
      </p>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px">Login (e-mail)</label>
          <input type="text" value="${emailLogado}" disabled
            style="width:100%;padding:7px 10px;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text-muted);font-size:12px;box-sizing:border-box">
        </div>
        <div style="flex:1;min-width:200px">
          <label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px">Meu Vendedor</label>
          <select id="cfg-meu-vendedor"
            style="width:100%;padding:7px 10px;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;box-sizing:border-box">
            <option value="">-- Não vincular --</option>
            ${S.vendedores.map(v=>`<option value="${v.id_vendedor}"${cfgUser?.id_vendedor_erp===v.id_vendedor?' selected':''}>${v.nome_vendedor}</option>`).join('')}
          </select>
        </div>
        <div style="padding-top:18px">
          <button onclick="salvarCfgUsuario('${emailLogado}')"
            style="padding:7px 16px;background:var(--blue-dark);color:#fff;border:none;border-radius:var(--radius-sm);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
            Salvar
          </button>
        </div>
      </div>
      ${cfgUser ? `<p style="font-size:11px;color:var(--green);margin-top:8px">✓ Perfil vinculado — CRM abre filtrado em <strong>${cfgUser.nome_vendedor}</strong></p>` : `<p style="font-size:11px;color:var(--text-muted);margin-top:8px">Sem vínculo — CRM abre com filtro "Todos"</p>`}
    </div>

    <!-- Parâmetros CRM -->
    <div class="cfg-section">
      <h3>⚙️ Parâmetros do CRM</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
        ${[
          ['compra_saudavel_dias','Compra Ativo (dias)','Limite para status verde'],
          ['compra_atencao_dias','Compra Atenção (dias)','Limite para amarelo'],
          ['compra_risco_dias','Compra Em Risco / perde vínculo','Limite máximo antes de prospecção'],
          ['interacao_saudavel_dias','Interação Ativo (dias)','Último contato para verde'],
          ['interacao_atencao_dias','Interação Atenção (dias)','Último contato para amarelo'],
          ['prospeccao_prazo_contato_dias','Prazo 1ª interação (dias)','Após atribuição ao vendedor'],
          ['prospeccao_perda_vinculo_dias','Dias para perder vínculo','Sem compra → volta à prospecção'],
        ].map(([k,lbl,hint])=>`
          <div class="cfg-row">
            <div class="cfg-lbl">${lbl}<span class="hint">${hint}</span></div>
            <input class="cfg-input" type="number" min="1" id="cfg-${k}" value="${CFG[k]}" />
          </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <button class="btn-sv" style="width:auto;padding:8px 20px" onclick="saveCfg()">Salvar Configurações</button>
      </div>
    </div>

    <!-- Vínculos Umbler ↔ Vendedor -->
    <div class="cfg-section">
      <h3>🔗 Atendentes Umbler → Vendedores ERP</h3>
      <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Relaciona o ID do membro Umbler ao vendedor do ERP. O <strong>ID Membro</strong> é crítico — a Edge Function usa ele para resolver o atendente.</p>

      <!-- Vendedores SEM vínculo configurado — alerta -->
      ${(()=>{
        const vendSemVinc = S.vendedores.filter(v => !uvRows.some(r => r.id_vendedor_erp === v.id_vendedor));
        return vendSemVinc.length ? `
          <div style="background:var(--orange-bg);border:1px solid rgba(224,123,0,.2);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:12px">
            <p style="font-size:11px;font-weight:700;color:var(--orange);margin-bottom:6px">⚠ Vendedores sem vínculo Umbler:</p>
            ${vendSemVinc.map(v=>`
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px;color:var(--text-primary)">${v.nome_vendedor}</span>
                <button onclick="newUVforVend(${v.id_vendedor},'${esc(v.nome_vendedor)}')"
                  style="font-size:11px;font-weight:600;padding:3px 10px;background:var(--blue-dark);color:#fff;border:none;border-radius:var(--radius-sm);cursor:pointer">
                  + Configurar
                </button>
              </div>`).join('')}
          </div>` : '';
      })()}

      <div id="uv-list" style="display:flex;flex-direction:column;gap:6px">
        ${uvRows.length ? uvRows.map(r=>`
          <div class="uv-row" style="flex-direction:column;align-items:flex-start;gap:6px">
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
              <div>
                <div class="uv-vname">${r.nome_vendedor_erp||'Vendedor #'+r.id_vendedor_erp}</div>
                <div class="uv-umbler" style="display:flex;gap:10px;flex-wrap:wrap">
                  <span>Usuário: <strong>${r.usuario_umbler||'—'}</strong></span>
                  ${r.id_membro_umbler?`<span style="font-family:'DM Mono',monospace;color:var(--text-muted)">ID: ${r.id_membro_umbler}</span>`:'<span style="color:var(--red);font-weight:600">⚠ ID Membro não configurado</span>'}
                  ${r.inbox_umbler?`<span style="color:var(--text-muted)">Inbox: ${r.inbox_umbler}</span>`:''}
                  <span style="${r.ativo?'color:var(--green)':'color:var(--text-muted)'}">${r.ativo?'● Ativo':'○ Inativo'}</span>
                </div>
              </div>
              <div class="uv-acts">
                <button class="btn-sm" onclick="editUV('${r.id}','${esc(r.usuario_umbler||'')}',${r.id_vendedor_erp||0},'${esc(r.id_membro_umbler||'')}','${esc(r.inbox_umbler||'')}',${r.ativo!==false})">✎ Editar</button>
                <button class="btn-sm danger" onclick="delUV('${r.id}')">✕</button>
              </div>
            </div>
          </div>`).join('')
        : '<p style="color:var(--text-muted);font-size:12px;padding:8px 0">Nenhum vínculo cadastrado</p>'}
      </div>
      <button class="btn-sm" style="margin-top:10px;border-color:var(--blue-mid);color:var(--blue-mid)" onclick="newUV()">+ Novo Vínculo</button>
    </div>

    <!-- Contatos Umbler (todos, com/sem vínculo) -->
    <div class="cfg-section">
      <h3>📲 Contatos Umbler Recentes</h3>
      <p style="font-size:11px;color:#64748b;margin-bottom:10px">Todos os contatos recebidos. Verde = vinculado a um cliente. Vermelho = sem vínculo.</p>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:400px;overflow-y:auto">
        ${(Array.isArray(allUmbl)?allUmbl:[]).map(c=>{
          const vinculado = telVincSet.has(c.telefone);
          const nomeCliente = telVincMap.get(c.telefone)||'';
          return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);border-left:3px solid ${vinculado?'var(--green)':'var(--red)'}">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
                <span style="font-size:13px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.nome_contato||'Sem nome'}</span>
                ${vinculado?`<span class="tag-vinc">✓ ${nomeCliente.split(' ').slice(0,2).join(' ')}</span>`:'<span class="tag-semvinc">Sem vínculo</span>'}
              </div>
              <div style="display:flex;gap:10px;font-size:11px;color:var(--text-muted);flex-wrap:wrap">
                <span style="font-family:'DM Mono',monospace">${fmtP(c.telefone)}</span>
                ${c.nome_atendente?`<span>${c.nome_atendente}</span>`:''}
                <span>${fmtDT(c.ultimo_contato)}</span>
              </div>
            </div>
            ${!vinculado?`
              <div style="display:flex;gap:4px;flex-shrink:0">
                <button class="btn-sm" onclick="abrirVinc('${esc(c.telefone)}','${esc(c.nome_contato||'')}','${esc(c.nome_atendente||'')}')">🔗 Vincular</button>
                <button class="btn-sm" style="color:var(--blue-mid)" onclick="abrirNovoContato('${esc(c.telefone)}','${esc(c.nome_contato||'')}','${esc(c.nome_atendente||'')}')">👤 Criar</button>
                <button class="btn-sm danger" onclick="naoComercialConfig('${esc(c.telefone)}')">✕ NC</button>
              </div>`:''}
          </div>`;
        }).join('')||'<p class="empty-msg">Sem contatos recentes</p>'}
      </div>
    </div>

    <!-- Integrações -->
    <div class="cfg-section">
      <h3>🔌 Integrações</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${[['Umbler Talk (WhatsApp)','Edge Function UMBLERATC'],['ERP Firebird → Supabase','Sync automático']].map(([n,d])=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:#0f172a;border:1px solid #334155;border-radius:8px">
            <div><p style="font-size:13px;font-weight:600;color:#e2e8f0">${n}</p><p style="font-size:11px;color:#64748b">${d}</p></div>
            <span style="font-size:10px;background:#05200e;color:#4ade80;border:1px solid #166534;border-radius:999px;padding:2px 8px">Ativo</span>
          </div>`).join('')}
      </div>
    </div>

    </div><!-- fim cfg-painel-config -->

    <!-- Painel Log -->
    <div id="cfg-painel-log" style="display:none">
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <input id="log-filtro" placeholder="Buscar por ação, cliente, vendedor, erro..." 
          style="flex:1;min-width:200px;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px"
          oninput="renderLogAcoes(this.value, document.getElementById('log-nivel')?.value)">
        <select id="log-nivel" 
          style="padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px"
          onchange="renderLogAcoes(document.getElementById('log-filtro')?.value, this.value)">
          <option value="">Todos os níveis</option>
          <option value="INFO">✅ INFO</option>
          <option value="WARN">⚠️ WARN</option>
          <option value="ERROR">❌ ERROR</option>
        </select>
        <button onclick="renderLogAcoes(document.getElementById('log-filtro')?.value, document.getElementById('log-nivel')?.value)"
          style="padding:8px 16px;background:var(--blue-dark);color:#fff;border:none;border-radius:var(--radius-sm);font-size:12px;font-weight:600;cursor:pointer">
          🔄 Atualizar
        </button>
      </div>
      <div id="log-painel" style="margin-bottom:16px"></div>
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-muted);margin-bottom:6px">Registros brutos</div>
      <div id="log-body" style="max-height:600px;overflow-y:auto">
        <div class="empty-msg">Clique em Atualizar para carregar os logs</div>
      </div>
    </div>

  </div>`;
}

async function saveCfg() {
  const keys=['compra_saudavel_dias','compra_atencao_dias','compra_risco_dias','interacao_saudavel_dias','interacao_atencao_dias','prospeccao_prazo_contato_dias','prospeccao_perda_vinculo_dias'];
  for(const k of keys){
    const v=Number(document.getElementById('cfg-'+k)?.value);
    if(isNaN(v)||v<1)continue;
    CFG[k]=v;
    await sbUpsert('atac_config_crm',{chave:k,valor:v},'chave');
  }
  toast('Configurações salvas!');
  // reprocessa status com novos parâmetros
  renderLista();
}


function setCfgTab(tab) {
  const paineis = { config:'cfg-painel-config', vendedores:'cfg-painel-vendedores', log:'cfg-painel-log' };
  const botoes  = { config:'cfg-tab-config',    vendedores:'cfg-tab-vendedores',    log:'cfg-tab-log' };
  if (!document.getElementById(paineis.config)) return;
  for (const k of Object.keys(paineis)) {
    const p = document.getElementById(paineis[k]);
    const b = document.getElementById(botoes[k]);
    const on = (k === tab);
    if (p) p.style.display = on ? 'block' : 'none';
    if (b) {
      b.style.color = on ? 'var(--blue-dark)' : 'var(--text-muted)';
      b.style.borderBottom = on ? '2px solid var(--blue-dark)' : 'none';
      b.style.marginBottom = on ? '-2px' : '0';
    }
  }
  if (tab === 'log')        renderLogAcoes();
  if (tab === 'vendedores') renderVendedoresConfig();
}

async function salvarCfgUsuario(email) {
  const sel = document.getElementById('cfg-meu-vendedor');
  if (!sel) return;
  const idVend = Number(sel.value);
  if (!idVend) {
    await sbDel('atac_config_usuario','email',email);
    toast('Vínculo removido — CRM abrirá sem filtro');
    renderConfig();
    return;
  }
  const nomeVend = S.vendedores.find(v=>v.id_vendedor===idVend)?.nome_vendedor||'';
  await sbUpsert('atac_config_usuario',
    {email, id_vendedor_erp:idVend, nome_vendedor:nomeVend, atualizado_em:new Date().toISOString()},
    'email');
  const f = document.getElementById('f-vend');
  if (f) { f.value = String(idVend); onVendChange(String(idVend)); }
  toast('✅ Perfil salvo — CRM filtrado em ' + nomeVend);
  renderConfig();
}

// vínculos umbler-vendedor
function newUV(){openUV(null,'',null,'','',true);}
function newUVforVend(vendId, vendNome){openUV(null,'',vendId,'','',true);}
function editUV(id,umbler,vendId,idMembro,inbox,ativo){openUV(id,umbler,vendId,idMembro,inbox,ativo);}
function openUV(id,umbler,vendId,idMembro,inbox,ativo){
  const m=document.getElementById('modal-uv');if(!m)return;
  m.dataset.uvid=id||'';
  document.getElementById('uv-umbler').value=umbler||'';
  document.getElementById('uv-title').textContent=id?'Editar Vínculo Umbler':'Novo Vínculo Umbler → Vendedor';
  const idMEl=document.getElementById('uv-id-membro'); if(idMEl) idMEl.value=idMembro||'';
  const inboxEl=document.getElementById('uv-inbox'); if(inboxEl) inboxEl.value=inbox||'';
  const ativoEl=document.getElementById('uv-ativo'); if(ativoEl) ativoEl.checked=ativo!==false;
  const sel=document.getElementById('uv-vend');
  sel.innerHTML='<option value="">Selecione...</option>'+S.vendedores.map(v=>`<option value="${v.id_vendedor}"${v.id_vendedor===vendId?' selected':''}>${v.nome_vendedor}</option>`).join('');
  m.classList.add('open');
}
function closeUV(){document.getElementById('modal-uv')?.classList.remove('open');}
async function saveUV(){
  const id = document.getElementById('modal-uv').dataset.uvid;
  const umbler = document.getElementById('uv-umbler').value.trim();
  const idMembro = document.getElementById('uv-id-membro')?.value?.trim() || null;
  const inboxUmbler = document.getElementById('uv-inbox')?.value?.trim() || null;
  const ativo = document.getElementById('uv-ativo')?.checked !== false;
  const vendId = Number(document.getElementById('uv-vend').value);
  if (!umbler || !vendId) { toast('Preencha usuário e vendedor','err'); return; }
  const vendNome = S.vendedores.find(v=>v.id_vendedor===vendId)?.nome_vendedor||'';
  const payload = { usuario_umbler:umbler, id_vendedor_erp:vendId, nome_vendedor_erp:vendNome,
    id_membro_umbler: idMembro, inbox_umbler: inboxUmbler, ativo };
  if (id && id.length > 0) {
    await sbUpdate('atac_umbler_vendedor','id',id, payload);
  } else {
    await sbInsert('atac_umbler_vendedor', payload);
  }
  toast('Vínculo salvo!');
  closeUV();
  await loadUmblerVendMap();
  renderConfig();
}
async function delUV(id){
  if(!confirm('Remover vínculo Umbler?'))return;
  await sbDel('atac_umbler_vendedor','id',id);
  toast('Removido!');
  await loadUmblerVendMap();
  renderConfig();
}

// ══════════════════════════════════════════════════════════
// AÇÕES CRM
// ══════════════════════════════════════════════════════════

// ── LOG DE AÇÕES ─────────────────────────────────────────────────
async function logAcao(acao, dados={}) {
  try {
    const emailUsuario = S.userEmail || window._userEmail || '';
    const resp = await sbInsert('atac_log_acoes', {
      acao,
      nivel:        dados.nivel        || 'INFO',
      id_cliente:   dados.id_cliente   || null,
      nome_cliente: dados.nome_cliente || null,
      id_vendedor:  dados.id_vendedor  || null,
      nome_vendedor:dados.nome_vendedor|| null,
      email_usuario: emailUsuario,
      detalhe:      dados.detalhe || null,
      erro:         dados.erro         || null,
      criado_em:    new Date().toISOString(),
    });
    if (resp && !resp.ok) {
      const txt = await resp.text().catch(()=>'');
      console.warn('[LOG] Insert falhou:', resp.status, txt);
    }
  } catch(e) {
    console.warn('[LOG] Erro:', e.message);
  }
}

// ── RENDERIZAR ABA LOG ────────────────────────────────────────────
async function renderLogAcoes(filtro='', nivel='') {
  renderLogPainel();
  const el = document.getElementById('log-body');
  if (!el) return;
  el.innerHTML = '<div class="empty-msg"><span class="spin">⟳</span> Carregando logs...</div>';

  let params = 'select=*&order=criado_em.desc&limit=200';
  if (nivel) params += `&nivel=eq.${nivel}`;
  if (filtro) params += `&or=(acao.ilike.*${encodeURIComponent(filtro)}*,nome_cliente.ilike.*${encodeURIComponent(filtro)}*,email_usuario.ilike.*${encodeURIComponent(filtro)}*,erro.ilike.*${encodeURIComponent(filtro)}*)`;

  const logs = await sbQ('atac_log_acoes', params);
  const data = Array.isArray(logs) ? logs : [];
  console.log('[LOG] registros carregados:', data.length);

  if (!data.length) {
    el.innerHTML = '<div class="empty-msg">Nenhum registro encontrado</div>';
    return;
  }

  const corNivel = { INFO:'#0077CC', WARN:'#e07b00', ERROR:'#dc2626' };
  const bgNivel  = { INFO:'#eff6ff', WARN:'#fff7ed', ERROR:'#fef2f2' };

  el.innerHTML = data.map(r => {
    let det = '';
    if (r.detalhe) {
      try {
        const d = typeof r.detalhe === 'string' ? JSON.parse(r.detalhe) : r.detalhe;
        det = Object.entries(d).map(([k,v])=>`<span style="color:#64748b">${k}:</span> <strong>${v}</strong>`).join(' · ');
      } catch(_) { det = String(r.detalhe); }
    }
    const dt = r.criado_em ? new Date(r.criado_em).toLocaleString('pt-BR') : '';
    return `<div style="border:1px solid var(--border);border-left:4px solid ${corNivel[r.nivel]||'#94a3b8'};border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:6px;background:${bgNivel[r.nivel]||'#fff'}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:10px;font-weight:700;color:${corNivel[r.nivel]||'#64748b'};background:${bgNivel[r.nivel]};border:1px solid ${corNivel[r.nivel]||'#e2e8f0'};border-radius:4px;padding:1px 7px">${r.nivel||'INFO'}</span>
          <span style="font-size:12px;font-weight:700;color:var(--text-primary);font-family:'DM Mono',monospace">${r.acao||''}</span>
        </div>
        <span style="font-size:10px;color:var(--text-muted)">${dt}</span>
      </div>
      <div style="font-size:11px;color:var(--text-secondary);display:flex;gap:12px;flex-wrap:wrap">
        ${r.nome_cliente ? `<span>👤 ${r.nome_cliente}${r.id_cliente?' #'+r.id_cliente:''}</span>` : ''}
        ${r.nome_vendedor ? `<span>🧑‍💼 ${r.nome_vendedor}</span>` : ''}
        ${r.email_usuario ? `<span>✉ ${r.email_usuario}</span>` : ''}
      </div>
      ${det ? `<div style="font-size:11px;margin-top:4px;color:var(--text-secondary)">${det}</div>` : ''}
      ${r.erro ? `<div style="font-size:11px;margin-top:4px;color:#dc2626;font-family:'DM Mono',monospace;word-break:break-all">⚠ ${r.erro}</div>` : ''}
    </div>`;
  }).join('');
}

/* ============================================================
   PAINEL DE ERROS AGRUPADOS  (atac_log_painel + atac_log_resolucoes)
   Agrupa por assinatura (acao + erro). Resolver uma vez marca o grupo.
   Se o erro voltar depois do resolvido_em -> status REGRESSAO.
   ============================================================ */

async function renderLogPainel() {
  const el = document.getElementById('log-painel');
  if (!el) return;
  el.innerHTML = '<div class="empty-msg"><span class="spin">⟳</span> Carregando painel de erros...</div>';

  let rows;
  try {
    rows = await sbQ('atac_log_painel', 'select=*&order=ultima_em.desc&limit=9999');
  } catch(e) {
    el.innerHTML = `<div style="background:var(--red-bg);border:1px solid var(--red);border-radius:var(--radius-sm);padding:10px 12px;font-size:12px;color:var(--red)">Falha ao carregar o painel de erros: ${e?.message||e}</div>`;
    return;
  }
  const data = Array.isArray(rows) ? rows : [];

  if (!data.length) {
    el.innerHTML = '<div class="empty-msg">🎉 Nenhum erro registrado</div>';
    return;
  }

  const ordem = { REGRESSAO:0, ABERTO:1, RESOLVIDO:2 };
  data.sort((a,b) => (ordem[a.status]??9) - (ordem[b.status]??9) || (b.ocorrencias||0) - (a.ocorrencias||0));

  const badge = {
    ABERTO:    { txt:'🔴 Aberto',     cor:'var(--red)',    bg:'var(--red-bg)'    },
    REGRESSAO: { txt:'🔁 Regressão',  cor:'var(--orange)', bg:'var(--orange-bg)' },
    RESOLVIDO: { txt:'✅ Resolvido',  cor:'var(--green)',  bg:'var(--green-bg)'  },
  };

  const nAbertos = data.filter(r => r.status !== 'RESOLVIDO').length;

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-muted)">Erros agrupados</span>
      ${nAbertos>0 ? `<span style="font-size:10px;font-weight:700;color:var(--red);background:var(--red-bg);border-radius:20px;padding:1px 8px">${nAbertos} em aberto</span>` : ''}
    </div>
    <div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;background:var(--surface)">
    <table class="data-table">
      <thead><tr>
        <th>Erro</th><th class="r">Ocorr.</th><th class="r">Usuários</th><th>Último</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>
      ${data.map(r => {
        const b  = badge[r.status] || badge.ABERTO;
        const dt = r.ultima_em ? new Date(r.ultima_em).toLocaleString('pt-BR') : '';
        const sig = encodeURIComponent(JSON.stringify({ acao: r.acao||'', erro: r.erro||'' }));
        const reg = r.status === 'REGRESSAO'
          ? `<div style="font-size:10px;color:var(--orange);margin-top:2px">⚠ ${r.ocorrencias_apos_fix||0} ocorrência(s) depois do fix de ${new Date(r.resolvido_em).toLocaleDateString('pt-BR')}</div>` : '';
        const res = (r.status === 'RESOLVIDO' && r.resolvido_em)
          ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">${new Date(r.resolvido_em).toLocaleDateString('pt-BR')}${r.resolvido_por ? ' — '+r.resolvido_por : ''}${r.observacao ? ' · '+r.observacao : ''}</div>` : '';
        return `<tr style="cursor:default">
          <td>
            <div style="font-size:11.5px;font-weight:700;color:var(--text-primary);font-family:'DM Mono',monospace">${r.acao||''}</div>
            <div style="font-size:11px;color:var(--text-secondary);word-break:break-word;max-width:520px">${r.erro||'—'}</div>
            ${reg}${res}
          </td>
          <td class="r mono" style="font-weight:700">${r.ocorrencias||0}</td>
          <td class="r mono">${r.usuarios||0}</td>
          <td style="font-size:11px;color:var(--text-secondary);white-space:nowrap">${dt}</td>
          <td><span style="font-size:10px;font-weight:700;white-space:nowrap;background:${b.bg};color:${b.cor};border-radius:4px;padding:2px 8px">${b.txt}</span></td>
          <td class="r" style="white-space:nowrap">
            ${r.status === 'RESOLVIDO'
              ? `<button onclick="reabrirErro('${sig}')" style="font-size:10.5px;font-weight:600;color:var(--text-secondary);background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px 10px;cursor:pointer">↺ Reabrir</button>`
              : `<button onclick="abrirResolverErro('${sig}')" style="font-size:10.5px;font-weight:600;color:#fff;background:var(--green);border:none;border-radius:var(--radius-sm);padding:4px 10px;cursor:pointer">✓ Resolver</button>`}
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>`;
}

let _errAtual = null;

function abrirResolverErro(sig) {
  try { _errAtual = JSON.parse(decodeURIComponent(sig)); } catch(_) { return; }
  const ov = document.getElementById('modal-resolve-erro');
  if (!ov) return;
  const t = document.getElementById('re-assinatura');
  if (t) t.textContent = `${_errAtual.acao} · ${_errAtual.erro || '—'}`;
  const o = document.getElementById('re-obs');
  if (o) o.value = '';
  ov.classList.add('open');
  setTimeout(()=>o?.focus(), 50);
}

function fecharResolverErro() {
  document.getElementById('modal-resolve-erro')?.classList.remove('open');
  _errAtual = null;
}

async function confirmarResolverErro() {
  if (!_errAtual) return;
  const btn = document.getElementById('re-btn');
  const obs = document.getElementById('re-obs')?.value?.trim() || null;
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
  try {
    await sbUpsert('atac_log_resolucoes', {
      acao:          _errAtual.acao,
      erro:          _errAtual.erro || '',
      resolvido_em:  new Date().toISOString(),
      resolvido_por: S.userEmail || '',
      observacao:    obs,
    }, 'acao,erro');
    await logAcao('RESOLVER_ERRO_LOG', { detalhe: { acao: _errAtual.acao, erro: _errAtual.erro, observacao: obs } });
    toast('✅ Erro marcado como resolvido');
    fecharResolverErro();
    renderLogPainel();
  } catch(e) {
    toast('❌ Falha ao resolver: ' + (e?.message || e), 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Marcar como resolvido'; }
  }
}

async function reabrirErro(sig) {
  let a;
  try { a = JSON.parse(decodeURIComponent(sig)); } catch(_) { return; }
  try {
    await fetch(`${window.SUPA_URL}/rest/v1/atac_log_resolucoes?acao=eq.${encodeURIComponent(a.acao)}&erro=eq.${encodeURIComponent(a.erro||'')}`, {
      method: 'DELETE',
      headers: { apikey: window.SUPA_KEY, Authorization: `Bearer ${await getToken()}` },
    });
    await logAcao('REABRIR_ERRO_LOG', { detalhe: { acao: a.acao, erro: a.erro } });
    toast('↺ Erro reaberto');
    renderLogPainel();
  } catch(e) {
    toast('❌ Falha ao reabrir: ' + (e?.message || e), 'err');
  }
}

/* ============================================================
   CONFIG > VENDEDORES — ativar / inativar equipe
   Inativo = carteira dele cai na Prospecção Geral para garimpo,
   mantendo o registro de quem era o dono.
   ============================================================ */

async function renderVendedoresConfig() {
  const el = document.getElementById('cfg-vend-body');
  if (!el) return;
  el.innerHTML = '<div class="empty-msg"><span class="spin">⟳</span> Carregando equipe...</div>';

  let lista;
  try {
    lista = await sbQ('atac_vendedores_painel', 'select=*');
  } catch(e) {
    el.innerHTML = `<div style="background:var(--red-bg);border:1px solid var(--red);border-radius:var(--radius-sm);padding:10px 12px;font-size:12px;color:var(--red)">Falha ao carregar: ${e?.message||e}</div>`;
    return;
  }
  lista = Array.isArray(lista) ? lista : [];
  S.vendPainel = lista;

  const money = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});
  const dt = s => s ? new Date(s+'T00:00:00').toLocaleDateString('pt-BR') : '—';

  const linha = u => {
    const semLogin = !u.email || String(u.email).endsWith('@stonni.local');
    // carteira: quando inativo o vinculo continua, mas a view zera o responsavel efetivo.
    // mostrar o que ele AINDA segura, senao nao da pra saber o tamanho do que foi solto.
    const n = u.ativo ? u.carteira_ativa : u.carteira_vinculada;
    const fora = !u.no_filtro_atacado;
    return `<tr>
      <td>
        <div style="font-weight:700;font-size:12px;color:var(--text-primary)">${escH(u.nome_vendedor||'—')}</div>
        <div style="font-size:10px;color:var(--text-muted);font-family:'DM Mono',monospace">ID ${u.id_vendedor_erp}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px">
          ${escH(u.departamento||'—')}${fora?' <span style="color:var(--warning);font-weight:600">· fora do atacado</span>':''}
        </div>
      </td>
      <td style="font-size:11px;color:${semLogin?'var(--text-muted)':'var(--text-secondary)'}">${semLogin?'— sem login —':escH(u.email)}</td>
      <td class="r mono" style="font-weight:700">
        ${n}${!u.ativo && n>0 ? '<div style="font-size:9px;font-weight:600;color:var(--warning);white-space:nowrap">no balcão</div>' : ''}
      </td>
      <td class="r mono cfg-vend-erp" style="font-size:11px;white-space:nowrap">${u.clientes_erp||0}</td>
      <td class="r mono cfg-vend-erp" style="font-size:11px;white-space:nowrap">${money(u.faturamento_erp)}</td>
      <td class="r mono cfg-vend-erp" style="font-size:11px;white-space:nowrap">${dt(u.ultima_venda_erp)}</td>
      <td>${u.ativo
        ? '<span style="font-size:10px;font-weight:700;background:var(--green-bg);color:var(--green);border-radius:4px;padding:2px 8px;white-space:nowrap">✅ Ativo</span>'
        : '<span style="font-size:10px;font-weight:700;background:var(--surface2);color:var(--text-muted);border-radius:4px;padding:2px 8px;white-space:nowrap">⛔ Inativo</span>'}</td>
      <td class="r cfg-vend-acao">
        <button onclick="abrirToggleVendedor(${u.id_vendedor_erp})"
          style="font-size:10.5px;font-weight:600;padding:5px 12px;border-radius:var(--radius-sm);cursor:pointer;white-space:nowrap;border:1px solid ${u.ativo?'var(--red)':'var(--green)'};background:var(--surface);color:${u.ativo?'var(--red)':'var(--green)'}">
          ${u.ativo ? 'Inativar' : 'Reativar'}
        </button>
      </td>
    </tr>`;
  };

  const semLoginLista = lista.filter(u => u.ativo && (!u.email || String(u.email).endsWith('@stonni.local')));

  el.innerHTML = `
    <style>
      .cfg-vend-acao{position:sticky;right:0;background:var(--surface);box-shadow:-6px 0 8px -6px rgba(0,0,0,.18);z-index:2}
      thead .cfg-vend-acao{background:var(--surface2)}
      .data-table tr:hover .cfg-vend-acao{background:#F8FAFC}
      @media(max-width:900px){ .cfg-vend-erp{display:none} }
    </style>
    <div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow-x:auto;background:var(--surface);margin-bottom:14px">
      <table class="data-table">
        <thead><tr>
          <th>Vendedor</th><th>Login</th><th class="r">Carteira</th>
          <th class="r cfg-vend-erp">Clientes ERP</th><th class="r cfg-vend-erp">Faturamento</th><th class="r cfg-vend-erp">Última venda</th>
          <th>Status</th><th class="cfg-vend-acao"></th>
        </tr></thead>
        <tbody>
        ${lista.length ? lista.map(linha).join('')
          : '<tr><td colspan="8"><div class="empty-msg">Nenhum vendedor</div></td></tr>'}
        </tbody>
      </table>
    </div>

    <p style="font-size:10.5px;color:var(--text-muted);margin-bottom:12px">
      A lista mostra todo mundo do <strong>DISTRIBUIDOR</strong> e <strong>DISTRIBUIÇÃO REPRESENTANTES</strong>,
      mais qualquer um que tenha cliente na carteira do CRM — mesmo de outro setor.
      <strong>Carteira</strong> é o CRM; <strong>Clientes ERP</strong> e <strong>Faturamento</strong> vêm do ERP (distribuição).
    </p>

    ${semLoginLista.length ? `
    <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px">Cadastrar login</label>
        <select id="cfg-add-vend" class="cfg-input" style="width:100%">
          <option value="">Selecione...</option>
          ${semLoginLista.map(v=>`<option value="${v.id_vendedor_erp}">${escH(v.nome_vendedor)}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1;min-width:200px">
        <label style="font-size:11px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px">Login (e-mail)</label>
        <input id="cfg-add-email" class="cfg-input" style="width:100%" placeholder="vendedor@stonni.com.br">
      </div>
      <button onclick="addVendedorConfig()"
        style="padding:8px 14px;background:var(--blue-dark);color:#fff;border:none;border-radius:var(--radius-sm);font-size:12px;font-weight:600;cursor:pointer">
        Salvar login
      </button>
    </div>
    <p style="font-size:10.5px;color:var(--text-muted);margin-top:8px">
      Sem login o vendedor não consegue usar o filtro "meus clientes". Representante não precisa de login para ser inativado.
    </p>` : ''}`;
}

// Modal HTML — confirm() nativo nao e confiavel no Safari iOS (bononi-padrao)
function confirmarModal({titulo, corpo, okTexto, okCor}) {
  return new Promise(res => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    div.innerHTML = `<div style="background:var(--surface);border-radius:var(--radius);padding:22px;max-width:420px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.3)">
      <h3 style="font-size:15px;font-weight:700;color:var(--text-primary);margin:0 0 10px">${titulo}</h3>
      <div style="font-size:12.5px;color:var(--text-secondary);line-height:1.55;margin-bottom:18px">${corpo}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="_cm_n" style="padding:8px 18px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface2);color:var(--text-secondary);font-size:12px;font-weight:600;cursor:pointer">Cancelar</button>
        <button id="_cm_s" style="padding:8px 18px;border-radius:var(--radius-sm);border:none;background:${okCor||'var(--blue-dark)'};color:#fff;font-size:12px;font-weight:600;cursor:pointer">${okTexto||'Confirmar'}</button>
      </div></div>`;
    document.body.appendChild(div);
    const fim = v => { div.remove(); res(v); };
    div.querySelector('#_cm_s').onclick = () => fim(true);
    div.querySelector('#_cm_n').onclick = () => fim(false);
    div.onclick = e => { if (e.target === div) fim(false); };
  });
}

async function abrirToggleVendedor(idErp) {
  const u = (S.vendPainel||[]).find(x => Number(x.id_vendedor_erp) === Number(idErp));
  if (!u) { toast('Vendedor não encontrado','err'); return; }
  const ativar = !u.ativo;
  const n = ativar ? u.carteira_vinculada : u.carteira_ativa;

  const corpo = ativar
    ? `Os <strong>${n}</strong> cliente(s) que ainda estão vinculados a <strong>${escH(u.nome_vendedor)}</strong> voltam para a carteira dele e saem da Prospecção.`
    : `<div style="background:var(--warning-bg,#FEF5E7);border-left:3px solid var(--warning);padding:9px 11px;border-radius:4px;margin-bottom:12px">
         Os <strong>${n}</strong> cliente(s) da carteira de <strong>${escH(u.nome_vendedor)}</strong> caem na
         <strong>Prospecção</strong> na hora, para qualquer vendedor assumir.
       </div>
       Nada é apagado — fica registrado que ele era o dono, e o card mostra "era de ${escH(sN(u.nome_vendedor))}".`;

  const ok = await confirmarModal({
    titulo: ativar ? `Reativar ${sN(u.nome_vendedor)}?` : `Inativar ${sN(u.nome_vendedor)}?`,
    corpo,
    okTexto: ativar ? 'Reativar' : `Inativar e soltar ${n}`,
    okCor: ativar ? 'var(--green)' : 'var(--red)',
  });
  if (!ok) return;

  try {
    // Representante nao tem login. Sem cadastro em atac_config_usuario a view
    // trata como ativo (COALESCE(ativo,true)) e nao ha como inativar — por isso o upsert.
    const email = u.email || `id${u.id_vendedor_erp}.semlogin@stonni.local`;
    await sbUpsert('atac_config_usuario', {
      email,
      id_vendedor_erp: u.id_vendedor_erp,
      nome_vendedor: u.nome_vendedor,
      ativo: ativar,
      atualizado_em: new Date().toISOString(),
    }, 'email');

    await logAcao(ativar ? 'REATIVAR_VENDEDOR' : 'INATIVAR_VENDEDOR', {
      id_vendedor: u.id_vendedor_erp,
      nome_vendedor: u.nome_vendedor,
      detalhe: { clientes_na_carteira: n, era_cadastrado: !!u.cadastrado, departamento: u.departamento }
    });
    toast(ativar ? `✅ ${sN(u.nome_vendedor)} reativado` : `⛔ ${sN(u.nome_vendedor)} inativado — ${n} cliente(s) no balcão`);
    await renderVendedoresConfig();
    Promise.all([loadCarteira(), loadProspeccao()]).then(()=>renderLista()).catch(()=>{});
  } catch(e) {
    toast('❌ Falha: ' + (e?.message || e), 'err');
  }
}

async function addVendedorConfig() {
  const idVend = Number(document.getElementById('cfg-add-vend')?.value || 0);
  const email  = (document.getElementById('cfg-add-email')?.value || '').trim().toLowerCase();
  if (!idVend) { toast('Selecione um vendedor','err'); return; }
  if (!email || !email.includes('@')) { toast('Informe um e-mail válido','err'); return; }
  const u = (S.vendPainel||[]).find(x => Number(x.id_vendedor_erp) === idVend);
  const nome = u?.nome_vendedor || '';
  try {
    if (u && u.email && String(u.email).endsWith('@stonni.local')) {
      await sbDel('atac_config_usuario', 'email', u.email);
    }
    await sbUpsert('atac_config_usuario', {
      email, id_vendedor_erp: idVend, nome_vendedor: nome,
      ativo: u ? !!u.ativo : true,
      atualizado_em: new Date().toISOString()
    }, 'email');
    await logAcao('ADICIONAR_VENDEDOR', { id_vendedor: idVend, nome_vendedor: nome, detalhe: { email } });
    toast(`✅ Login de ${sN(nome)} cadastrado`);
    await renderVendedoresConfig();
  } catch(e) {
    toast('❌ Falha ao adicionar: ' + (e?.message || e), 'err');
  }
}
