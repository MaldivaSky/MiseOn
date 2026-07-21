# MiseOn — Evolução do Sistema de Custeio

## Contexto e Diagnóstico

O sistema já possui uma base robusta:
- **Frontend**: `src/lib/custeio.ts` + `src/lib/unidades.ts` implementam PEPS, BFS de conversão, e conservação dimensional — testados em `custeio.test.ts` e `unidades.test.ts`.
- **Backend SQL**: `20260721240000_unidades_grandezas.sql`, `..._backfill_fatores_conversao.sql` e `..._custeio_peps_lotes.sql` replicam a mesma lógica (BFS → `fn_consumir_lotes_peps`, trava de conservação → `conversao_valida()`).
- **Ledger**: `lancamentos_financeiros` + views `vw_dre_mensal`, `vw_caixa_extrato`, `vw_lucro_real_produto` já existem.
- **Grafo 3D**: `src/lib/estoque3d/` tem engine, tipos e carregador funcionais.

Os três pontos de atenção têm impacto crescente: Testes → Arquitetura → UX.

---

## Open Questions

> [!IMPORTANT]
> **Prioridade de entrega**: As três frentes são independentes entre si. Qual a ordem preferida?
> - **A → B → C** (Testes primeiro, depois arquitetura, depois UX) — caminho conservador
> - **C primeiro** (UX do simulador tem maior impacto perceptível no lojista agora)
> - **B primeiro** (eliminar duplicação traz segurança de longo prazo antes de adicionar features)
> - Executar as três em paralelo (as partes são independentes)

> [!IMPORTANT]
> **Escopo da Edge Function (Frente B)**: O plano propõe expor `calculateItemCost(itemId, quantity, unit, method)` como Edge Function Deno. Isso exige que o frontend **substitua** as chamadas locais a `custoDeUso()` pela chamada HTTP — ou apenas **complementa** (mantém local para UI, usa remoto para persistência)?
>
> Recomendo a abordagem **complementar**: a lógica TypeScript local permanece para cálculos de UI em tempo real (zero latência), e a Edge Function se torna a fonte canônica para **gravar** custos (pedidos, fichas técnicas). Isso elimina a duplicação nos dados gravados sem prejudicar a UX de preenchimento ao vivo.

> [!NOTE]
> **Alerta de desvio (Frente B.2)**: "Desvio significativo entre custo estimado e real" — qual threshold aceitável? Sugerido: ±15% entre `preco_embalagem/qtd_embalagem` (estimado) e `custo_unitario` médio dos lotes recentes. Posso parametrizar por loja (`configuracoes_custo`).

---

## Frente I — Validação e Testes (Imediato)

Rodar os testes existentes e adicionar cenários de borda faltantes.

### Arquivos envolvidos

#### [MODIFY] [custeio.test.ts](file:///c:/Users/rafae/Dev/MiseOn/src/lib/custeio.test.ts)
Adicionar 3 novos `describe`:
1. **Borda de tolerância**: conversão com `multiplicador = 1.0001` (deve passar) vs `1.00011` (deve falhar).
2. **Fallback sem lotes**: item com `lotes: []` → `custoUnitarioBase` lança `ErroCusteio` (já testado) + verificar que `custoDeUso` propaga corretamente.
3. **Cadeia com 3+ passos**: `caixa → kg → g → fatias` percorrendo 3 arestas dinâmicas, verificando que BFS encontra o caminho sem duplicação de custo.

#### [MODIFY] [carregarGrafo.test.ts](file:///c:/Users/rafae/Dev/MiseOn/src/lib/estoque3d/carregarGrafo.test.ts)
Adicionar testes para `reconstruirCadeia` com:
- Cadeia de 3 elos (caixa→kg→g→fatias)
- Ciclo no grafo de fatores (deve retornar `[]` sem travar)
- Item sem fatores (caminho simples: lote = compra)

#### Comandos de validação
```bash
npm test src/lib/custeio.test.ts
npm test src/lib/unidades.test.ts
npm test src/lib/estoque3d/carregarGrafo.test.ts
```

---

## Frente II — Observabilidade e Edge Function (Curto Prazo)

### II.A — View Materializada de Custo Real

#### [NEW] migration `20260722000000_vw_custo_real_estoque.sql`
```sql
-- View de custo médio ponderado atual por insumo (lotes com saldo)
CREATE OR REPLACE VIEW vw_custo_real_estoque AS
SELECT
  i.loja_id,
  i.id AS insumo_id,
  i.nome,
  i.unidade_medida,
  SUM(l.quantidade_restante)                               AS saldo_total,
  SUM(l.custo_unitario * l.quantidade_restante)
    / NULLIF(SUM(l.quantidade_restante), 0)                AS custo_medio_ponderado,
  i.preco_embalagem / NULLIF(i.qtd_embalagem, 0)          AS custo_estimado,
  -- Desvio relativo entre estimado e real (positivo = estimativa acima)
  ROUND(100 * (
    (i.preco_embalagem / NULLIF(i.qtd_embalagem, 0))
    - SUM(l.custo_unitario * l.quantidade_restante) / NULLIF(SUM(l.quantidade_restante), 0)
  ) / NULLIF(
    SUM(l.custo_unitario * l.quantidade_restante) / NULLIF(SUM(l.quantidade_restante), 0),
  0), 2)                                                   AS desvio_pct
FROM insumos i
JOIN lotes_estoque l ON l.insumo_id = i.id AND l.quantidade_restante > 0
GROUP BY i.loja_id, i.id, i.nome, i.unidade_medida, i.preco_embalagem, i.qtd_embalagem;
```

