# INNEURO ADMIN EXPERIENCE ARCHITECT

Este arquivo rege toda alteração em `src/app/admin/**`. Para componentes em
`src/components/admin/**`, siga também
`docs/inneuro-admin-design-system.md`.

## Missão

Manter o Admin INNEURO como uma plataforma corporativa de saúde clara,
consistente, acessível, responsiva e operacional. Mudanças visuais nunca podem
alterar regras de negócio, permissões ou integridade dos dados.

## Regras obrigatórias

- Preserve autenticação, autorização, RLS, RPCs, Server Actions, uploads,
  downloads, filtros, paginação e contratos de dados existentes.
- Use português do Brasil em toda interface pública do Admin.
- Não crie KPIs, estados, permissões, notificações ou ações sem uma fonte real.
- Não exponha mensagens cruas do banco; traduza erros conhecidos para mensagens
  humanas e mantenha detalhes técnicos apenas no log seguro do servidor.
- Mantenha Server Components por padrão. Use Client Components somente quando
  houver interação ou estado local que os justifique.
- Não adicione bibliotecas para resolver componentes que Tailwind CSS, React e
  Lucide React já atendem.
- Não altere a marca nem crie variações da identidade INNEURO.
- Respeite todas as regras do `AGENTS.md` raiz, inclusive as regras de publicação
  e versionamento.

## Fonte visual

- Antes de criar uma primitiva, procure em `src/components/admin/ui` e
  `src/components/ui`.
- Para novos padrões administrativos, prefira as primitivas em
  `src/components/admin/ui` e os tokens já expostos em `src/app/globals.css`.
- Consulte `docs/inneuro-admin-design-system.md` para cores, espaçamento,
  tipografia, raios, estados e padrões de composição.
- Ícones devem vir de `lucide-react`, medir normalmente 16, 18 ou 20 px e não
  substituir rótulos em ações ambíguas.
- Mantenha superfícies brancas sobre `bg-surface`, bordas suaves e sombras
  mínimas. Evite gradientes, glassmorphism, animações decorativas e excesso de
  cores.

## Composição de páginas

1. Breadcrumb/eyebrow discreto.
2. Título, descrição e ações primárias em um cabeçalho único.
3. Indicadores reais, quando existirem.
4. Barra de busca e filtros.
5. Conteúdo principal em cartões, tabela, fila ou formulário.
6. Estado vazio, carregamento e erro no mesmo espaço reservado ao conteúdo.

Não use o breadcrumb como título. Mantenha a ação principal visível e agrupe
ações destrutivas separadamente.

## Componentes e estados

- Botões: altura padrão de 40–44 px; `primary` para a principal, `outline` ou
  `ghost` para neutras e `danger` somente para destrutivas.
- Badges: `success`, `info`, `warning`, `danger` ou `neutral`. Não introduza uma
  nova cor sem documentar um novo significado semântico.
- Cards: `rounded-2xl`, borda `border-border-light`, fundo branco e padding
  responsivo de 16–24 px.
- Inputs: altura mínima de 44 px, label associado, foco visível e erro descrito
  em texto, não apenas por cor.
- Tabelas: checkbox à esquerda, ações à direita, cabeçalho claro, hover sutil e
  alternativa responsiva quando o conteúdo não couber.
- Empty state: título humano, explicação curta e ação contextual quando houver.
- Loading: preserve a geometria da tela com skeletons e evite layout shift.
- Modal/drawer: título, descrição, conteúdo e rodapé previsíveis; foco e Escape
  devem funcionar quando for seguro fechar.

## Responsividade e acessibilidade

- Trate 1366x768 como viewport desktop de referência; valide também 1920x1080,
  1440x900, 1024 px, 768 px e 390 px quando a mudança afetar layout.
- Não esconda uma ação essencial no mobile. Converta tabelas críticas em cartões
  ou preserve um acesso claro à coluna de ações.
- Garanta navegação por teclado, foco visível, contraste razoável, `aria-label`
  para botões apenas com ícone, `aria-current` na navegação e semântica correta
  de diálogo.
- Não desative zoom, não dependa de hover e respeite `prefers-reduced-motion`.

## Procedimento para futuras mudanças

1. Inventarie a rota e os componentes compartilhados que ela usa.
2. Registre quais comportamentos e permissões precisam permanecer intactos.
3. Reutilize uma primitiva existente ou crie uma somente se houver uso real.
4. Teste a ação principal, estados vazio/erro/loading, teclado e responsividade.
5. Execute `npm run lint`, `npm run typecheck`, testes relevantes e
   `npm run build` antes de concluir.
6. Revise o diff e não prossiga com problemas CRITICAL ou HIGH conhecidos.
