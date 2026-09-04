# Runbook de ativação e incidente

## Ativação

1. Validar migração em ambiente isolado.
2. Implantar a Edge Function com validação JWT ativa. As chamadas servidor-a-servidor usam a Service Role já configurada no backend; a função aceita somente o claim `service_role`, e essa credencial nunca pode chegar ao cliente.
3. Manter `PORTAL_GUARDIAN_EXECUTION_MODE` diferente de `active`.
4. Executar dry run e revisar apenas totais agregados, idades, volumes e erros.
5. Confirmar backups, alertas, autorização e comportamento de arquivo ausente.
6. Habilitar uma capacidade por vez no painel e só então definir o modo `active`.
7. Acompanhar as primeiras execuções e espaço liberado.

## Parada de emergência

O Superadministrador desliga imediatamente os switches no painel e remove o modo `active` do ambiente. Claims expiram em 30 minutos; registros em `FAILED` preservam o original e podem ser reprocessados após diagnóstico.

## Rollback

Desligar execução antes de reverter código. Não remova colunas de auditoria nem registros de job. Arquivos já purgados não são recriados automaticamente; restaurá-los exige backup externo e autorização operacional.

## Segredos e logs

Nunca registrar Service Role, token, CPF, conteúdo de documento ou caminho assinado. Erros persistidos são códigos sanitizados com tamanho limitado.
