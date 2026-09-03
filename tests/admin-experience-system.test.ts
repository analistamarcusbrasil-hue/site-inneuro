import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("admin mantém instruções e design system persistentes no repositório", () => {
  const agents = source("src/app/admin/AGENTS.md");
  const designSystem = source("docs/inneuro-admin-design-system.md");

  assert.match(agents, /INNEURO ADMIN EXPERIENCE ARCHITECT/);
  assert.match(agents, /Preserve autenticação, autorização, RLS/);
  assert.match(designSystem, /47 rotas/);
  assert.match(designSystem, /AdminMetricCard/);
  assert.match(designSystem, /1366x768/);
});

test("área protegida oferece loading estável e recuperação de erro", () => {
  const loading = source("src/app/admin/(protected)/loading.tsx");
  const error = source("src/app/admin/(protected)/error.tsx");

  assert.match(loading, /AdminSkeleton/);
  assert.match(loading, /role="status"/);
  assert.match(error, /role="alert"/);
  assert.match(error, /reset/);
  assert.match(error, /Seus dados não foram alterados/);
});

test("drawer compartilhado trata Escape, foco e bloqueio de scroll", () => {
  const drawer = source("src/components/admin/ui/admin-drawer.tsx");

  assert.match(drawer, /event\.key === "Escape"/);
  assert.match(drawer, /document\.body\.style\.overflow = "hidden"/);
  assert.match(drawer, /returnFocus\?\.focus/);
  assert.match(drawer, /aria-modal="true"/);
});

test("ATS preserva currículo e decisões visíveis sem tabela apertada", () => {
  const ats = source(
    "src/components/admin/careers/candidate-operations-center.tsx",
  );

  assert.match(ats, /Ver currículo/);
  assert.match(ats, /✓ Aprovar/);
  assert.match(ats, /✕ Reprovar/);
  assert.match(ats, /hidden overflow-hidden[\s\S]*xl:block/);
  assert.match(ats, /grid gap-3 xl:hidden/);
  assert.match(ats, /var\(--admin-sidebar-width/);
  assert.match(ats, /<AdminDrawer/);
});

test("menu e criação de usuário preservam navegação completa por teclado", () => {
  const shell = source("src/components/admin/admin-shell.tsx");
  const users = source("src/components/admin/admin-users-manager.tsx");

  assert.match(shell, /Pular para o conteúdo/);
  assert.match(shell, /setAttribute\("inert"/);
  assert.match(shell, /event\.key !== "Tab"/);
  assert.match(shell, /opener\?\.focus/);
  assert.match(users, /<AdminDrawer/);
});

test("métricas comuns e paginação são adotadas nos módulos principais", () => {
  const dashboard = source("src/app/admin/(protected)/page.tsx");
  const hr = source("src/app/admin/(protected)/rh/page.tsx");
  const survey = source(
    "src/app/admin/(protected)/pesquisas/satisfacao/page.tsx",
  );
  const contact = source("src/app/admin/(protected)/fale-conosco/page.tsx");

  for (const moduleSource of [dashboard, hr, survey, contact]) {
    assert.match(moduleSource, /AdminMetricCard/);
  }
  assert.match(contact, /AdminPagination/);
  assert.match(contact, /\.range\(/);
});
