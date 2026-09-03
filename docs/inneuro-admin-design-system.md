# INNEURO Admin Design System 2.0

Fonte persistente de UI/UX para `src/app/admin/**` e
`src/components/admin/**`. O sistema estende a identidade atual; não substitui a
marca e não altera fluxos, permissões ou contratos de dados.

## 1. Inventário real

O levantamento de `src/app/admin/(protected)/**` encontrou 47 rotas:

### Plataforma

- `/admin`
- `/admin/solicitacoes`
- `/admin/fale-conosco`
- `/admin/usuarios`
- `/admin/auditoria`

### Conteúdo do site

- `/admin/carrossel`
- `/admin/convenios`
- `/admin/equipamentos`
- `/admin/exames`
- `/admin/horarios`
- `/admin/informacoes`
- `/admin/lixeira`
- `/admin/midias`
- `/admin/noticias`
- `/admin/preparos`
- `/admin/redes-sociais`

### Experiência e pesquisas

- `/admin/pesquisas/clima`
- `/admin/pesquisas/satisfacao`
- `/admin/pesquisas/satisfacao/configuracoes`
- `/admin/pesquisas/satisfacao/perguntas`
- `/admin/pesquisas/satisfacao/prioridades`
- `/admin/pesquisas/satisfacao/qrcode`
- `/admin/pesquisas/satisfacao/relatorios`
- `/admin/pesquisas/satisfacao/respostas`
- `/admin/pesquisas/satisfacao/respostas/[id]`

### RH e Recrutamento

- `/admin/rh`
- `/admin/rh/avaliacoes`
- `/admin/rh/avaliacoes/[applicationId]`
- `/admin/rh/candidatos`
- `/admin/rh/candidatos/[id]`
- `/admin/rh/configuracoes`
- `/admin/rh/processos`
- `/admin/rh/processos/novo`
- `/admin/rh/processos/[id]`
- `/admin/rh/relatorios`
- `/admin/rh/talentos`
- `/admin/rh/talentos/[id]`
- `/admin/rh/unidades`
- `/admin/rh/vagas`
- `/admin/rh/vagas/nova`
- `/admin/rh/vagas/areas`
- `/admin/rh/vagas/[id]`
- `/admin/rh/vagas/[id]/editar`
- `/admin/rh/vagas/[id]/aderencia`
- `/admin/rh/vagas/[id]/avaliacoes`
- `/admin/rh/vagas/[id]/candidaturas`
- `/admin/rh/vagas/[id]/candidaturas/[applicationId]`

### Padrões encontrados

- CMS: cartões brancos com `rounded-3xl`, formulários de 48 px e botões pill.
- RH: combinação de `rounded-2xl` e pills, com headers e filtros próprios.
- Agendamentos e atendimento: densidade operacional maior, `rounded-lg/xl`,
  tabelas, filas, drawer e ações compactas.
- Pesquisas: componentes especializados, porém com diferenças de raio, padding,
  feedback e alinhamento.
- Tokens de marca já existem em `src/app/globals.css`; devem ser reaproveitados.

A convergência deve ser incremental. Primeiro migram-se shell e estruturas
compartilhadas; depois cada módulo, mantendo o comportamento durante toda a
transição.

## 2. Princípios

1. **Operação primeiro:** densidade suficiente para trabalho diário, sem perder
   legibilidade.
2. **Hierarquia previsível:** cada página apresenta contexto, título, ação e
   conteúdo na mesma ordem.
3. **Semântica antes da cor:** rótulo e ícone explicam estados; cor reforça.
4. **Dados reais:** não há métricas, tendências ou alertas simulados.
5. **Acessibilidade estrutural:** HTML semântico, teclado e foco fazem parte do
   componente, não de uma etapa posterior.
6. **Servidor por padrão:** componentes visuais sem estado permanecem compatíveis
   com Server Components.

## 3. Tokens

### Cores existentes

