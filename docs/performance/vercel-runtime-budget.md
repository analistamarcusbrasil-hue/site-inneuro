# INNEURO — orçamento de runtime na Vercel

## Objetivo

Manter conteúdo institucional público no CDN, Full Route Cache e Data Cache.
Functions ficam reservadas para autenticação, mutações, dados privados, downloads,
jobs e operações que realmente dependem da requisição.

## Orçamento por categoria

| Categoria                       | Política                                                                          | Orçamento operacional                                        |
| ------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Páginas públicas institucionais | Static/SSG/ISR com 15 minutos e invalidação por tag                               | Não devem criar uma Function Invocation por visita comum     |
| Detalhes públicos conhecidos    | SSG e revalidação por tag; fallback apenas para novo slug ainda não materializado | Function somente no primeiro preenchimento quando necessário |
| Páginas públicas transacionais  | Dinâmicas somente quando token, autenticação ou estado atual forem indispensáveis | Uma execução por interação real                              |
| Admin, ATS e portal autenticado | Dinâmicos e sem cache público                                                     | Uma execução por navegação ou ação autorizada                |
| APIs de mutação                 | Dinâmicas, invocadas após ação explícita                                          | Nenhum polling implícito                                     |
| Downloads, PDF, Excel e QR Code | Dinâmicos, privados e sob demanda                                                 | Processar somente após pedido autorizado                     |
| Jobs                            | Menor frequência compatível com a regra operacional                               | Nunca disparar por polling do frontend                       |

## Política de cache público

- TTL padrão: `900` segundos.
- Toda leitura pública do CMS usa cliente anônimo, sem cookies e sem sessão.
- Cada conjunto possui tag semântica; alterações pelo Admin expiram a tag depois
  da gravação bem-sucedida.
- `updateTag()` é usado somente em Server Actions, garantindo leitura atualizada
  após a escrita.
- `revalidatePath()` permanece onde já há dependência direta de rota.
- Alterações diretas no banco, fora do Admin, podem aguardar até 15 minutos.
- Nunca cachear sessão, perfil, permissão, candidato, solicitação, documento,
  resposta de pesquisa, dado médico ou conteúdo autenticado.

## Tags oficiais

| Tag                            | Conteúdo                                               |
| ------------------------------ | ------------------------------------------------------ |
| `inneuro:public:institutional` | Identidade, contatos, endereço e textos institucionais |
| `inneuro:public:scheduling`    | Horários e opções públicas do formulário               |
| `inneuro:public:carousel`      | Destaques da Home                                      |
| `inneuro:public:exams`         | Catálogo e detalhes públicos de exames                 |
| `inneuro:public:partners`      | Convênios e parceiros públicos                         |
| `inneuro:public:news`          | Listagem, metadata e detalhes de notícias              |
| `inneuro:public:preparations`  | Preparos e horários públicos                           |
| `inneuro:public:social`        | Publicações sociais exibidas pelo CMS                  |
| `inneuro:public:equipment`     | Equipamentos públicos                                  |

## Jobs atuais

| Job                         | Frequência                 | Avaliação                                                         |
| --------------------------- | -------------------------- | ----------------------------------------------------------------- |
| Limpeza de pré-agendamento  | Diária, 03:00 UTC          | Preservada; não depende do frontend                               |
| Snapshot mensal de pesquisa | Mensal, dia 1 às 04:15 UTC | Preservada                                                        |
| Portal Guardian             | Diária, 06:07 UTC          | Preservada; abaixo do máximo operacional de uma execução por hora |

## Faixas de alerta

Aplicar a Function Invocations, Fluid Active CPU e demais franquias relevantes,
sempre projetando o consumo do período atual até o fechamento:

| Nível      | Uso projetado da franquia | Ação                                                                        |
| ---------- | ------------------------- | --------------------------------------------------------------------------- |
| `NORMAL`   | abaixo de 50%             | Acompanhar tendência semanal                                                |
| `WARNING`  | 50% a 70%                 | Identificar crescimento por rota e User-Agent                               |
| `HIGH`     | acima de 70% até 85%      | Corrigir rota dominante e reduzir chamadas repetidas                        |
| `CRITICAL` | acima de 85%              | Tratar imediatamente, preservar segurança e evitar ampliar tráfego dinâmico |

## Revisão recorrente

1. Em Vercel → Observability → Functions, ordenar por Invocations, CPU e
   Duration nas janelas de 1 hora, 6 horas e 24 horas.
2. Registrar as dez rotas mais caras e separar humano, bot, 404, API e job.
3. Comparar `invocations/hour` e `CPU/hour` com o mesmo horário do período
   anterior.
4. Verificar repetição de 404 e User-Agent antes de bloquear qualquer crawler.
5. Não bloquear Googlebot, Bingbot ou crawler legítimo sem evidência.
6. Reavaliar toda nova página pública que introduza `connection()`, `cookies()`,
   `headers()`, `no-store` ou `force-dynamic`.

## Gate permanente

Conteúdo institucional público não usa APIs dinâmicas sem justificativa
documentada. Leituras públicas do CMS exigem cache compartilhado, resultado
serializável e invalidação explícita. Qualquer exceção deve demonstrar por que o
conteúdo depende da requisição.
