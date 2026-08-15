import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isCareersPortalEnabled } from "../src/lib/careers/feature-flag";

test("portal de carreiras permanece bloqueado por padrão", () => {
  assert.equal(isCareersPortalEnabled(undefined), false);
  assert.equal(isCareersPortalEnabled(""), false);
  assert.equal(isCareersPortalEnabled("false"), false);
  assert.equal(isCareersPortalEnabled("TRUE"), false);
  assert.equal(isCareersPortalEnabled("1"), false);
});

test("portal de carreiras exige liberação explícita", () => {
  assert.equal(isCareersPortalEnabled("true"), true);
  assert.equal(isCareersPortalEnabled(" true "), true);
});

test("página principal troca o aviso pelos acessos reais quando liberada", () => {
  const page = readFileSync(
    new URL("../src/app/carreiras/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /isCareersPortalEnabled/);
  assert.match(page, /href="\/carreiras\/vagas"/);
  assert.match(page, /href="\/carreiras\/entrar"/);
  assert.match(page, /href="\/carreiras\/cadastro"/);
  assert.match(page, /Portal disponível/);
});
