# PUBLIC RENDERING AUDIT — INNEURO

Data da auditoria: 7 de setembro de 2026. Baseline funcional: commit `7a2db36`,
Next.js `16.3.1` e arquitetura sem `cacheComponents`.

## LIGHT FLOW REVIEW

Resultado: `APPROVED WITH CONDITIONS`.

Esta alteração não muda estado, fila, permissão, regra de negócio, formulário ou
ação operacional. As condições são: cachear somente conteúdo público
serializável; manter dados autenticados e privados fora do cache; preservar
Admin, RH, agendamento, Fale Conosco e Portal Guardian; invalidar tags somente
depois de escrita confirmada.

## Causa raiz

`src/lib/cms/public-content.ts` chamava `await connection()` dentro de
`publicClient()`. Todas as páginas que liam o CMS, inclusive o Root Layout,
passavam a depender da requisição e eram renderizadas por Function. O cliente
usado nessas leituras já era anônimo, sem cookies, sem persistência de sessão e
sem refresh de token, portanto a dependência individual não era necessária.

O Root Layout chama `getPublicInstitutionalContent()` e
`getPublicSchedulingSettings()` para todas as árvores. Antes, isso causava duas
leituras potenciais do Supabase por renderização. Depois, ambas são Data Cache e
as áreas privadas continuam dinâmicas por seus próprios cookies e guards.

## Inventário de opt-outs dinâmicos

| Ocorrência                                                                        | Rota/uso afetado                                  | Necessária?   | Impacto esperado                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------- | ------------- | ---------------------------------------------------- |
| `connection()` em `public-content.ts`                                             | Todas as páginas que usam CMS e Root Layout       | Não; removida | Era a causa dominante de Function por visita pública |
| `cookies()` em `lib/supabase/server.ts`                                           | Admin, portal autenticado e Server Actions        | Sim           | Mantém sessão privada fora do cache público          |
| `headers()` em `careers/registration-rate-limit.ts`                               | Cadastro de candidato                             | Sim           | Rate limit depende da requisição                     |
| `force-dynamic` em `/solicitacao/[token]` e `/solicitacao/corrigir/[token]`       | Dados privados por token                          | Sim           | Impede cache compartilhado de solicitação            |
| `force-dynamic` em `/q/s/[token]`                                                 | Pesquisa pública vinculada a token e estado atual | Sim           | Mantém campanha e sessão atuais                      |
| `force-dynamic` nas APIs de agendamento, pesquisa, contato, documentos e Guardian | Mutações, uploads, downloads e jobs               | Sim           | Uma execução por operação real                       |
| `cache: "no-store"` no Portal Guardian                                            | Chamada autenticada à Edge Function               | Sim           | Evita reutilizar resultado de job                    |

Não foram encontrados `draftMode()`, `unstable_noStore`, `noStore()`,
`revalidate = 0`, `force-no-store`, `fetchCache` ou `"use cache"` no conteúdo
institucional auditado.

## Classificação das rotas

### A — PUBLIC CACHEABLE

Build final: Static/ISR de 15 minutos para `/`, `/_not-found`, `/carreiras`,
`/contato`, `/convenios`, `/equipe-medica`, `/exames`, `/fale-conosco`,
`/noticias`, `/politica-de-cookies`, `/politica-de-privacidade`, `/preparos`,
`/sobre`, `/termos-de-uso` e `/sitemap.xml`.

`/exames/[slug]`, `/preparos/[slug]` e os slugs atuais de
`/noticias/[slug]` são SSG, também com revalidação de 15 minutos.

### B — PUBLIC DYNAMIC

- `/carreiras/vagas` e `/carreiras/vagas/[slug]`: catálogo funcional do ATS,
  preservado por restrição de escopo.
- `/q/s/[token]`: experiência transacional de pesquisa vinculada a token.
- Novos slugs ainda não materializados podem ter primeira renderização sob
  demanda; depois usam os dados cacheados.