| Papel            | Token Tailwind |     Valor | Uso                                        |
| ---------------- | -------------- | --------: | ------------------------------------------ |
| Marca escura     | `brand-dark`   | `#03251b` | navegação, títulos e alto contraste        |
| Marca            | `brand`        | `#087a4d` | ação principal, links e foco               |
| Destaque         | `tech`         | `#21c77a` | destaque controlado e foco em fundo escuro |
| Verde suave      | `mint`         | `#dff8ec` | seleção e estados positivos suaves         |
| Fundo            | `surface`      | `#f7faf8` | plano de fundo do Admin                    |
| Texto            | `ink`          | `#10231b` | conteúdo principal                         |
| Texto secundário | `muted`        | `#65736d` | descrições e metadados                     |
| Borda            | `border-light` | `#dde9e2` | separadores e contornos                    |
| Atenção          | `warning`      | `#8a4b08` | avisos                                     |
| Erro             | `error`        | `#b83a3a` | falhas e ações destrutivas                 |

Estados `info` usam azul slate/sky, `warning` usa âmbar, `danger` usa vermelho e
`neutral` usa slate. Esses acentos aparecem em fundos suaves, não como decoração.

### Espaçamento

- Unidade base: 4 px.
- Gap interno compacto: 8 px (`gap-2`).
- Gap padrão: 12–16 px (`gap-3/4`).
- Separação de blocos: 24 px (`gap-6`).
- Separação de seções: 32 px (`gap-8`).
- Padding de card: 16 px no mobile, 20–24 px a partir de `sm`.
- Padding da área de conteúdo: 16 px no mobile, 24 px no tablet, 32 px no
  desktop quando houver espaço.

### Raios, bordas e sombras

- Controle compacto: `rounded-lg` (8 px).
- Input, botão e badge: `rounded-xl` ou pill somente quando o controle já segue
  esse padrão.
- Card e painel: `rounded-2xl` (16 px).
- Modal/drawer: `rounded-2xl` nas bordas visíveis.
- Borda padrão: `border border-border-light`.
- Sombra padrão: nenhuma; `shadow-sm` somente em elementos elevados.
- Modal/drawer: sombra forte apenas para separar a camada elevada.

### Tipografia

- Corpo: Manrope (`font-sans`).
- Títulos: Plus Jakarta Sans (`font-heading`).
- Título de página: 28 px mobile, 32 px desktop, sem saltos excessivos.
- Título de seção: 18–20 px.
- Corpo: 14–16 px.
- Metadado: 12–13 px; uppercase apenas para eyebrow e headers curtos.
- Números de KPI: 28–32 px, com algarismos tabulares quando a comparação importa.

### Alturas e ícones

- Controle padrão: mínimo 44 px.
- Controle compacto: mínimo 36–40 px; nunca menor para ação crítica.
- Ícone em texto/controle: 16 ou 18 px.
- Ícone de navegação/card: 20 px.
- Ícone de empty state: 24 px em container de 44–48 px.

### Breakpoints

Seguem os breakpoints Tailwind existentes:

- base: mobile, incluindo 390 px;
- `sm` 640 px;
- `md` 768 px;
- `lg` 1024 px;
- `xl` 1280 px;
- `2xl` 1536 px.

Em métricas: 1 coluna na base, 2 em tablet, 3–4 em 1366 px e até 6 somente
quando os rótulos permanecerem legíveis.

## 4. Primitivas disponíveis

As primitivas ficam em `src/components/admin/ui` e são exportadas por
`src/components/admin/ui/index.ts`:

- `AdminButton`: ações primary, secondary, outline, danger e ghost.
- `AdminIconButton`: ação de ícone com nome acessível obrigatório.
- `AdminBadge`: estados success, info, warning, danger e neutral.
- `AdminSectionCard`: superfície com título, descrição e ação alinhados.
- `AdminMetricCard`: KPI real com ícone, contexto, status e link opcionais.
- `AdminEmptyState`: vazio humano com ação contextual opcional.
- `AdminSearchInput`: busca com ícone, label acessível e foco consistente.
- `AdminTable` e primitivas: tabela semântica, cabeçalho e células padronizados.
- `AdminPagination`: navegação Anterior/Próxima, com estado atual anunciado.

