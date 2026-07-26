# Progresso — CRM Atacado (stonnidist-v2)

> Nota de continuidade entre sessões do Claude Code. Atualizar ao fim de cada etapa.

## Contexto
- Supabase: `vishxwdxqiygbxmtpfoy` · frontend HTML/JS puro (ver `bononi-padrao` seção 5.2)
- App tem login Supabase (não dá pra testar sem credencial do Leo) → validar sempre com query no banco antes de codar.

## ✅ Feito (jul/2026)

### 🔴 CRÍTICO — `js/umbler.js` não fechava a função `removerVincTel`
O arquivo terminava sem o `}` final → **erro de sintaxe ("Unexpected end of input")** → o navegador descartava o `umbler.js` INTEIRO. Consequências: `abrirNovoContato`, `salvarNovoContato`, `toggleVincsTel`, `removerVincTel` etc. ficavam **indefinidos**, e o `exports.js` travava na 1ª referência indefinida (linha 58), deixando de expor tudo depois dela. Sintoma relatado: botão **"Criar Novo"** nos Contatos Sem Tratativa não fazia nada. Corrigido fechando a função. **Lição:** rodar `node --check js/*.js` antes de subir.

### Home — comparativo de tendência (bug "dados zerados")
Eram **2 bugs**, não falta de dado:
1. Janela de comparação: mês parcial vs mês cheio → enchia de `-100%`.
2. Coluna "Cliente" em branco: a view `vw_comercial_itens_faturados` **não tem** `nome_cliente` (só `id_cliente`).

Correções:
- `js/data.js`: novo `loadTrailing()` → **Últimos 30D vs média mensal 3M**, ancorado na última nota (`S.itens30d` / `S.itensBase3m`). `loadDimMap` agora traz `nome_cliente`.
- `js/home.js`: painéis cliente/produto reescritos; nome via `S.dimMap`; quedas ficam **todas na mesma tabela** (quem zerou aparece com Últ.30D = R$0 / -100%, decisão do Leo — sem rodapé separado); pills de variação; labels "Média 3M / Últ. 30D".
- `css/styles.css`: `.trend-pill`, `.scard-up/.scard-down`, `.churn-foot` e afins.

### Aba nova "Linhas" 📊 (jul/2026)
Análise de grupo/subgrupo ao longo do tempo. Arquivo `js/linhas.js` (isolado).
- `data.js`: `loadLinhas()` busca 12 meses de itens numa query só (`S.linhas`). Wired em `refreshDocs` e `gotoTab`.
- `config.js`: estado `linhaGrupo / linhaSubgrupo / linhaJanela / linhaSort`.
- `ui.js gotoTab`: 'linhas' registrado na sidebar/páginas + carga sob demanda.
- `index.html`: nav `si-linhas`, página `pg-linhas`, PAGINAS, `<script src="js/linhas.js">`.
- Tela: chips de Grupo (só participação ≥0,5%) → select Subgrupo → toggle série 6M/12M; 4 KPIs (Últ.30D, Média 3M, Variação, Qtd); gráfico SVG de barras (mês corrente parcial em azul claro); quebra por subgrupo; tabela de produtos ordenável. Mesmo comparativo da Home (30D vs média 3M).

### Ajustes pós-produção (jul/2026)
- **Aba "Linhas" renomeada para "Produtos"** (nav + breadcrumb; id interno segue `linhas`).
- **Aba Produtos agora é GLOBAL**: `loadLinhas` ignora os filtros master (período/vendedor/empresa) e o filtro master fica **escondido** na aba (ui.js gotoTab). Motivo: no login, `aplicarFiltroUsuario` (data.js:50) auto-seta `F.vendedorId`, e isso zerava a aba → subfiltros (6M/grupo) pareciam mortos. A aba tem os próprios subfiltros. `APP.refresh` também recarrega a aba.
- **Bug gráfico "Faturamento por Linha" (Vendedores)**: `total_item` vem como **string** do Supabase; `vendedores.js` somava sem `Number()` → concatenava texto → barra com largura `NaN` → gráfico vazio. Corrigido com `Number(it.total_item)||0` (linhas do grupoMap e do fat prévio). **Regra:** todo `total_item`/`qtd`/numérico do Supabase precisa de `Number(...)` antes de somar.

