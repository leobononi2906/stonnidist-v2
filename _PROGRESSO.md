# Progresso — CRM Atacado (stonnidist-v2)

> Nota de continuidade entre sessões do Claude Code. Atualizar ao fim de cada etapa.

## Contexto
- Supabase: `vishxwdxqiygbxmtpfoy` · frontend HTML/JS puro (ver `bononi-padrao` seção 5.2)
- App tem login Supabase (não dá pra testar sem credencial do Leo) → validar sempre com query no banco antes de codar.

## ✅ Feito (jul/2026)

### Home — comparativo de tendência (bug "dados zerados")
Eram **2 bugs**, não falta de dado:
1. Janela de comparação: mês parcial vs mês cheio → enchia de `-100%`.
2. Coluna "Cliente" em branco: a view `vw_comercial_itens_faturados` **não tem** `nome_cliente` (só `id_cliente`).

Correções:
- `js/data.js`: novo `loadTrailing()` → **Últimos 30D vs média mensal 3M**, ancorado na última nota (`S.itens30d` / `S.itensBase3m`). `loadDimMap` agora traz `nome_cliente`.
- `js/home.js`: painéis cliente/produto reescritos; nome via `S.dimMap`; quedas ficam **todas na mesma tabela** (quem zerou aparece com Últ.30D = R$0 / -100%, decisão do Leo — sem rodapé separado); pills de variação; labels "Média 3M / Últ. 30D".
- `css/styles.css`: `.trend-pill`, `.scard-up/.scard-down`, `.churn-foot` e afins.

## ⏳ Próximos passos
1. **Aba nova "Linhas/Produtos"**: filtro cascata Grupo→Subgrupo + série temporal mensal (6/12m) + comparativo Média3M vs Últ.30D por grupo/subgrupo. Obs: `subgrupo` já vem da view `vw_comercial_itens_faturados`, só falta a tela. Usar `dataviz` para os gráficos.
2. **Estender o layout novo** (pills/legendas) ao resto da Home: KPIs, Faturamento por Linha, Evolução Mensal, Top Clientes, Últimos Pedidos.
3. Decidir se "Faturamento por Linha" também migra pro comparativo Últ.30D vs Média3M (hoje usa período selecionado).

## Decisões fixadas
- Padrão de comparativo de tendência = **Últimos 30 dias vs média mensal dos 3 meses anteriores**, ancorado na última data faturada.
- Nome de cliente a partir de itens → sempre via `dimMap`/`atac_clientes` (a view de itens não tem nome).
