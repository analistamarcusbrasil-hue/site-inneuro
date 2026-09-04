# RH — decisão de etapa da candidatura

Revisão documental do fluxo real existente em 3 de setembro de 2026. Nenhuma funcionalidade foi alterada nesta análise.

## Evidências do sistema atual

- Tela operacional: `src/app/admin/(protected)/rh/vagas/[id]/candidaturas/page.tsx` e `src/components/admin/careers/candidate-operations-center.tsx`.
- Detalhe e decisão: `src/app/admin/(protected)/rh/vagas/[id]/candidaturas/[applicationId]/page.tsx` e `src/components/admin/career-stage-decision-panel.tsx`.
- Orquestração: `src/app/admin/(protected)/rh/vagas/[id]/candidaturas/actions.ts`.
- Vocabulário: `src/lib/careers/applications.ts` e `src/lib/careers/selection-processes.ts`.
- Banco: `career_job_applications`, `career_application_stage_history`, `career_selection_process_candidates` e `audit_logs`.
- RPCs: `decide_career_application_stage`, `bulk_decide_career_applications`, `search_career_job_applications` e `career_job_pipeline_summary`.
- Migrações de referência: `202608160001_four_stage_recruitment_funnel.sql`, `202608160004_career_decisions_vacancy_numbers.sql` e `20260902093502_enforce_exclusive_career_stage_queues.sql`.
- Permissão confirmada em duas camadas: `requireHrAccess("jobs:manage")` na Server Action e `can_manage_hr()` na RPC.

## FLOW CONTRACT

### PROBLEMA

O RH precisa registrar uma decisão sobre a candidatura, removê-la da fila atual e colocá-la exatamente na próxima etapa ou em um estado terminal, sem duplicidade nem sobrescrita concorrente.

### ATOR

Profissional de RH com permissão `jobs:manage`. O banco também exige usuário autenticado autorizado por `can_manage_hr()`.

### OBJETIVO

Concluir a análise da etapa atual em uma ação segura, refletindo imediatamente o novo estado nas filas, contadores, detalhe, portal do candidato, histórico e comunicação.

### ENTRADA

Uma candidatura existente aparece na fila correspondente ao seu `candidate_stage`, desde que não esteja retirada (`status <> 'withdrawn'`).

### PRÉ-CONDIÇÕES

- Candidatura e vaga válidas.
- Ator autorizado.
- Etapa enviada pela interface igual à etapa persistida (`expected_stage`).
- Etapa atual não terminal.
- Seleção em lote contém de 1 a 100 candidaturas da mesma vaga e etapa.

### ESTADO INICIAL

Uma das etapas ativas: `resume`, `interview`, `practical_test` ou `hiring`.

### FLUXO PRINCIPAL

1. RH abre a fila e consulta currículo/dados necessários.
2. RH escolhe Aprovar.
3. A interface confirma candidato, etapa atual e próxima etapa.
4. A Server Action valida entrada e permissão.
5. A RPC bloqueia o registro, compara `expected_stage` e executa uma transição válida.
6. O banco atualiza `candidate_stage` e o status de ciclo de vida.
7. Triggers/RPC registram histórico e auditoria e sincronizam a projeção de processo existente.
8. As rotas administrativas e do candidato são revalidadas.
9. A interface informa o novo estado e a comunicação é enviada ou reportada separadamente como falha.

### FLUXOS ALTERNATIVOS

- Reprovar: confirmar a decisão, registrar motivo interno opcional, mover para `not_approved` e finalizar a candidatura.
- Concorrência: se outro operador já moveu o registro, rejeitar com `candidate_stage_changed` e atualizar a lista.
- Lote inconsistente: rejeitar toda a operação antes de mover qualquer candidatura.
- Falha de comunicação: preservar a transição concluída, informar a falha e permitir tratamento de reenvio sem repetir a decisão.
- Sem permissão, entrada inválida, candidatura inexistente ou etapa terminal: não alterar dados e retornar feedback humano.

### ESTADOS

- Ativos: Currículo, Entrevista, Teste Prático e Contratação.
- Terminais: Contratado e Não aprovado.
- `status` representa o ciclo de vida da candidatura (`submitted`, `screening`, `in_process`, `finalized`, `withdrawn`) e não substitui a etapa operacional.

### TRANSIÇÕES

Aprovação avança uma única etapa. Reprovação parte de qualquer etapa ativa para Não aprovado. Não há transição operacional comum saindo de estado terminal.

### SOURCE OF TRUTH

`career_job_applications.candidate_stage` é a fonte operacional da etapa atual. `career_application_stage_history` é somente histórico. `career_selection_process_candidates.stage` deve ser tratado como projeção compatível/sincronizada, nunca como segunda fonte para novas filas ou relatórios.

### REGRAS DE FILA

- Uma candidatura pertence a exatamente uma fila de etapa atual.
- A fila filtra por `candidate_stage` e exclui candidaturas retiradas.
- Aprovar ou reprovar remove o item da fila atual na mesma transação.
- Contadores agrupam o mesmo campo usado pela listagem.
- Em Currículo, a ordenação padrão `best_match` usa aderência ponderada pela cobertura de informação, com desempates determinísticos.

### PERMISSÕES

Visualização e decisão ficam restritas ao RH autorizado. A autorização é validada no servidor e no banco; esconder botão não é controle de acesso.

### CONFIRMAÇÕES

Aprovação confirma etapa atual e destino. Reprovação exige confirmação por encerrar a candidatura; o motivo interno é opcional e não integra a comunicação ao candidato.

