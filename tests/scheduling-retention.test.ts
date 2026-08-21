import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { removeUnpersistedSchedulingDocuments } from "../src/lib/scheduling/storage-retention";

function retentionClient(options?: { queryError?: boolean }) {
  const originals = new Set(["uploads/INN-TESTE/pedido.pdf"]);
  const previews = new Set(["uploads/INN-TESTE/documento-preview.webp"]);
  const removed: string[] = [];
  const admin = {
    from() {
      let column = "";
      let value = "";
      const query = {
        select() {
          return query;
        },
        eq(nextColumn: string, nextValue: string) {
          column = nextColumn;
          value = nextValue;
          return query;
        },
        limit() {
          return query;
        },
        async maybeSingle() {
          if (options?.queryError)
            return { data: null, error: { message: "controlled" } };
          const persisted =
            (column === "storage_path" && originals.has(value)) ||
            (column === "preview_storage_path" && previews.has(value));
          return { data: persisted ? { id: "controlled" } : null, error: null };
        },
      };
      return query;
    },
    storage: {
      from() {
        return {
          async remove(paths: string[]) {
            removed.push(...paths);
            return { data: paths, error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
  return { admin, removed };
}

test("originais e previews persistidos nunca chegam ao Storage remove", async () => {
  const { admin, removed } = retentionClient();
  await removeUnpersistedSchedulingDocuments(admin, [
    "uploads/INN-TESTE/pedido.pdf",
    "uploads/INN-TESTE/documento-preview.webp",
  ]);
  assert.deepEqual(removed, []);
});

test("upload abandonado continua elegível para limpeza", async () => {
  const { admin, removed } = retentionClient();
  await removeUnpersistedSchedulingDocuments(admin, [
    "uploads/INN-ABANDONADO/temporario.jpg",
  ]);
  assert.deepEqual(removed, ["uploads/INN-ABANDONADO/temporario.jpg"]);
});

test("falha na verificação de persistência interrompe a remoção", async () => {
  const { admin, removed } = retentionClient({ queryError: true });
  await assert.rejects(
    removeUnpersistedSchedulingDocuments(admin, [
      "uploads/INN-TESTE/indeterminado.pdf",
    ]),
    /SCHEDULING_PERSISTENCE_CHECK_FAILED/,
  );
  assert.deepEqual(removed, []);
});

test("TTL expira somente acesso público e purge reutiliza a barreira", async () => {
  const [server, shared, response] = await Promise.all([
    readFile(
      new URL("../src/lib/scheduling/server.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/scheduling/shared.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/lib/scheduling/admin-document-response.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(shared, /REQUEST_TTL_MS = 48 \* 60 \* 60 \* 1000/);
  assert.match(
    server,
    /purgeSchedulingRequest[\s\S]*removeDocuments[\s\S]*expired: true/,
  );
  assert.match(server, /removeUnpersistedSchedulingDocuments/);
  assert.match(response, /⚠️ Arquivo indisponível/);
  assert.match(
    response,
    /Este arquivo foi removido anteriormente do armazenamento\. Solicite o reenvio ao paciente\./,
  );
});