Esses componentes não conhecem Supabase, permissões ou regras de negócio. O
componente de rota decide se uma ação existe e passa apenas as opções autorizadas.

## 5. Padrões de composição

### Cabeçalho de página

- Breadcrumb/eyebrow pequeno.
- `h1` independente.
- Descrição curta com largura limitada.
- Ações à direita no desktop e abaixo no mobile.

### Cards e métricas

- Mesma altura dentro do grid (`h-full`).
- Label antes do valor para leitura por tecnologia assistiva.
- Tendência apenas se calculada por dado real e acompanhada do período comparado.
- Card clicável deve ter destino claro; não aninhe outros links.

### Busca e filtros

- Busca principal sempre identificada.
- Filtros rápidos visíveis; avançados em `details` quando numerosos.
- Informe quantidade ativa e forneça “Limpar filtros”.
- Preserve filtros na paginação e nas URLs compartilháveis.

### Tabelas

- Use tabela para comparação entre colunas; use cards para narrativas ou mobile
  quando a tabela deixar a ação inacessível.
- Cabeçalho em fundo suave, checkbox na primeira coluna e ações na última.
- Nomes não devem competir com metadados; use ellipsis apenas quando o valor
  completo estiver acessível no detalhe ou por título adequado.

### Formulários

- Ordem: label, controle, helper, erro.
- Associe `label` e `id`; `aria-describedby` aponta helper/erro.
- Não dependa do placeholder como label.
- Rodapé separa Cancelar da ação primária; perigo exige confirmação explícita.

### Feedback

- Sucesso: confirme a operação concluída e o destino do registro.
- Erro: diga o que não foi concluído e a próxima ação possível.
- Loading: use skeleton com geometria estável.
- Vazio: explique o estado, não apenas “sem dados”.

### Modal e drawer

- Modal para decisão curta; drawer para análise contextual sem perder a lista.
- Título e descrição associados via ARIA.
- Escape fecha somente quando não há perda silenciosa de edição.
- Ao fechar, o foco retorna ao elemento acionador.

## 6. Mapa conceitual de ícones

Use somente exportações disponíveis em `lucide-react`:

| Conceito       | Ícone                 |
| -------------- | --------------------- |
| Visão geral    | `LayoutDashboard`     |
| Página inicial | `House`               |
| Notícias       | `Newspaper`           |
| Exames         | `Stethoscope`         |
| Convênios      | `Handshake`           |
| Agendamentos   | `CalendarDays`        |
| RH             | `UsersRound`          |
| Vagas          | `BriefcaseBusiness`   |
| Candidatos     | `ContactRound`        |
| Relatórios     | `ChartNoAxesCombined` |
| Pesquisas      | `HeartHandshake`      |
| Usuários       | `UserRoundCog`        |
| Auditoria      | `ScrollText`          |
| Mídias         | `Images`              |
| Configurações  | `Settings`            |
| Sair           | `LogOut`              |

Não altere o ícone de um conceito entre sidebar, dashboard e atalhos.

## 7. Critérios de revisão

- Comportamento, permissões e persistência continuam intactos.
- Ação principal existe e permanece acessível no mobile.
- Estados loading, vazio, erro e sucesso não deslocam a estrutura sem necessidade.
- Foco é visível e ordem do teclado é lógica.
- Não há ação somente por cor ou ícone sem nome acessível.
- Não há overflow horizontal em 1366x768; quando inevitável, há acesso claro às
  ações importantes.
- Sidebar, tabelas, drawers e modais não produzem scrollbars agressivas.
- Não há warning de hydration, key ausente ou erro no console.
- Lint, typecheck, testes relevantes e build passam antes da publicação.
