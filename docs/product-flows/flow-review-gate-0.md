# FLOW REVIEW — GATE 0

O Gate 0 impede que uma solicitação de interface vire código antes de existir um fluxo operacional coerente. Ele é obrigatório para novo módulo, ação com efeito, estado, etapa, fila, aprovação, reprovação, agendamento, pendência, confirmação, cancelamento, workflow, formulário ou dashboard operacional, integração entre módulos e mudança de regra de negócio.

## Ordem obrigatória

1. Investigar o comportamento real no código, banco, permissões, testes e histórico.
2. Identificar problema, ator, entrada, pré-condições e saída.
3. Modelar estados, transições, filas e fonte de verdade.
4. Validar cliques, feedback, idempotência, concorrência, reversibilidade, auditoria, falhas, escala e mobile.
5. Produzir o Flow Contract, diagrama, matriz de transição, relatórios de redundância/simplificação e análise de impacto.
6. Emitir o resultado e, quando liberado, o handoff sem código.

## Resultados

| Resultado                  | Implementação                         | Uso                                                                         |
| -------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| `APPROVED`                 | Liberada                              | Contrato completo e sem condição impeditiva.                                |
| `APPROVED WITH CONDITIONS` | Liberada sob as condições registradas | Fluxo é viável, mas o handoff deve preservar condições explícitas.          |
| `REJECTED`                 | `IMPLEMENTATION BLOCKED`              | Fluxo criaria risco, contradição, redundância crítica ou estado impossível. |
| `NEEDS CLARIFICATION`      | `IMPLEMENTATION BLOCKED`              | Falta decisão de negócio indispensável para um contrato seguro.             |

Somente `APPROVED` e `APPROVED WITH CONDITIONS` permitem que Architecture, Frontend ou Backend comecem a implementação.

## Flow Contract obrigatório

Cada revisão deve conter: `PROBLEMA`, `ATOR`, `OBJETIVO`, `ENTRADA`, `PRÉ-CONDIÇÕES`, `ESTADO INICIAL`, `FLUXO PRINCIPAL`, `FLUXOS ALTERNATIVOS`, `ESTADOS`, `TRANSIÇÕES`, `SOURCE OF TRUTH`, `REGRAS DE FILA`, `PERMISSÕES`, `CONFIRMAÇÕES`, `AUDITORIA`, `FEEDBACK`, `ERROS`, `EMPTY STATE`, `CONCORRÊNCIA`, `RESPONSIVIDADE` e `CRITÉRIOS DE ACEITE`.

Para fluxos com múltiplos estados, incluir matriz `FROM | ACTION | TO | ALLOWED ROLE | CONFIRM? | REVERSIBLE?`. Toda revisão inclui ainda `REDUNDÂNCIAS ENCONTRADAS`, `SIMPLIFICATION REPORT` e `IMPACT ANALYSIS`.

## LIGHT FLOW REVIEW

Cor, padding ou tipografia sem efeito comportamental podem usar uma revisão leve. Ela ainda verifica se hierarquia, posição, rótulo, foco e visibilidade das ações continuam claros. Se qualquer um desses fatores mudar o uso, aplicar o Gate 0 completo.

## Regra de handoff

O handoff descreve o que deve acontecer, quais regras preservar e como aceitar o resultado. O Flow Architect não altera React, CSS, banco, migration, API ou componente e não escolhe a implementação técnica detalhada.
