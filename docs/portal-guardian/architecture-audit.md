# Auditoria da arquitetura atual

## Fontes reais encontradas

- Agendamentos usam `appointment_requests.created_at`, `completed_at`, estados de workflow e fechamento não agendável já existentes.
- Anexos usam o bucket privado `scheduling-documents` e a tabela `appointment_request_documents`, com original e preview.
- Currículos usam o bucket privado `candidate-resumes`, uma referência atual por candidato e extrações ligadas ao ID do currículo.
- Mídias usam `site-media` e `media_assets`.
- `audit_logs.actor_id` aceita nulo, permitindo autoria de sistema sem usuário artificial.

## Decisões

- Reutilizar `NAO_AGENDAVEL` + `CANCELLED` para timeout.
- Adicionar `service_team_timeout`, `auto_closed_at` e `documents_purge_due_at`.
- Preservar registros e remover somente objetos físicos pela Storage API.
- Usar funções `security definer` exclusivas da Service Role, claims com expiração e índices parciais.
- Manter otimização fora do Edge Runtime; o worker Node valida antes da troca.

## Risco preexistente revisado

O cleanup público de manifests usa TTL de 48 horas, mas a barreira em `storage-retention.ts` consulta as referências persistidas antes da remoção. Portanto, anexos já ligados a uma solicitação não chegam ao `Storage.remove` desse cleanup. A retenção de sete dias do Guardian é um fluxo separado.
