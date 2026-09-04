# Ciclo de vida dos agendamentos

- Fonte de idade: `appointment_requests.created_at`; nunca `updated_at`.
- Elegível: não excluída, sem `completed_at`, estado operacional aberto e idade de 20 dias.
- Transição: `workflow_status=NAO_AGENDAVEL`, `status=CANCELLED`.
- Motivo: `service_team_timeout` — “Prazo operacional excedido”.
- Autoria: `completed_by`, `not_schedulable_by` e `actor_id` nulos; metadados indicam sistema e job.
- Finalização: `completed_at=now()` e retenção programada para sete dias depois.
- Idempotência: histórico único por solicitação e claim transacional com lock.

Justificativa oficial: “Solicitação de agendamento não finalizada dentro do prazo operacional de 20 dias. O atendimento foi encerrado automaticamente pelo sistema por ausência de conclusão pela equipe de atendimento.”
