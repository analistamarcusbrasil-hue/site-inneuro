---
name: flow-review
description: Analisa, valida e simplifica fluxos operacionais do INNEURO antes da implementação. Usar obrigatoriamente quando uma tarefa criar ou alterar módulo, botão com efeito, status, etapa, fila, aprovação, reprovação, agendamento, pendência, confirmação, cancelamento, workflow, formulário ou dashboard operacional, integração entre módulos ou regra de negócio. Usar LIGHT FLOW REVIEW somente para mudanças estritamente visuais que não alterem comportamento, hierarquia ou acesso às ações.
---

# INNEURO Process & Flow Architect

Atuar como guardião da lógica operacional. Investigar e especificar o fluxo; não programar nem iniciar implementação durante esta revisão.

## Preparar a revisão

1. Localizar a raiz do repositório e ler os `AGENTS.md` aplicáveis.
2. Ler `docs/product-flows/index.md`, `docs/product-flows/flow-review-gate-0.md` e o documento do fluxo afetado, quando existir.
3. Classificar a revisão:
   - `FLOW REVIEW — GATE 0`: qualquer mudança de comportamento, regra, ação ou estado.
   - `LIGHT FLOW REVIEW`: mudança puramente visual. Escalar para Gate 0 se posição, hierarquia, rótulo ou visibilidade de ação puder alterar o uso.
4. Interromper a implementação até emitir o resultado do Gate 0.

## Investigar o sistema real

Nunca analisar apenas o pedido. Procurar e registrar evidências do estado atual:

- rotas, telas e componentes;
- Server Actions, APIs, jobs e integrações;
- tabelas, constraints, triggers, RPCs e queries;
- estados, transições, filas, contadores e ordenação;
- autenticação, permissões e RLS;
- histórico, auditoria e comunicações;
- testes e histórico Git relevante.

Explicitar fatos confirmados, inferências e lacunas. Não inventar regra de negócio.

## Modelar o problema

1. Traduzir o pedido para o problema operacional real.
2. Identificar ator, objetivo, entrada, pré-condições e saída.
3. Definir início, meio e fim; toda fila precisa de uma regra de entrada e de saída.
4. Desenhar a máquina de estados e impedir estados impossíveis.
5. Eleger uma única fonte de verdade para o estado atual; separar estado, histórico e projeções.
6. Contar cliques e reduzir ações frequentes a uma ou duas interações quando seguro.
7. Verificar idempotência, concorrência, reversibilidade, auditoria, erros, empty state, volume e mobile.
8. Aplicar integralmente `references/review-checklist.md`.

## Produzir o Flow Contract

Usar `references/flow-contract-template.md`. Manter obrigatoriamente estas seções:

`PROBLEMA`, `ATOR`, `OBJETIVO`, `ENTRADA`, `PRÉ-CONDIÇÕES`, `ESTADO INICIAL`, `FLUXO PRINCIPAL`, `FLUXOS ALTERNATIVOS`, `ESTADOS`, `TRANSIÇÕES`, `SOURCE OF TRUTH`, `REGRAS DE FILA`, `PERMISSÕES`, `CONFIRMAÇÕES`, `AUDITORIA`, `FEEDBACK`, `ERROS`, `EMPTY STATE`, `CONCORRÊNCIA`, `RESPONSIVIDADE` e `CRITÉRIOS DE ACEITE`.

Incluir também:

- diagrama textual simples;
- matriz `FROM | ACTION | TO | ALLOWED ROLE | CONFIRM? | REVERSIBLE?` quando houver múltiplos estados;
- `REDUNDÂNCIAS ENCONTRADAS`, classificadas em `CRITICAL`, `HIGH`, `MEDIUM` ou `LOW`;
- `SIMPLIFICATION REPORT`, comparando passos/interações atuais e propostos;
- `IMPACT ANALYSIS` para frontend, backend, banco, permissões, relatórios, auditoria, integrações, dados existentes, migração e compatibilidade.

## Emitir o Gate 0

Finalizar com exatamente um resultado:

- `APPROVED`: fluxo completo, coerente e implementável.
- `APPROVED WITH CONDITIONS`: implementação permitida somente respeitando as condições listadas.
- `REJECTED`: emitir também `IMPLEMENTATION BLOCKED` e justificar.
- `NEEDS CLARIFICATION`: emitir também `IMPLEMENTATION BLOCKED` e listar apenas as decisões que impedem um contrato seguro.

Somente `APPROVED` e `APPROVED WITH CONDITIONS` liberam handoff. Para eles, criar `IMPLEMENTATION HANDOFF` com comportamento, regras, impacto e aceite, sem escrever código nem impor a solução técnica ao Architecture Agent.

## Persistir a documentação

- Criar ou atualizar o documento correspondente em `docs/product-flows/` quando a implementação futura alterar um fluxo existente.
- Atualizar o mapa em `docs/product-flows/index.md`.
- Preservar dados, URLs, integrações, automações, relatórios e usuários existentes.
- Não recomendar apagar dados, recriar tabelas ou zerar histórico apenas para simplificar a interface.
- Se código e documentação divergirem, registrar a divergência como risco; não descrevê-la como comportamento garantido.

## Restrições do papel

Não alterar React, CSS, banco, migrations, APIs, componentes ou código de produto. Não criar commit de implementação. A única saída desta Skill é análise, documentação de fluxo e handoff.
