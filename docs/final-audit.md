# Auditoria técnica final — INNEURO

Data da auditoria: 22 de julho de 2026.

## Escopo e método

Auditoria do código, do HTML de produção gerado pelo Next.js e dos fluxos interativos em Chrome headless. A nota abaixo é uma estimativa técnica baseada no checklist desta entrega; não substitui uma medição Lighthouse no domínio definitivo, com DNS, CDN e cache de produção já estabilizados.

- Nota estimada antes: **72/100**.
- Nota estimada depois: **94/100**.

## Problemas encontrados e correções

- Metadados dependiam em parte dos padrões globais: cada rota pública passou a ter título, descrição, canonical, Open Graph, Twitter Card e regra de indexação explícitos.
- Previews poderiam ser indexados: deployments com `VERCEL_ENV=preview` agora recebem `noindex, nofollow`, `robots.txt` bloqueando tudo e sitemap vazio.
- Páginas com conteúdo insuficiente apareciam como indexáveis: `/sobre`, `/exames/medicina-nuclear` e `/exames/cintilografia` receberam `noindex` e foram excluídas do sitemap.
- O sitemap não distinguia conteúdo indexável: a lista agora contém somente páginas públicas com conteúdo validado suficiente.
- A Home apontava para `#agendamento`, mas não renderizava a seção: o formulário foi recolocado na página e a âncora voltou a ter destino real.
- O formulário solicitava campos livres relacionados ao exame: esses campos foram removidos. O site não pede dados clínicos, não envia dados a um servidor e apenas monta a mensagem localmente antes de abrir o WhatsApp.
- A validação do formulário não direcionava claramente o usuário: foi adicionado resumo com `role="alert"`, associação dos erros aos campos e foco automático no primeiro campo inválido.
- O menu modal tornava o fundo inerte, mas o foco ainda podia sair da lista ao pressionar Tab repetidamente no Chrome: foi implementado o ciclo explícito entre o primeiro e o último controle.
- O menu mobile passou a bloquear explicitamente a rolagem do documento e a restaurar o valor anterior ao fechar.
- O skip link tinha JavaScript desnecessário: foi convertido para âncora nativa; o `main` continua focável com `tabIndex={-1}`.
- O componente da marca tentava carregar arquivos oficiais ainda inexistentes, produzindo requisições quebradas: foi preservado somente o fallback textual até o recebimento dos arquivos oficiais.
- Foram corrigidos estados de contraste reduzido em textos e controles desabilitados. O foco global em fundo claro usa verde institucional escuro; superfícies escuras usam o verde tecnológico.
- Conteúdo provisório sobre horários foi retirado da área pública.

## SEO implementado

- Metadados individuais para Home, exames, preparos, convênios, contato, sobre e páginas legais.
- Metadados dinâmicos para as páginas próprias das seis modalidades e dos quatro preparos.
- Títulos locais moderados, usando Macapá e Amapá onde há contexto, sem repetição artificial de palavras-chave.
- Canonical absoluto baseado em `NEXT_PUBLIC_SITE_URL`.
- `sitemap.xml` com 16 URLs indexáveis e sem páginas vazias ou incompletas.
- `robots.txt` com bloqueio de `/admin/` e referência ao sitemap.
- Open Graph e Twitter Card com imagem social local de 1200 × 630.
- Manifest, favicon, Apple icon e ícone do aplicativo preservados.
- Dados estruturados `MedicalClinic` limitados ao nome, descrição, endereço, mapa, canais e modalidades já configurados no projeto.
- 404 com resposta HTTP 404, um `main`, um `h1` e `noindex`.

## Acessibilidade

- Um `main` e um `h1` em todas as 19 rotas públicas testadas e na página 404.
- Hierarquia de títulos e destino focável do skip link conferidos.
- Menu mobile validado com abertura por teclado, `aria-expanded`, `dialog` modal, foco contido, Escape, retorno do foco e bloqueio/restauração da rolagem.
- Carrossel validado com setas do teclado, controles de 44–48 px, pausa e respeito a `prefers-reduced-motion`.
- Formulário validado sem mouse, com erros anunciados e foco no primeiro campo inválido.
- Textos alternativos do carrossel e das marcas conferidos; nenhuma imagem quebrada encontrada.
- `scroll-margin-top: 7rem` preservado para destinos com identificador, considerando o header fixo.
- Nenhum overflow horizontal nas verificações em 360 px, 390 px e 1440 px; a implementação usa limites responsivos também para tablet e telas amplas.

