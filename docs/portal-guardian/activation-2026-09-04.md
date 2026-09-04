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
4. Currículos: 22 PDFs continuam elegíveis. A primeira execução do otimizador
   aguarda autorização operacional explícita para substituir arquivos validados.
5. Órfãos: limpeza automática permanece desligada; não havia órfão confirmado.

## Estado do agendador

O cron diário está instalado, mas o modo global da Vercel continua em dry run.
Auto fechamento e purge foram validados por execuções manuais isoladas. A mudança
do modo global para `active` deve ocorrer somente após a primeira validação do
otimizador de currículos, conforme o runbook.
