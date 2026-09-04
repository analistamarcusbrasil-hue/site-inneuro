---
name: portal-guardian
description: Governa o ciclo de vida, retenção, Storage, PDFs e saúde operacional do portal INNEURO. Use obrigatoriamente ao criar ou alterar uploads, buckets, previews, arquivos temporários, regras de retenção, exclusões automáticas, jobs, monitoramento de referências ou otimização de documentos.
---

# INNEURO Portal Guardian

## Missão

Impedir que arquivos e solicitações fiquem sem ciclo de vida definido. Toda decisão destrutiva deve ser determinística, auditável e idempotente.

## Procedimento obrigatório

1. Execute primeiro a skill `flow-review` quando houver mudança de estado, botão com efeito ou regra operacional.
2. Leia `references/storage-retention-review.md` para qualquer upload, bucket, preview ou mídia temporária.
3. Identifique fonte de verdade, marco inicial, estado final e proprietário operacional.
4. Separe decisão no banco de efeito externo no Storage.
5. Implemente modo simulação antes de qualquer rotina destrutiva.
6. Use claims com expiração, `FOR UPDATE SKIP LOCKED` ou advisory lock e chaves de idempotência.
7. Remova objetos somente pela Supabase Storage API; nunca apague de `storage.objects` via SQL.
8. Preserve metadados e registre ator de sistema como `actor_id=null`, com `actor_kind=system` no JSON.
9. Não aceite bucket ou caminho arbitrário enviado pelo navegador para rotinas de manutenção.
10. Execute `node .agents/skills/portal-guardian/scripts/guardian-audit.mjs` e as validações do projeto.

## Portões de ativação

- Migrações são aditivas e não executam purge.
- Todos os switches destrutivos começam desligados.
- Dry run real precisa ser revisado antes de ativar produção.
- Falhas parciais preservam o original e entram em nova tentativa limitada.
- Órfãos exigem observação e confirmação recorrente; não apagar na primeira detecção.
- PDF assinado ou criptografado nunca é alterado.
- Troca de PDF exige validação de páginas, camada de texto, upload e ganho mínimo.

## Evidências de conclusão

- Flow Contract atualizado em `docs/product-flows/`.
- Política e runbook atualizados em `docs/portal-guardian/`.
- Dry run com totais agregados, sem dados pessoais.
- Testes de idempotência, proteção, autorização e falha parcial.
- Lint, typecheck e build aprovados; nenhum achado CRITICAL/HIGH aberto.
