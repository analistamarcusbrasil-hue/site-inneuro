# Painel administrativo INNEURO

## Configuração

1. Crie um projeto Supabase e aplique as migrations da pasta `supabase/migrations`.
2. Preencha localmente as três variáveis documentadas em `.env.example`.
3. Em Authentication, desative cadastro público e convide os usuários por e-mail.
4. O trigger cria todo convidado com função `editor`.

## Primeiro super_admin

Depois de aceitar o primeiro convite, execute no SQL Editor do Supabase:

```sql
update public.profiles
set role = 'super_admin'
where id = (select id from auth.users where email = 'EMAIL_AUTORIZADO');
```

Substitua apenas o e-mail, confirme o usuário correto antes de executar e não registre
esse endereço no repositório. Os próximos usuários podem ser administrados por um
`super_admin` no painel.

## Segurança

- O navegador usa somente a chave publicável.
- A service role é lida exclusivamente por módulos de servidor.
- Todas as tabelas têm RLS; conteúdo público limita-se a registros publicados e ativos.
- Editores não gerenciam usuários nem fazem exclusão definitiva.
- Upload anônimo é bloqueado e SVG de upload não é aceito.
- Arquivamento é o fluxo padrão; exclusão definitiva é exclusiva de `super_admin`.

Sem as variáveis, o site mantém os dados estáticos e `/admin` exibe a pendência de
configuração.
