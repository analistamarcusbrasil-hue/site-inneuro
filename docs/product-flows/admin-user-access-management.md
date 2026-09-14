# FLOW REVIEW — GATE 0

## Evidências do sistema atual

- Arquivos/rotas: `/admin/usuarios`, `AdminUsersManager`, `AdminDrawer` e as primitivas administrativas de tabela, badge, botão e estado vazio.
- Actions/APIs/RPCs: `createAdminUserAction`, `updateAdminUserAction` e `resetAdminUserPasswordAction`; não existe API paralela nem ação de exclusão.
- Tabelas/campos: `profiles.active`, `profiles.role`, `profiles.access_profile`, `profiles.permissions`, `profiles.updated_at` e `audit_logs`; `profiles` ainda não diferencia conta inativa de conta excluída.
- Permissões: a rota exige `users.manage` e também `super_admin`; as Server Actions repetem a exigência de superadministrador. O banco impede alteração do próprio acesso e preserva o último superadministrador ativo.
- Histórico/integrações: criação e atualização já escrevem em `audit_logs`. A tela de Auditoria lê essa mesma tabela. Contas administrativas vivem em `auth.users` e `profiles`; contas de candidatos são separadas e rejeitadas neste fluxo.
- Fatos: a listagem atual carrega todos os perfis e filtra no cliente; não há paginação de backend; não há campo de departamento/cargo; não há coleta de IP nesta arquitetura.
- Lacunas: exclusão lógica, confirmação de ações diretas, ordenação, paginação visual e identificação do último responsável não existem na tela atual.

## FLOW CONTRACT

### PROBLEMA

A administração de acessos exige abrir um editor por usuário e não oferece ações diretas, confirmações destrutivas, paginação ou leitura rápida do responsável pela última alteração.

### ATOR

Superadministrador autenticado, ativo e autorizado com `users.manage`.

### OBJETIVO

Localizar um usuário, compreender seu perfil e acessos e executar com segurança edição, ativação, desativação ou exclusão lógica, com feedback e auditoria.

### ENTRADA

Acesso à rota existente `/admin/usuarios`, usando dados reais de `profiles` e `audit_logs`.

### PRÉ-CONDIÇÕES

- Sessão administrativa válida.
- Perfil ativo com papel `super_admin` e permissão `users.manage`.
- Cliente administrativo seguro disponível apenas no servidor.
- Usuário alvo existente, administrativo e não excluído.

### ESTADO INICIAL

Cada conta visível está em exatamente um estado atual: `ACTIVE` ou `INACTIVE`. Registros com exclusão lógica ficam fora da listagem operacional.

### FLUXO PRINCIPAL

1. O superadministrador abre a listagem existente.
2. Pesquisa, filtra, ordena ou pagina sem perder a combinação atual.
3. Aciona uma ação disponível na própria linha/cartão.
4. Ativação exige uma interação; desativação e exclusão exigem confirmação.
5. O servidor revalida ator, alvo, estado esperado, proteção da própria conta e proteção do último superadministrador.
6. A alteração é persistida em `profiles` e o evento é registrado em `audit_logs`.
7. A tela recarrega com feedback humano e o novo estado.

### FLUXOS ALTERNATIVOS

- Editar abre o drawer existente e preserva criação, redefinição de senha, perfil e permissões.
- Cancelar confirmação não altera dados.
- Ação repetida ou estado já alterado retorna erro de concorrência, sem sobrescrever silenciosamente.
- Falha de banco não gera mensagem de sucesso nem registro de auditoria falso.

### ESTADOS

- `ACTIVE`: acesso administrativo permitido conforme permissões.
- `INACTIVE`: acesso bloqueado; pode ser reativado.
- `DELETED`: exclusão lógica terminal na interface; `active=false` e `deleted_at` preenchido.

### TRANSIÇÕES

- `ACTIVE -> INACTIVE` por desativação confirmada.
- `INACTIVE -> ACTIVE` por ativação.
- `ACTIVE|INACTIVE -> DELETED` por exclusão confirmada.
- Edição mantém o estado ou altera campos não terminais, com auditoria específica.

### SOURCE OF TRUTH

`profiles.active` é a fonte do acesso atual; `profiles.deleted_at` será a fonte da exclusão lógica; `access_profile` e `permissions` definem o escopo. `access_updated_at` e `access_updated_by` identificam a última mudança administrativa. `audit_logs` é somente histórico, nunca estado atual.

### REGRAS DE FILA

A listagem operacional inclui apenas `deleted_at is null`. Busca, filtros, ordenação e paginação atuam sobre esse conjunto. A exclusão remove o registro da listagem após sucesso.

### PERMISSÕES

- Visualizar e executar ações: `super_admin` ativo com `users.manage`.
- Não criar permissões granulares inexistentes (`create_user`, `delete_user` etc.); elas são capacidades cobertas pelo controle real `users.manage` mais papel `super_admin`.
- O ator não pode alterar, desativar ou excluir a própria conta.
- O último superadministrador ativo não pode ser desativado, rebaixado ou excluído.
- Contas de candidato não entram no fluxo administrativo.

### CONFIRMAÇÕES

- Ativar: sem modal, por ser reversível e positiva.
- Desativar: modal com impacto de perda de acesso e cancelamento seguro.
- Excluir: modal destrutivo com nome, e-mail e perfil; exclusão lógica e irreversível na interface.

### AUDITORIA

