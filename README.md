# Site institucional INNEURO

Site institucional do Instituto de Neurologia do Amapá, com páginas públicas,
conteúdo editorial e painel administrativo integrado ao Supabase.

## Tecnologias

Next.js (App Router), TypeScript, Tailwind CSS, Supabase, ESLint, Prettier,
Lucide React e `next/font`.

## Requisitos e instalação

- Node.js 20.9 ou superior
- npm

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`. Para validação e produção:

```bash
npm run lint
npm run typecheck
npm run build
npm start
```

## Estrutura

- `src/app`: rotas, layout, metadata e estilos globais.
- `src/components/brand`: identidade e visual abstrato.
- `src/components/layout`: estrutura de página.
- `src/components/sections`: blocos de seção.
- `src/components/ui`: componentes fundamentais.
- `src/config`: configuração institucional centralizada.
- `src/data`, `src/types`: conteúdo estático validado e tipos compartilhados.
- `src/app/admin`: painel editorial protegido.
- `supabase/migrations`: banco, permissões, armazenamento e diagnóstico do CMS.
- `public/brand`: arquivos oficiais da marca.
- `public/images`, `public/icons`: mídia estática futura.

Adicione as logos oficiais, sem alterar os nomes, em `public/brand/inneuro-logo.png`, `public/brand/inneuro-logo-white.png` e `public/brand/inneuro-symbol.png`. Enquanto não existirem, o componente exibe apenas o nome INNEURO em texto.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha apenas dados oficiais. Campos vazios são aceitos nesta etapa.

Consulte `docs/admin-cms.md` para configurar usuários e operar notícias, mídias,
carrossel, convênios, redes sociais e equipamentos.

## Desenvolvimento e publicação

### Desenvolvimento local

```bash
npm install
npm run dev
```

### Validação

```bash
npm run lint
npm run typecheck
npm run format:check
npm run build
```

### Envio para nuvem

```bash
git add .
git commit -m "descrição da alteração"
git push origin main
```

### Fluxo automático

- O GitHub recebe o push na branch `main`.
- A Vercel cria automaticamente um deployment de produção.
- A URL principal `.vercel.app` do projeto é atualizada.
- O domínio oficial será conectado somente na versão final.

### Preview de branches

Branches diferentes da `main`, como `feature/exames`, `feature/preparos`,
`feature/contatos`, `feature/layout-mobile` e `fix/nome-da-correcao`, geram URLs
temporárias de Preview Deployment na Vercel. Após a aprovação visual, a branch
pode ser integrada à `main` para atualizar a versão estável de testes na nuvem.
