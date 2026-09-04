# Mapa de fluxos do produto INNEURO

Este diretório é a fonte persistente dos contratos de fluxo. Toda mudança de comportamento, regra de negócio, estado, etapa, fila ou ação operacional passa primeiro pelo [FLOW REVIEW — GATE 0](flow-review-gate-0.md).

## Fluxos críticos

| Domínio               | Escopo inventariado                                                                                              | Estado da documentação                              | Documento                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| Agendamento           | Solicitação, convênio, pendência, agendamento, impossibilidade, anexos e filas                                   | Contrato do Guardian aprovado com condições         | [Portal Guardian](portal-guardian.md)                             |
| RH / Recrutamento     | Candidatura, currículo, entrevista, teste prático, contratação, contratado, não aprovado, lote, fila e aderência | Primeiro contrato documentado                       | [Decisão de etapa da candidatura](rh-candidate-stage-decision.md) |
| Pesquisas             | Satisfação, perguntas, respostas, prioridades, relatórios e configuração                                         | Inventariado; documentar no próximo ajuste de fluxo | —                                                                 |
| CMS                   | Criação, edição, publicação, despublicação, exclusão e restauração de conteúdo                                   | Inventariado; documentar no próximo ajuste de fluxo | —                                                                 |
| Usuários e permissões | Convite/criação, papel, escopo, ativação, desativação e auditoria                                                | Inventariado; documentar no próximo ajuste de fluxo | —                                                                 |

## Regra de manutenção

- Atualizar o contrato afetado junto da implementação que alterar o fluxo.
- Tratar a documentação como contrato; divergências com o código devem ser registradas e resolvidas.
- Não usar histórico ou projeção como fonte de verdade do estado atual.
- Adicionar novos documentos somente quando houver revisão concreta, sem reescrever todos os fluxos de uma vez.