### C — PRIVATE/AUTHENTICATED

Todo `/admin/**`, área autenticada de carreiras, candidaturas, perfil, login,
recuperação, `/solicitacao/**` e páginas com dados de candidato ou paciente.
Essas rotas continuam `ƒ Dynamic`.

### D — API/MUTATION

- `POST`: contato, pré-agendamento, pesquisa, comunicação, currículo e ações
  administrativas.
- `GET` privado: currículos, relatórios, áudio, formulários e documentos.
- `GET` de job: limpeza, snapshots e Portal Guardian, todos protegidos.
- `GET /api/health/cms`: healthcheck público, deliberadamente dinâmico e
  `no-store`; não é chamado pelo navegador do site.

## Estratégia implementada

- Remoção da única chamada pública a `connection()`.
- Onze loaders de conteúdo público envolvidos por `unstable_cache()`.
- TTL uniforme de 900 segundos.
- Chaves com argumentos preservados: `getPublicNews(1)`,
  `getPublicNews(24)`, `getPublicNews(500)` e cada `slug` geram entradas
  distintas.
- `getPublicExamBySlug()` deriva de `getPublicExams()` cacheado.
- `getPublicPreparationBySlug()` deriva de `getPublicPreparations()` cacheado.
- O cache armazena somente arrays, objetos, strings, números, booleanos e nulos;
  nunca cliente Supabase, Request, Response, cookie, header ou stream.
- Não foi habilitado `cacheComponents` e não foi aplicado `force-static` no
  Root Layout.

## Invalidação do CMS

| Alteração                    | Tags expiradas                |
| ---------------------------- | ----------------------------- |
| Institucional                | `institutional`               |
| Horários/agendamento público | `scheduling`                  |
| Carrossel                    | `carousel`                    |
| Notícia                      | `news` e `carousel`           |
| Exame                        | `exams` e `scheduling`        |
| Preparo                      | `preparations`                |
| Convênio                     | `partners`                    |
| Rede social                  | `social`                      |
| Equipamento                  | `equipment`                   |
| Metadata de mídia            | `news`, `partners` e `social` |

As ações de salvar, publicar, ativar, desativar, duplicar, arquivar, restaurar e
excluir conteúdo usam a mesma matriz. `updateTag()` roda no arquivo de Server
Actions após a escrita; `revalidatePath()` existente foi preservado.

## Análise de build — antes e depois

| Rota                   | Antes   | Depois                           |
| ---------------------- | ------- | -------------------------------- |
| `/`                    | Dynamic | Static/ISR 15m                   |
| `/sobre`               | Dynamic | Static/ISR 15m                   |
| `/exames`              | Dynamic | Static/ISR 15m                   |
| `/exames/[slug]`       | Dynamic | SSG/ISR 15m para 15 rotas atuais |
| `/preparos`            | Dynamic | Static/ISR 15m                   |
| `/preparos/[slug]`     | Dynamic | SSG/ISR 15m para 4 rotas atuais  |
| `/convenios`           | Dynamic | Static/ISR 15m                   |
| `/noticias`            | Dynamic | Static/ISR 15m                   |
| `/noticias/[slug]`     | Dynamic | SSG/ISR 15m para notícia atual   |
| `/equipe-medica`       | Dynamic | Static/ISR 15m                   |
| `/fale-conosco`        | Dynamic | Static/ISR 15m                   |
| `/contato`             | Dynamic | Static/ISR 15m                   |
| `/_not-found`          | Dynamic | Static/ISR 15m                   |
| `/admin` e `/admin/**` | Dynamic | Dynamic                          |
| `/solicitacao/**`      | Dynamic | Dynamic                          |
| APIs                   | Dynamic | Dynamic                          |

## Polling, prefetch e CPU

