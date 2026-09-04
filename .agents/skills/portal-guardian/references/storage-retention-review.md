# Storage & Retention Review

Antes de aprovar um novo armazenamento, documente:

1. bucket, tabela e colunas que formam a referência;
2. finalidade, proprietário e classificação dos dados;
3. tamanho e MIME permitidos;
4. marco inicial e duração da retenção;
5. estado visual antes e depois da remoção;
6. mecanismo de purge pela Storage API;
7. comportamento para falha, retry e arquivo ausente;
8. detecção de órfãos e referências quebradas;
9. auditoria sem PII, conteúdo, token ou credencial;
10. dry run, emergency stop e plano de rollback.

Bloqueie a implementação se algum item não tiver fonte de verdade ou regra determinística.
