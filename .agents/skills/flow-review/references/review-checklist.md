# Checklist do Flow Review

Aplicar todos os blocos na revisão padrão. Marcar itens não aplicáveis com justificativa curta.

## Necessidade e linguagem

- Qual problema operacional real está sendo resolvido?
- O ator e a próxima ação são inequívocos em até cinco segundos?
- A nova etapa, tela, ação, campo ou status é indispensável?
- Já existe ação semanticamente equivalente em outro ponto?
- Um conceito usa o mesmo nome em todas as telas?
- Estado atual e histórico estão claramente separados?

## Entrada, saída e estados

- O que coloca o registro no fluxo e na fila?
- O que o remove da fila?
- O fluxo tem saída normal, alternativa e terminal?
- Cada registro possui exatamente um estado atual quando exigido?
- A máquina de estados proíbe saltos e combinações impossíveis?
- Estados finais recusam novas decisões comuns?
- Cancelamento, reprovação e retirada têm semânticas distintas?

## Fonte de verdade e dados

- Qual campo ou entidade é a fonte de verdade do estado atual?
- Projeções, caches e tabelas legadas estão identificados como derivados?
- Contadores e relatórios usam a mesma semântica da fila?
- Dados já existentes são reutilizados sem novo cadastro?
- Dados antigos continuam legíveis?
- URLs, automações e integrações permanecem compatíveis?

## Interação

- A ação principal é óbvia e não compete com muitas ações iguais?
- Ações frequentes exigem no máximo uma ou duas interações quando seguro?
- Só há confirmação para ação destrutiva, irreversível ou definitiva?
- O feedback informa entidade, resultado e próximo estado?
- A interface se atualiza sem F5, troca de aba ou reabertura?
- A funcionalidade principal permanece disponível no mobile e por teclado?

## Segurança operacional

- A UI desabilita reenvio enquanto a ação está pendente?
- O servidor torna a ação idempotente ou rejeita repetição inválida?
- A transição usa estado esperado, versão ou bloqueio contra concorrência?
- Dois operadores não sobrescrevem silenciosamente o mesmo registro?
- Quem pode ver, executar e reverter está definido e validado no servidor?
- A auditoria registra ator, horário, antes, depois e motivo quando necessário?
- A reversão existe? Se não, confirmação e trilha são suficientes?

## Falhas e escala

- Happy path, validação, concorrência, falha externa e falta de permissão têm resposta definida?
- O estado vazio orienta o usuário e confirma que a fila terminou?
- Busca, filtro, ordenação e paginação estão definidos para volume crescente?
- O fluxo funciona com 10, 100, 1.000 e 10.000 registros?
- Ações em lote preservam atomicidade ou explicam falhas parciais?
- Comunicações externas falhas não escondem o resultado da transição principal?

## Redundância e impacto

- Foram procurados status, ações, campos, telas, dados e queries duplicados?
- O fluxo é consistente com os demais módulos?
- O número de telas, cliques, formulários e confirmações foi comparado antes/depois?
- O impacto cobre frontend, backend, banco, permissões, relatórios, auditoria, integrações, dados e migração?
- Nenhuma simplificação propõe apagar dados ou histórico?
- Os critérios de aceite são observáveis e testáveis?