## Performance

- Todas as fotografias do carrossel são WebP, 1920 × 1080 e menores que 100 KB.
- O carrossel monta somente o slide ativo. O teste de carregamento inicial registrou apenas uma fotografia do carrossel; as demais entram sob demanda.
- A primeira imagem usa prioridade; as demais usam lazy loading.
- Fotografias e marcas usam `next/image` com dimensões, `fill`/`sizes` ou proporção reservada para evitar layout shift.
- Logo e skip link deixaram de ser Client Components. Restaram sete fronteiras `use client`, todas associadas a interação ou estado.
- Nenhuma dependência declarada sem uso foi encontrada; nenhuma biblioteca foi adicionada.
- Inventário do build: 14 arquivos JavaScript em `.next/static/chunks`, total aproximado de 718,1 KiB antes de compressão HTTP. Esse total inclui chunks compartilhados e não representa o custo de uma única rota.
- Fontes permanecem integradas por `next/font`, com `display: swap` e arquivos incorporados no build; não há scripts de analytics, publicidade ou chat carregados.

## Privacidade e páginas legais

Criadas:

- `/politica-de-privacidade`;
- `/termos-de-uso`;
- `/politica-de-cookies`.

Os textos explicam o Portal de Exames externo, WhatsApp, formulário local, cookies e links de terceiros. Eles não afirmam que o site armazena laudos ou prontuários e exibem claramente a necessidade de revisão jurídica antes da adoção definitiva.

## Páginas e fluxos testados

Rotas verificadas em HTML de produção e nas larguras 360 px e 1440 px:

- `/`;
- `/exames` e as seis rotas de modalidades;
- `/preparos` e as quatro rotas de preparo;
- `/convenios`;
- `/sobre`;
- `/contato`;
- as três páginas legais;
- uma rota inexistente para validar a página 404.

Fluxos adicionais em 390 × 844:

- menu mobile completo por teclado;
- contenção e restauração do foco;
- fechamento com Escape;
- skip link;
- carrossel com ArrowRight;
- erro acessível do formulário;
- imagem inicial única do carrossel;
- ausência de overflow e imagens quebradas.

Todos os links internos renderizados foram percorridos por HTTP e retornaram 200. O Portal de Exames respondeu no endereço configurado. URLs de WhatsApp e Google Maps foram conferidas sem enviar mensagens ou dados. Convênios, imagens sociais, manifest e ícones foram carregados localmente sem erro.

## Resultado dos comandos

- `npm run lint`: aprovado, zero warnings.
- `npm run typecheck`: aprovado.
- `npm run format:check`: aprovado.
- `npm run build`: aprovado; 29 páginas estáticas geradas. A primeira tentativa isolada do build não conseguiu acessar o Google Fonts por restrição de rede do ambiente; a repetição com acesso autorizado concluiu sem erros.

## Checklist antes do domínio

- [ ] Fornecer os arquivos oficiais da logo INNEURO e substituir o fallback textual sem redesenhar a marca.
- [ ] Definir `NEXT_PUBLIC_SITE_URL` com o domínio oficial e validar canonicals, Open Graph, robots e sitemap após o DNS.
- [ ] Revisar e aprovar juridicamente as três páginas legais, incluindo responsável por privacidade, canal de solicitações, vigência e retenção.
- [ ] Aprovar conteúdo suficiente de `/sobre`, Medicina Nuclear e Cintilografia antes de remover o `noindex`.
- [ ] Fornecer ou validar logos oficiais ainda pendentes de SulAmérica, Bradesco Saúde e CAPSAÚDE.
- [ ] Executar Lighthouse e Web Vitals no domínio oficial após estabilização de CDN/cache.
- [ ] Cadastrar o sitemap e validar propriedade nas ferramentas de busca escolhidas pela INNEURO.
- [ ] Confirmar no ambiente de produção as variáveis do Portal de Exames e do domínio.
