# Painel administrativo INNEURO

## Configuração

1. Crie um projeto Supabase e aplique as migrations da pasta `supabase/migrations`.
2. Preencha localmente as variáveis documentadas em `.env.example`.
3. Em Authentication, desative cadastro público e convide os usuários por e-mail.
4. O trigger cria todo convidado com função `editor`.

No ambiente da Vercel, configure `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Configure também
`SUPABASE_SERVICE_ROLE_KEY` somente como variável secreta do servidor; ela é
necessária para convites e administração de usuários e nunca deve ser exposta no
navegador ou registrada no Git.

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

## Fluxo editorial para mídias e notícias

1. Em **Mídias**, envie JPG, PNG ou WebP e preencha texto alternativo, crédito e
   licença quando aplicáveis. Não envie pacientes identificáveis, laudos, exames,
   prontuários ou telas de sistemas.
2. Em **Notícias**, informe título, slug, resumo, conteúdo, SEO e selecione uma
   imagem de capa já cadastrada.
3. Salve como rascunho para revisão. Usuários `admin` e `super_admin` podem
   publicar ou agendar; `editor` não publica.
4. Notícias publicadas aparecem em `/noticias`, em `/noticias/[slug]` e, quando
   marcadas como destaque, na Home.
5. Em **Redes sociais**, cadastre apenas a URL oficial da publicação e uma
   miniatura licenciada. O card abre a postagem original em nova aba.

Enquanto não houver nenhum slide ou convênio publicado no CMS, o site preserva
os dados estáticos já aprovados. Assim que o primeiro registro de cada módulo for
publicado, a vitrine correspondente passa a usar a coleção administrada no painel.

O conteúdo público usa um cliente anônimo separado da sessão administrativa. Isso
garante que um colaborador autenticado não veja rascunhos na Home por engano.

## Verificação e operação

- `/api/health/cms` deve responder `database: "connected"` após todas as
  migrations terem sido aplicadas.
- A rota de saúde não expõe chaves, usuários ou conteúdo; ela lê apenas o registro
  público `cms_connection_status`.
- Antes de publicar, revise título, texto alternativo, direitos de uso, link e
  visualização em celular e desktop.
- Para trocar uma imagem, envie um novo arquivo e atualize a referência no
  conteúdo. Arquive o arquivo antigo somente depois de confirmar que não está em
  uso.