**Alerta automático via Realtime**: configurar `NOTIFY` quando `|desvio_pct| > 15` — o frontend subscreve e exibe um toast `sonner`.

#### [NEW] migration `20260722000100_vw_margem_produto.sql`
Extende `vw_lucro_real_produto` existente, cruzando:
- Custo real dos insumos via `vw_custo_real_estoque`
- Custo direto de `configuracoes_custo` (energia, gás)
- Preço de venda do produto
- Margem bruta líquida calculada

### II.B — Edge Function `custeio-calcular`

#### [NEW] `supabase/functions/custeio-calcular/index.ts`

```typescript
// POST /functions/v1/custeio-calcular
// Body: { insumo_id, quantidade, unidade, metodo: 'PEPS' | 'MEDIO' }
// Retorna: { custo, custo_unitario_base, lotes_consumidos }
```

Implementação em Deno/TypeScript reutilizando a mesma lógica do `fn_consumir_lotes_peps` SQL, mas exposta como API tipada. A função:
1. Carrega `lotes_estoque` e `fatores_conversao` do insumo via `supabase-js`
2. Executa BFS idêntico ao `resolverFator` de `custeio.ts`
3. Aplica PEPS ou Médio conforme parâmetro
4. Retorna custo + breakdown por lote

> [!NOTE]
> O código TypeScript da Edge Function pode importar `custeio.ts` e `unidades.ts` diretamente (Deno suporta imports TypeScript nativos). Isso **elimina a duplicação** por definição — o mesmo código roda no frontend (Vite) e no backend (Deno).

---

## Frente III — UX de Conversões (Evolução)

### III.A — Visualizador de Caminho de Conversão

#### [NEW] `src/components/VisualizadorCaminho.tsx`

Componente SVG/HTML que renderiza a cadeia de conversão de forma linear e legível:

```
┌──────────────┐    ×1000    ┌──────────────┐    ×8     ┌────────────────┐    ×5     ┌──────────────────┐
│  Compra: cx  │ ──────────▶ │  Armazenado  │ ────────▶ │  Quebra: kg   │ ────────▶ │  Uso: fatias     │
│  (1 caixa)   │   1cx=1kg  │  (1 kg)      │  1kg=8un  │  (8 un)       │  1un=5ft  │  (40 fatias)     │
│  R$ 20,00    │            │  R$ 20,00    │           │  R$ 2,50/un   │           │  R$ 0,50/fatia   │
└──────────────┘            └──────────────┘            └────────────────┘            └──────────────────┘
     Física                    Física                      Humana ⚠️                      Humana ⚠️
```

- Arestas **físicas** (kg↔g, L↔ml): badge azul "Física — imutável"
- Arestas **humanas** (un, fatias, semântico): badge laranja "Humana — declarada por você"
- Custo acumulado exibido em cada etapa
- Usa dados de `fatores_conversao` + BFS de `resolverFator`

#### [MODIFY] Integrar em formulário de rendimento de insumos
O componente aparece **ao lado** do formulário de rendimento existente, atualizando em tempo real conforme o lojista define a cadeia.

### III.B — Simulador de Custo em Tempo Real

#### [NEW] `src/components/SimuladorCusto.tsx`

Exibe ao vivo, enquanto o lojista preenche o rendimento:

| Métrica | Fonte |
|---|---|
| Custo atual no estoque (PEPS) | `vw_custo_real_estoque` → `custo_medio_ponderado` |
| Custo estimado próxima compra | `insumos.preco_embalagem / qtd_embalagem` |
| Custo por uso após rendimento | `custoDeUso()` local em tempo real |
| Impacto no CMV do produto | `custoBOM()` com os dados do formulário |

O simulador usa `custoDeUso()` **localmente** (zero latência, nenhuma chamada de rede durante digitação). A persistência final usa a Edge Function para garantir consistência com o backend.

---

## Estratégia de Não-Regressão

A duplicação entre `custeio.ts` e `fn_consumir_lotes_peps` é intencional na transição:
- `custeio.ts` → UI em tempo real (latência zero, offline capable)
- SQL/Edge Function → gravar dados e relatórios oficiais

A inconsistência sistêmica só existe se os dois calculam valores **diferentes para o mesmo input**. Para garantir paridade:
- Os testes da Frente I incluem um `describe('paridade frontend-backend')` que roda ambos e compara os resultados
- A Edge Function da Frente II importa os mesmos módulos TypeScript, eliminando a paridade por construção

---

## Plano de Migração SQL

Todas as migrações são **aditivas** (apenas `CREATE VIEW`, `CREATE FUNCTION`):
- Sem `ALTER TABLE` que bloqueie produção
- Sem `DROP TABLE`
- Idempotentes (com `CREATE OR REPLACE`)

---

## Verificação Final

### Testes automatizados
```bash
npm test                         # suite completa Vitest
npm test src/lib/custeio.test.ts # foco custeio
npm test src/lib/unidades.test.ts # foco unidades
```

### Verificação manual
1. Abrir formulário de rendimento de um insumo → confirmar que `VisualizadorCaminho` renderiza em tempo real
2. Verificar toast de alerta de desvio quando `|desvio_pct| > 15`
3. Confirmar que `vw_custo_real_estoque` retorna valores coerentes com os lotes

### Sem quebra de contrato
- `custeio.ts` e `unidades.ts` mantêm a mesma API pública
- Nenhuma migração remove colunas existentes
- Edge Function é nova rota (`/custeio-calcular`), não substitui rotas existentes
