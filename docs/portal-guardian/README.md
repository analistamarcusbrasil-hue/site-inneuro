# INNEURO Portal Guardian

Agente permanente de ciclo de vida, Storage, retenção e saúde operacional. As regras destrutivas são determinísticas; IA não decide exclusões.

## Componentes

- Migração-base: `supabase/migrations/20260904010518_portal_guardian_foundation.sql`.
- Guardas pós-deploy: `20260904021500_portal_guardian_claim_guard.sql` e
  `20260904110814_portal_guardian_skip_missing_purge.sql`.
- Executor Edge: `supabase/functions/portal-guardian/index.ts`.
- Agendador: `/api/cron/portal-guardian`, diariamente às 06:07 UTC (03:07 em Macapá), compatível com o plano Hobby da Vercel.
- Otimizador Node: `src/lib/portal-guardian/resume-optimizer.ts`.
- Dashboard: `/admin/monitoramento/portal-guardian`.
- Skill: `.agents/skills/portal-guardian/`.

## Estado inicial seguro

As quatro capacidades mutáveis começam desativadas no banco. O cron também opera em dry run enquanto `PORTAL_GUARDIAN_EXECUTION_MODE` não for exatamente `active`. Implantar código ou aplicar a migração não inicia purge.

Consulte [ciclo de vida](scheduling-lifecycle.md), [retenção](storage-retention.md), [currículos](resume-optimization.md), [monitoramento](health-monitoring.md) e [runbook](runbook.md).

A primeira execução mutável está registrada em
[ativação controlada de 04/09/2026](activation-2026-09-04.md).