### Análise de vendedores — esforço × resultado (jul/2026)
Objetivo: medir se o vendedor **trabalha** a carteira ou só **colhe** venda garantida.
- **Filtro de período**: atalhos rápidos Últimos 7/30/90 dias + "📅 Escolher datas" (calendário via input date). `onPeriodChange` em data.js; select sincronizado no `initPeriod`.
- **Painel individual** (`renderVendedorIndividual`): matriz **Trabalhou × Comprou** (🟢 venda ativa / 🟡 passiva / 🔵 prospecção / 🔴 carteira parada) + lista da carteira parada que já faturou. "Falou" = nota OU Umbler no período (fonte não importa; a VENDA não conta como contato — o campo `dias_sem_interacao` da view inclui a compra, por isso uso `nota (S.atividades)` + `ultimo_contato_umbler`). Ritmo já existia (`_renderAtividadeDiaria`).
- **Ranking de equipe** (`renderVendedorTeam`): novas colunas Cobertura % / Venda ativa % / Carteira parada (R$). Substituiu a coluna "% Equipe" (a barra já mostra o share). Computado em `esforco` (Map por vendedor).
- **Regra chave**: "falou" nunca inclui a venda. Comprou = pedido no período (`myDocs`/`S.docs`).

### Card vs cliente + Régua da equipe + drill (jul/2026, commit 226eef1, v=20260726d)
- **A operação trata CARD, não cliente** (`atac_card_membro`: um card agrupa 2-3 cadastros duplicados do ERP). Antes, compra/atividade que caía no cadastro IRMÃO fazia o dono parecer "carteira parada". Ex. real: ZATTAR (dono 77428) parecia parado, mas o irmão 70269 comprou R$317k. `data.js`: `loadCardMap()` (carrega `atac_card_membro` 1x na init) + helper global `cardIds(id)` (todos os ids do card). `vendedores.js`: classificação de carteira (team `esforco` + matriz individual `_comprou`/`_falou`) agora usa `cardIds(...).some(...)`. Contagem de clientes dedupada por card (`_cardKey`). **Regra:** ver memória `crm-atacado-card-vs-cliente`.
- **Régua da Equipe** (modo Todos): card de resumo com médias do time (cobertura, venda ativa, parada total, ticket) + linha "📏 Média da equipe" no topo do ranking; células de cobertura/venda ativa/parada/ticket coloridas por `_relColor` (verde acima da média, vermelho abaixo, neutro perto ±8%).
- **Drill por clique**: clicar na linha do ranking abre o painel individual (`S.vendDrill` + `openVend`/`voltarTime`, botão "‹ Voltar pro ranking"). Filtro do topo continua para login do vendedor. `S.vendDrill` reseta ao entrar na aba (ui.js) e ao trocar o filtro do topo (onVendChange). Usa dados globais já carregados → clique instantâneo. Bloco de expand antigo (`toggleVend`/`S.expandVend`) virou código morto inofensivo.

### Ranking — esforço > colheita + ritmo + fix Umbler (jul/2026, v=20260726g)
- **Colunas novas**: trocado Clientes/Pedidos por **Falados** (nº clientes da carteira atendidos no período) e **Prospecção** (clientes SEM compra atendidos = `falados - venda_ativa`; sinal de caça vs colheita). Ordem: Cobertura · Falados · Prospecção · Ritmo · Venda ativa · Parada · Ticket. Média + cores relativas nas novas.
- **Ritmo (sparkline)**: mini-barras de atividade por semana no período (nota + Umbler), normalizado pelo máximo global → mostra constante vs rajada. Semanas = buckets de 7 dias do período (cap 12).
- **Fix Umbler (importante)**: contato Umbler mapeia pro vendedor por `nome_atendente = nome_vendedor_erp` (nome), **não** `usuario_umbler` (login). Corrigido no sparkline E no painel individual (KPI Contatos Umbler + atividade diária/semanal, que subcontavam). Ver memória `crm-atacado-umbler-atendente`. Achado: só ~2 vendedores registram nota; maioria da atividade é Umbler.

## ⏳ Próximos passos
1. **Estender o layout novo** (pills/legendas) ao resto da Home: KPIs, Faturamento por Linha, Evolução Mensal, Top Clientes, Últimos Pedidos.
2. Decidir se "Faturamento por Linha" (Home) também migra pro comparativo Últ.30D vs Média3M (hoje usa período selecionado).
3. Possível: exportar a análise de Linhas (CSV) e/ou clicar num produto pra ver detalhe.

## Decisões fixadas
- Padrão de comparativo de tendência = **Últimos 30 dias vs média mensal dos 3 meses anteriores**, ancorado na última data faturada.
- Nome de cliente a partir de itens → sempre via `dimMap`/`atac_clientes` (a view de itens não tem nome).
