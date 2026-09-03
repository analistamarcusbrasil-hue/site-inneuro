import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getAdminNavigation,
  isAdminNavigationItemActive,
} from "../src/lib/admin/navigation";
import type { AdminProfile } from "../src/types/cms";

function profile(
  input: Pick<AdminProfile, "access_profile" | "permissions">,
): AdminProfile {
  return {
    id: "profile-id",
    full_name: "Pessoa Administradora",
    email: "admin@example.com",
    active: true,
    role: "admin",
    hr_role: null,
    must_change_password: false,
    last_login_at: null,
    ...input,
  };
}

function navigationHrefs(navigation: ReturnType<typeof getAdminNavigation>) {
  return navigation.flatMap((section) =>
    section.items.flatMap((item) => [
      ...(item.href ? [item.href] : []),
      ...(item.children ?? []).flatMap((child) =>
        child.href ? [child.href] : [],
      ),
    ]),
  );
}

test("navegação administrativa mantém links limitados às permissões", () => {
  const receptionNavigation = getAdminNavigation(
    profile({
      access_profile: "reception",
      permissions: ["scheduling.view", "scheduling.manage"],
    }),
  );
  const hrefs = navigationHrefs(receptionNavigation);

  assert.deepEqual(hrefs, ["/admin", "/admin/solicitacoes"]);
  assert.equal(hrefs.includes("/admin/rh"), false);
  assert.equal(hrefs.includes("/admin/noticias"), false);
  assert.equal(hrefs.includes("/admin/usuarios"), false);
});

test("avaliador de RH vê somente visão geral e avaliações dentro do grupo", () => {
  const navigation = getAdminNavigation(
    profile({
      access_profile: "evaluator",
      permissions: ["hr.view", "hr.evaluate"],
    }),
  );
  const hrefs = navigationHrefs(navigation);

  assert.equal(hrefs.includes("/admin/rh"), true);
  assert.equal(hrefs.includes("/admin/rh/avaliacoes"), true);
  assert.equal(hrefs.includes("/admin/rh/vagas"), false);
  assert.equal(hrefs.includes("/admin/rh/candidatos"), false);
  assert.equal(hrefs.includes("/admin/rh/relatorios"), false);
});

test("correspondência de rota respeita índices exatos e detalhes", () => {
  assert.equal(
    isAdminNavigationItemActive({ href: "/admin", exact: true }, "/admin/rh"),
    false,
  );
  assert.equal(
    isAdminNavigationItemActive(
      { href: "/admin/rh", exact: true },
      "/admin/rh/vagas",
    ),
    false,
  );
  assert.equal(
    isAdminNavigationItemActive(
      { href: "/admin/rh/vagas" },
      "/admin/rh/vagas/vaga-id/candidaturas",
    ),
    true,
  );
});

test("shell expõe navegação recolhível, breadcrumb e drawer móvel acessíveis", () => {
  const source = readFileSync(
    new URL("../src/components/admin/admin-shell.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /aria-controls="admin-sidebar"/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(source, /aria-label="Breadcrumb"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /scrollbar-width:thin/);
});

test("dashboard usa somente contagens reais e carrega indicadores em paralelo", () => {
  const source = readFileSync(
    new URL("../src/app/admin/(protected)/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /await Promise\.all/);
  assert.match(source, /career_job_applications/);
  assert.match(source, /appointment_requests/);
  assert.match(source, /contact_messages/);
  assert.match(source, /survey_responses/);
  assert.match(source, /result\.error \? null : result\.count/);
  assert.doesNotMatch(source, /value:\s*\d+/);
});
