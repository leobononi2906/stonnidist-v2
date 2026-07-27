# HANDOFF — CRM Atacado (stonnidist-v2)

> Documento pra continuar o trabalho numa **nova conversa**. Última sessão: 26/07/2026.
> Cache-buster atual em produção: **`?v=20260726i`** (Vercel auto-deploy no push da `main`).

---

## 0. Como rodar / onde está
- Código real: `C:\CLAUDE\Projetos GitHub\stonnidist-v2` (clone do repo `leobononi2906/stonnidist-v2`).
- **Push na `main` = produção** (Vercel). Sempre `node --check js/*.js` antes de subir e **bumpar o cache-buster** (`sed -i 's/?v=ANTIGO/?v=NOVO/g' index.html` nos 15 `<script>`).
- App tem login Supabase → **não dá pra testar logado sem credencial do Leo**. Validar sempre via SQL no Supabase (projeto `vishxwdxqiygbxmtpfoy`) antes de codar.
- Arquitetura: HTML/JS puro modular (`js/*.js`), 1 arquivo por área, `try/catch` por tela (bononi-padrão 5.0).

## 1. Arquitetura de dados (o que cada aba usa)
| Fonte (`S.*`) | View/tabela | Escopo |
|---|---|---|
| `S.docs` | `vw_comercial_docs_faturados` | período do topo + vendedor/empresa; dedup por `id_doc`; `tipo_saida=DISTRIBUICAO` |
| `S.itens` / `S.itensPrev` | `vw_comercial_itens_faturados` | mesmo período do topo (com detalhe de produto) |
| `S.itens30d` / `S.itensBase3m` | `vw_comercial_itens_faturados` | janela **últimos 30d vs média 3M**, ancorada na última data faturada (Home tendência) |
| `S.linhas` | `vw_comercial_itens_faturados` | **GLOBAL** (12 meses, ignora filtro do topo) — aba Produtos |
| `S.atividades` | `atac_crm_notas` | período (esforço) |
| `S.contatosUmbler` | `atac_umbler_contatos` | período (esforço) |
| `S.cardOf` / `S.cardMembers` | `atac_card_membro` | mapa de cards (1x na init) |
| `S.nomeCli` | `vw_dim_cliente` | **NOVO** — fallback de nome p/ cliente do ERP fora da `atac_clientes` |

Helpers: `docFat(d)` = `faturamento_liquido ?? faturamento_doc`. Numéricos do Supabase vêm **string** → sempre `Number(...)`. `cardIds(id)` (global, data.js) = todos os ids do card.

## 2. O que foi feito nesta sessão (26/07)

### 2a. Δ R$ (impacto no faturamento) nos comparativos — `home.js`, `linhas.js`, `config.js`, `styles.css`
- **Insight do Leo**: nos comparativos Média 3M × Últ.30D, o dado mais importante é a **diferença em R$** (Últ.30D − média mensal) — é o que sobe/desce no faturamento total. A % sozinha engana (−50% de R$500 é ruído; −8% de R$100k derruba o mês).
- **Home** (clientes e produtos): nova célula **Δ R$** (verde/vermelha, com a % embaixo). Ordenação **padrão = impacto (Δ R$)**. Botões: `Δ R$` · `% Var` · `R$ 30D` (produtos têm `Qtd`).
- **Fix de ordenação (bug real)**: antes cortava o Top 10 **por %** e só depois reordenava → item de % baixa mas R$ alto sumia. Agora `_rankTrend(arr, dir, modo)` filtra → ordena pelo critério → corta 10.
- **Aba Produtos**: coluna **Δ R$** na tabela e no detalhe por subgrupo; ordenação `Δ R$ (impacto)` = maior movimento absoluto (alta ou queda) primeiro; virou default (`config.js linhaSort='impacto'`).

### 2b. Nomes de cliente "Cliente #id" na Home — `data.js`, `config.js`, `home.js`
- Causa: a Home tendência usa a view de itens (só `id_cliente`) e resolvia nome pelo `dimMap` (= `atac_clientes` situação A), que **não tem todos** os clientes do ERP (ex.: 86069 TECNOAR, 40008 L.F. OLIVEIRA; 86857 existe mas inativo/nome vazio).
- Fix: `loadTrailing()` agora resolve os nomes que faltam via `vw_dim_cliente` (tem todos) → `S.nomeCli`. `_cliNome` na home usa `dimMap → nomeCli → "Cliente #id"`.

### 2c. Faturamento consistente entre abas — `vendedores.js`
- **Conferido**: doc-nível e item-nível são **idênticos** (R$899.258,91 em jul/2026). A diferença entre abas é **escopo**, não fonte.
- **Home × Vendedores**: a aba Vendedores só somava distribuidor **ativo**; um representante inativo que faturou (RODRIGO DEON, R$39.392 em jul) sumia. Agora o **KPI Faturamento da aba = total do período (= Home)** e há uma linha **"Inativos / outros"** que reconcilia o ranking.
- **Produtos**: número diferente é **por design** (janela global últimos 30d/12M, ignora filtro do topo). Rótulos já dizem "Últ. 30D".

Memórias criadas/atualizadas: `comparativos-delta-rs-impacto`, `crm-atacado-faturamento-por-aba` (+ já existiam `crm-atacado-card-vs-cliente`, `crm-atacado-umbler-atendente`, `home-comparativo-tendencia`, `vw-itens-sem-nome-cliente`).

## 3. Pendências / próximos passos (backlog)
1. **Clientes/Pedidos KPI da aba Vendedores** ainda são escopo "time ativo" (allowedIds) — só o Faturamento foi reconciliado. Decidir se alinha também (mostrar total do período + card-dedup).
2. **Home "Clientes" KPI** conta `id_cliente` cru (sem dedup de card) → fica maior que a aba Vendedores (que usa `_cardKey`). Alinhar se quiser consistência total.
3. **Produtos** — se a confusão de número persistir, avaliar um pequeno seletor de período na aba OU deixar ainda mais explícito que é "últimos 30 dias / global".
4. **Reativação** (oferecido, não pedido): coluna/painel de clientes que estavam parados, foram atendidos e **voltaram a comprar**.
5. **Home layout**: estender pills/legendas ao resto (KPIs, Evolução Mensal, Top Clientes). Decidir se "Faturamento por Linha" migra pro comparativo 30D×3M.
6. **Aba Produtos**: exportar CSV e/ou clicar num produto pra ver detalhe.
7. Δ Qtd: hoje produtos ordenam por Qtd (30d). Se quiser, adicionar Δ Qtd (variação de quantidade) como coluna/ordenação.

## 4. Armadilhas conhecidas (não repetir)
- `js/vendedores.js` guarda acentos como `\u00XX` em **strings** de template literal (comentários usam acento literal) → editar com âncoras ASCII em blocos pequenos.
- **Umbler → vendedor**: casar `atac_umbler_contatos.nome_atendente` (NOME) com `atac_umbler_vendedor.nome_vendedor_erp`, **não** `usuario_umbler`. Comparar em UPPERCASE.
- **Card**: classificar carteira/compra por `id_cliente` sozinho dá dado errado — usar `cardIds()` (irmão do card conta pro dono).
- `sbQ` já aplica `limit=9999`; `sbInsert/Update/Del/Upsert` existem em `js/supabase.js`.
- Bumpar cache-buster senão o navegador serve JS velho.
