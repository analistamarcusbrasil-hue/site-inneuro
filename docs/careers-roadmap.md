# Carreiras INNEURO — roadmap interno

## Estado atual: Fase 2 — infraestrutura de autenticação

A rota institucional pública `/carreiras` apresenta o projeto e informa que o
portal está em desenvolvimento. A infraestrutura de conta do candidato utiliza
Supabase Auth e permanece bloqueada pela feature flag. Currículos, vagas,
candidaturas e Banco de Talentos não estão disponíveis.

## Controle de liberação

A variável `CAREERS_PORTAL_ENABLED` deve permanecer como `false` até que uma
fase futura seja validada e autorizada para produção. A página institucional
`/carreiras` é pública independentemente da flag.

Toda futura rota funcional sob `/carreiras` deverá consultar
`isCareersPortalEnabled()` e responder como não encontrada quando a flag não
estiver explicitamente definida como `true`. A liberação deve falhar de forma
segura: valores ausentes, vazios ou diferentes de `true` mantêm o portal
bloqueado.

Rotas previstas para avaliação nas próximas fases:

- `/carreiras/vagas`
- `/carreiras/vagas/[slug]`
- `/carreiras/entrar`
- `/carreiras/cadastro`
- `/carreiras/perfil`
- `/carreiras/candidaturas`

Essas rotas não existem na Fase 1 e não devem ser criadas como telas vazias.

## Próximas fases

### Fase 2 — Autenticação e conta do candidato (infraestrutura concluída)

Foi preparada autenticação por e-mail/senha e Google, recuperação de senha,
sessão server-side, logout, proteção de rotas e a tabela mínima
`candidate_accounts` com RLS. O portal continua bloqueado em produção.

### Fase 3 — Perfil profissional e currículo

Criar perfil profissional e upload seguro de currículo em PDF, com regras de
retenção e privacidade aprovadas.

### Fase 4 — Leitura assistida de currículo

Avaliar leitura inteligente do currículo e preenchimento automático, sempre com
revisão e confirmação do candidato.

### Fase 5 — Gestão de vagas

Permitir cadastro e publicação de vagas pela área administrativa, com controle
de acesso e auditoria.

### Fase 6 — Candidaturas e processos seletivos

Implementar candidatura digital, acompanhamento e fluxo de seleção.

### Fase 7 — Banco de Talentos

Permitir participação consentida no Banco de Talentos e gestão de retenção dos
dados.

### Fase 8 — Habilidades e aderência

Estruturar habilidades e aderência entre candidato e vaga com critérios
transparentes e revisáveis.

### Fase 9 — Avaliações e relatórios

Criar avaliações do RH, ranking assistido e relatórios sem decisões totalmente
automatizadas sobre candidatos.

## Limites da Fase 1

- sem integração com Tally, Google Forms ou plataformas externas;
- sem endpoints de candidatura;
- sem upload de currículo;
- sem autenticação de candidato;
- sem tabelas ou migrações de recrutamento;
- sem vagas ou perfis simulados;
- sem processamento de currículo, IA, scoring ou ranking.
