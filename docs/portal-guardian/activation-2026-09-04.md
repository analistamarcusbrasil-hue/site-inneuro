# Ativação controlada — 04/09/2026

Registro agregado da primeira execução mutável em produção. Nenhum dado pessoal,
caminho de arquivo, token ou credencial é registrado neste documento.

## Proteção aplicada antes da execução

- O claim de purge passou a aceitar somente documentos com original confirmado
  no Storage (`AVAILABLE` ou `MISSING_PREVIEW`).
- Referências com original ausente permanecem como finding de integridade e não
  são marcadas como purgadas.
- Com purge desligado, a RPC continuou retornando zero claims ativos.

## Resultados por capacidade

1. Auto fechamento: 2 solicitações com 20 dias completos foram encerradas; 2
   históricos `AUTO_CLOSED_BY_SYSTEM_TIMEOUT` foram gravados; 0 falhas.
2. Retenção: 8 documentos confirmadamente disponíveis foram removidos pela
   Supabase Storage API; 11.477.685 bytes liberados; 0 falhas e 0 claims presos.
3. Integridade: 10 documentos vencidos cujo original já estava ausente foram
   preservados como referências quebradas, sem purge lógico.
4. Currículos: a primeira tentativa revelou uma ambiguidade entre o parâmetro de
   saída `size_bytes` e a coluna homônima. A execução parou antes de criar claims
   ou alterar arquivos; a RPC foi corrigida pela migração
   `20260904214238_portal_guardian_resume_claim_qualification.sql`.
5. Após a correção, 23 PDFs elegíveis foram processados e preservados como
   `SKIPPED_ENCRYPTED`; 353 currículos pequenos foram classificados como
   `SKIPPED_ALREADY_SMALL`; 0 arquivos substituídos, 0 falhas e 0 claims presos.
6. Ao término, as filas de auto fechamento, purge acionável e otimização de
   currículos estavam zeradas.
7. Órfãos: limpeza automática permanece desligada; não havia órfão confirmado.

## Estado do agendador

O cron diário está instalado e o modo global da Vercel foi definido como
`active` após a validação isolada das três capacidades. Auto fechamento, purge e
otimização continuam individualmente controlados pelos switches do banco. A
limpeza automática de órfãos permanece desligada por desenho.
