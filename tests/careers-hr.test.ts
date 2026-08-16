import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessHr,
  hasHrPermission,
  resolveHrAccessRole,
} from "../src/lib/careers/hr-permissions";

test("administradores existentes recebem acesso completo ao RH", () => {
  assert.equal(
    resolveHrAccessRole({ role: "super_admin", hr_role: null }),
    "administrator",
  );
  assert.equal(
    resolveHrAccessRole({ role: "admin", hr_role: null }),
    "administrator",
  );
  assert.equal(hasHrPermission("administrator", "settings:manage"), true);
});

test("gestor de RH pode gerenciar vagas, processos e candidatos", () => {
  assert.equal(
    resolveHrAccessRole({ role: "editor", hr_role: "hr_manager" }),
    "hr_manager",
  );
  assert.equal(hasHrPermission("hr_manager", "jobs:manage"), true);
  assert.equal(hasHrPermission("hr_manager", "processes:manage"), true);
  assert.equal(hasHrPermission("hr_manager", "candidates:manage"), true);
  assert.equal(hasHrPermission("hr_manager", "settings:manage"), false);
});

test("avaliador fica limitado à avaliação de candidatos atribuídos", () => {
  assert.equal(
    resolveHrAccessRole({ role: "editor", hr_role: "reviewer" }),
    "reviewer",
  );
  assert.equal(
    hasHrPermission("reviewer", "assigned-candidates:evaluate"),
    true,
  );
  assert.equal(hasHrPermission("reviewer", "candidates:manage"), false);
});

test("candidato e editor sem permissão não acessam o RH", () => {
  assert.equal(canAccessHr(null), false);
  assert.equal(canAccessHr({ role: "editor", hr_role: null }), false);
  assert.equal(canAccessHr({ role: "reception", hr_role: "reviewer" }), false);
});