Registrar ator, alvo, evento, antes, depois e horário automático para `USER_CREATED`, `USER_UPDATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_DELETED`, `USER_PERMISSIONS_CHANGED`, `USER_ROLE_CHANGED` e redefinição de senha. IP fica fora porque a arquitetura atual não o coleta.

### FEEDBACK

Botão pendente fica desabilitado. Sucesso e falha aparecem como toast/status em português e a lista reflete o servidor após a ação.

### ERROS

Tratar configuração ausente, entrada inválida, alvo inexistente/excluído, conta própria, último superadministrador, concorrência, falta de permissão e falha de persistência sem expor detalhes do banco.

### EMPTY STATE

- Sem cadastros: “Nenhum usuário cadastrado.”
- Busca/filtro sem resultado: “Nenhum usuário encontrado para esta pesquisa.”
- Falha de carga: “Não foi possível carregar os usuários.” com opção de tentar novamente.

### CONCORRÊNCIA

Toda alteração usa o `updated_at` observado como versão esperada. Se outra operação alterar o registro antes da gravação, a ação falha sem sobrescrever a mudança mais recente.

### RESPONSIVIDADE

Desktop usa tabela completa com ações à direita; tablet permite rolagem horizontal; mobile usa cartões e um agrupador “Ações”, mantendo editar, ativar/desativar e excluir acessíveis por teclado e toque.

### CRITÉRIOS DE ACEITE

- Busca cobre nome, e-mail, perfil e módulos de permissão.
- Filtros combinam com busca, ordenação e paginação de 10/25/50/100.
- Ações respeitam estado e bloqueios no cliente e no servidor.
- Desativar/excluir sempre confirmam; cancelar não altera.
- Toda mutação gera os eventos aplicáveis na auditoria.
- A listagem mostra `updated_at` e o ator do último evento conhecido.
- Drawer e confirmações possuem foco inicial, Escape, contenção e retorno de foco.
- Estados de loading, erro, vazio e ausência de resultado estão cobertos.

## Diagrama

`LISTA -> BUSCA/FILTRO/ORDEM/PÁGINA -> AÇÃO -> [CONFIRMAÇÃO] -> VALIDAÇÃO NO SERVIDOR -> PERFIL + AUDITORIA -> FEEDBACK -> LISTA`

## Matriz de transição

| FROM     | ACTION     | TO       | ALLOWED ROLE               | CONFIRM? | REVERSIBLE?        |
| -------- | ---------- | -------- | -------------------------- | -------- | ------------------ |
| ACTIVE   | deactivate | INACTIVE | super_admin + users.manage | Sim      | Sim, por ativação  |
| INACTIVE | activate   | ACTIVE   | super_admin + users.manage | Não      | Sim                |
| ACTIVE   | delete     | DELETED  | super_admin + users.manage | Sim      | Não pela interface |
| INACTIVE | delete     | DELETED  | super_admin + users.manage | Sim      | Não pela interface |
| qualquer | edit       | mesmo    | super_admin + users.manage | Não      | Nova edição        |

## REDUNDÂNCIAS ENCONTRADAS

- `HIGH`: o status pode ser alterado dentro do editor, mas a operação frequente não existe na linha.
- `MEDIUM`: cartões desktop simulam colunas sem semântica de tabela.
- `MEDIUM`: perfil e permissões são apresentados como texto longo, dificultando leitura rápida.
- `LOW`: feedback por query string já existe e pode ser reutilizado como origem do toast.

## SIMPLIFICATION REPORT

- Fluxo atual: abrir “Editar”, localizar status, alterar, salvar e voltar à leitura da lista (4–5 interações).
- Fluxo proposto: ativar diretamente (1 interação) ou desativar/excluir com confirmação (2 interações).
- Economia: 2–4 interações nas ações frequentes, preservando o editor para alterações detalhadas.

## IMPACT ANALYSIS

- Frontend: nova tabela/cartões, busca com debounce, filtros, ordenação, paginação, ações e diálogos.
- Backend: nova Server Action de comando e endurecimento da auditoria de atualização.
- Banco: campos de exclusão lógica e da última alteração de acesso, funções transacionais e proteção desses campos no trigger existente.
- Permissões: preserva `users.manage` + `super_admin`; nenhuma permissão inventada.
- Relatórios: sem alteração.
- Auditoria: novos eventos e uso do último evento para identificar o responsável.
- Integrações: preserva Supabase Auth, login, candidatos e demais módulos.
- Dados existentes: permanecem ativos/inativos como estão; novos campos iniciam nulos.
- Migração: aditiva e compatível, sem apagar registros.
- Compatibilidade: rota, criação, edição e redefinição de senha existentes são mantidas.

## FLOW REVIEW RESULT

APPROVED WITH CONDITIONS

## Condições ou bloqueio

- Preservar a autorização real `users.manage` + `super_admin` em todas as mutações.
- Implementar exclusão lógica aditiva; não apagar `auth.users`, histórico ou referências.
- Não inventar departamento, cargo, IP ou permissões que não existam no schema.
- Usar `updated_at` para rejeitar concorrência e manter o último superadministrador.

## IMPLEMENTATION HANDOFF

Reestruturar somente a tela existente. Reutilizar as primitivas administrativas e o drawer atual. Adicionar ações diretas com disponibilidade derivada do estado, confirmação acessível para ações críticas, atualização condicional e auditoria. Excluir logicamente perfis, mantendo histórico e bloqueio efetivo de acesso. A entrega é aceita quando o servidor repete todas as proteções, a lista funciona nos três tamanhos e os testes de fluxo, segurança e qualidade passam.
