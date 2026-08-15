# Carreiras INNEURO — configuração do Supabase Auth

O código da Fase 2 permanece bloqueado enquanto
`CAREERS_PORTAL_ENABLED=false`. Antes de liberar a flag em uma fase futura,
concluir e validar os itens abaixo.

## URLs do Supabase Auth

No painel do Supabase, em **Authentication → URL Configuration**:

- Site URL: `https://inneuroap.com.br`
- Redirect URL de produção:
  `https://inneuroap.com.br/carreiras/auth/callback`
- Adicionar URLs locais somente durante desenvolvimento controlado.

## E-mail e senha

- manter o provedor Email habilitado;
- criar candidatos no servidor com o cliente Admin e `email_confirm: true`;
- autenticar o candidato imediatamente com o cliente SSR normal;
- manter somente o template de recuperação de senha em português;
- não incluir senha, token ou dado pessoal em logs.

## Provedores de autenticação

O portal de candidatos utiliza exclusivamente e-mail e senha. Provedores
sociais não integram o fluxo de cadastro ou login.

## Liberação futura

Antes de alterar `CAREERS_PORTAL_ENABLED` para `true`:

- confirmar a migração `candidate_accounts` aplicada;
- testar cadastro imediato, login, recuperação e logout;
- confirmar RLS com dois usuários distintos;
- revisar Termos de Uso e Política de Privacidade para recrutamento;
- executar uma revisão de segurança e privacidade;
- manter as rotas de currículos, vagas e candidaturas indisponíveis até suas
  respectivas fases.