- Não existe polling periódico de dashboard ou Portal Guardian no frontend.
- `router.refresh()` aparece somente depois de mutações explícitas em Admin,
  ATS e upload; não é temporizado.
- O `setInterval()` da pesquisa conta até 90 segundos de gravação de áudio e é
  cancelado ao parar/desmontar; não faz request.
- O `setInterval()` da Home controla apenas o carrossel visual e pausa quando a
  aba está oculta; não faz request.
- Não foi desativado prefetch global. Não havia evidência de prefetch como causa
  dominante, então nenhum fluxo autenticado foi alterado.
- PDF, Excel, QR Code, hash e processamento de currículo permanecem em APIs,
  jobs ou telas privadas sob demanda; não executam no render público
  institucional.

## APIs de maior risco operacional

1. `/api/health/cms` se um monitor externo usar intervalo agressivo.
2. Exportações PDF/XLSX e QR Code administrativas por CPU sob demanda.
3. Downloads e previews protegidos por volume de documentos.
4. APIs de upload e processamento de currículo por tamanho de arquivo.
5. Guardian e limpeza se disparados fora dos crons protegidos.

Nenhuma dessas APIs é chamada repetidamente pela navegação institucional.

## Métrica anterior e medição pós-deploy

Baseline informado para a janela móvel de 30 dias:

- Edge Requests: aproximadamente 336 mil.
- Function Invocations: aproximadamente 334 mil.
- Fluid Active CPU: aproximadamente 3h03 de 4h.

Baseline HTTP do domínio oficial antes desta alteração, em três requisições
consecutivas por rota:

| Rota         | Resultado nas 3 execuções        | `Cache-Control`                                           |
| ------------ | -------------------------------- | --------------------------------------------------------- |
| `/`          | `X-Vercel-Cache: MISS`, `Age: 0` | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/exames`    | `X-Vercel-Cache: MISS`, `Age: 0` | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/convenios` | `X-Vercel-Cache: MISS`, `Age: 0` | `private, no-cache, no-store, max-age=0, must-revalidate` |

O baseline confirma que a versão atualmente publicada executa sem cache público
mesmo em requisições repetidas.

Esses totais não cairão imediatamente. Após um deploy autorizado:

1. Repetir três vezes `curl -I` em `/`, `/exames` e `/convenios` e registrar
   `x-vercel-cache`, `cache-control` e `age`.
2. Esperar `MISS`/materialização inicial e depois `HIT`, `PRERENDER` ou estado
   cacheado equivalente da plataforma.
3. Em Observability → Functions, ordenar as dez primeiras rotas por Invocations,
   CPU e Duration.
4. Comparar última hora, 6 horas e 24 horas por `invocations/hour` e `CPU/hour`.
5. Investigar User-Agent e 404 repetitiva antes de qualquer bloqueio de bot.

Não há percentual prometido antes dessa medição. A expectativa técnica é que
visitas comuns às rotas da categoria A sejam atendidas pelo cache e deixem de
manter a relação próxima de uma Function Invocation por Edge Request.

## Verificação local concluída

- Cliente anônimo do Supabase consultou `institutional` e `scheduling` com
  sucesso, sem sessão e sem chave privilegiada.
- Build gerou 99 páginas e classificou as rotas institucionais como Static/SSG
  com revalidação de 15 minutos.
- Testes automatizados verificam ausência de `connection()` público, tags,
  invalidação, preservação de parâmetros e isolamento das rotas privadas.

## Riscos e pendências deliberadas

- Uma falha transitória do Supabase durante o preenchimento pode manter o
  fallback público por até 15 minutos; qualquer gravação pelo Admin expira a tag.
- Escritas diretas no banco não acionam `updateTag()` e dependem do TTL.
- A validação real de HIT/MISS e o Top 10 de Functions exigem deploy e tráfego;
  esta tarefa não autoriza publicação automática.
- Nenhuma regra, migration, RLS, dado existente ou biblioteca foi alterada.