### AUDITORIA

Registrar ator, data, candidatura, vaga, etapa anterior, etapa nova, decisão e motivo interno quando fornecido. `audit_logs` registra o evento e `career_application_stage_history` preserva a trilha funcional.

### FEEDBACK

Sucesso deve citar candidato(s) e próxima etapa. Falha de concorrência deve dizer que a candidatura já foi movimentada e provocar atualização. Falha de e-mail não deve ser apresentada como falha da transição já confirmada.

### ERROS

Cobrir: validação, autorização, registro inexistente, etapa final, transição inválida, etapa esperada divergente, lote misto, falha de banco e falha de comunicação externa.

### EMPTY STATE

Exibir mensagem específica da etapa, por exemplo: “Todos os currículos desta etapa foram avaliados”, mantendo acesso aos filtros e às demais filas.

### CONCORRÊNCIA

A decisão usa bloqueio de linha e `expected_stage`. O lote valida previamente vaga e etapa de todos os itens e executa atomicamente. Botões permanecem desabilitados durante o envio para reduzir duplo clique.

### RESPONSIVIDADE

Currículo, Aprovar e Reprovar devem permanecer acessíveis em lista e cartões mobile. A ação principal não pode depender de hover nem ficar fora da largura útil.

### CRITÉRIOS DE ACEITE

- Aprovar move exatamente uma etapa; reprovar move para Não aprovado.
- O item desaparece da fila anterior e aparece somente na fila de destino sem F5.
- Contadores refletem o mesmo estado da listagem.
- Repetição ou concorrência não cria duas movimentações.
- Estado terminal não aceita nova decisão comum.
- Histórico e auditoria identificam ator e transição.
- Falha de comunicação não desfaz nem repete a decisão.
- O fluxo funciona por teclado e em 390 px sem esconder ações essenciais.

## Diagrama

```text
[Currículo] -> aprovar -> [Entrevista] -> aprovar -> [Teste Prático]
      |                         |                              |
   reprovar                  reprovar                       reprovar
      |                         |                              |
      +-------------------------+------------------------------+--> [Não aprovado]

[Teste Prático] -> aprovar -> [Contratação] -> aprovar -> [Contratado]
                                      |
                                   reprovar
                                      |
                               [Não aprovado]
```

## Matriz de transição

| FROM                 | ACTION   | TO            | ALLOWED ROLE                  | CONFIRM? | REVERSIBLE?          |
| -------------------- | -------- | ------------- | ----------------------------- | -------- | -------------------- |
| Currículo            | Aprovar  | Entrevista    | `jobs:manage` / RH autorizado | Sim      | Não pelo fluxo comum |
| Entrevista           | Aprovar  | Teste Prático | `jobs:manage` / RH autorizado | Sim      | Não pelo fluxo comum |
| Teste Prático        | Aprovar  | Contratação   | `jobs:manage` / RH autorizado | Sim      | Não pelo fluxo comum |
| Contratação          | Aprovar  | Contratado    | `jobs:manage` / RH autorizado | Sim      | Não pelo fluxo comum |
| Qualquer etapa ativa | Reprovar | Não aprovado  | `jobs:manage` / RH autorizado | Sim      | Não pelo fluxo comum |

## REDUNDÂNCIAS ENCONTRADAS

**HIGH — etapa também persistida em `career_selection_process_candidates.stage`.** A sincronização existe por compatibilidade, mas novas leituras ou escritas diretas podem recriar filas divergentes. Recomendação: usar `career_job_applications.candidate_stage` e as RPCs de decisão como contrato operacional; tratar o outro campo apenas como projeção legada até uma migração futura, separadamente revisada.

**MEDIUM — vocabulário de etapas duplicado em dois módulos TypeScript.** Os rótulos atuais coincidem, mas podem divergir. Recomendação de handoff arquitetural: consolidar o vocabulário sem alterar valores persistidos.

## SIMPLIFICATION REPORT

- Fluxo operacional atual aprovado: abrir/consultar e decidir, em duas interações principais.
- Fluxo proposto: manter as mesmas duas interações; não criar nova tela, novo status nem botão sinônimo.
- Economia: evita etapas e cadastros adicionais; nenhuma mudança de produto é necessária nesta tarefa.

## IMPACT ANALYSIS

- Frontend: filas, cartões/tabela, detalhe, feedback e contadores.
- Backend: Server Actions de decisão individual e em lote.
- Banco: RPCs, guard de transição, histórico e auditoria.
- Permissões: `jobs:manage` e `can_manage_hr()`.
- Relatórios: devem ler `candidate_stage`.
- Auditoria: manter histórico funcional e `audit_logs`.
- Integrações: comunicação ao candidato após transição.
- Dados existentes: preservar todos os registros e históricos.
- Migração: não necessária para documentar o contrato.
- Compatibilidade: preservar valores de etapa, URLs, portal do candidato e projeção legada.

## FLOW REVIEW RESULT

`APPROVED WITH CONDITIONS`

Condições: toda futura implementação deve usar `career_job_applications.candidate_stage` como fonte de verdade, decidir via contratos concorrentes existentes, manter filas/contadores coerentes e não introduzir transição saindo de estado terminal sem novo Flow Review.

## IMPLEMENTATION HANDOFF

Não há implementação solicitada neste contrato. Em mudança futura, Architecture/Frontend/Backend devem preservar a matriz, autorização em duas camadas, atomicidade, auditoria, revalidação automática e separação entre resultado da decisão e resultado da comunicação.
