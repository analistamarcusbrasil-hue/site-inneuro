import assert from "node:assert/strict";
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
