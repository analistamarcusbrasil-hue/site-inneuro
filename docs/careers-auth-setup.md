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
- exigir confirmação de e-mail antes do primeiro acesso;
- revisar os templates de confirmação e recuperação em português;
- não incluir senha, token ou dado pessoal em logs.

## Google OAuth

1. Criar credenciais OAuth 2.0 do tipo aplicação Web no Google Cloud.
2. Usar a URL de callback exibida pelo Supabase como URI autorizada no Google.
3. Habilitar Google em **Authentication → Providers → Google**.
4. Informar Client ID e Client Secret somente no painel do Supabase.
5. Nunca colocar o Client Secret em variáveis `NEXT_PUBLIC_*` ou no GitHub.

## Liberação futura

Antes de alterar `CAREERS_PORTAL_ENABLED` para `true`:

- confirmar a migração `candidate_accounts` aplicada;
- testar cadastro, confirmação de e-mail, Google, login, recuperação e logout;
- confirmar RLS com dois usuários distintos;
- revisar Termos de Uso e Política de Privacidade para recrutamento;
- executar uma revisão de segurança e privacidade;
- manter as rotas de currículos, vagas e candidaturas indisponíveis até suas
  respectivas fases.
