import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PUBLIC_CONTENT_REVALIDATE_SECONDS,
  publicContentCacheTags,
  publicContentTagsForModule,
} from "../src/lib/cms/public-cache";

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("conteúdo público usa Data Cache de 15 minutos sem APIs de requisição", async () => {
  const source = await read("../src/lib/cms/public-content.ts");

  assert.equal(PUBLIC_CONTENT_REVALIDATE_SECONDS, 900);
  assert.equal(source.match(/unstable_cache\(/g)?.length, 11);
  assert.doesNotMatch(source, /connection\(|cookies\(|headers\(|noStore\(/);
  assert.match(source, /loadPublicNewsBySlug/);
  assert.match(source, /loadPublicNews/);
  assert.match(source, /tags: \[publicContentCacheTags\.institutional\]/);
});

test("tags públicas são semânticas e notícias invalidam também o carrossel", () => {
  assert.deepEqual(publicContentTagsForModule("noticias"), [
    publicContentCacheTags.news,
    publicContentCacheTags.carousel,
  ]);
  assert.deepEqual(publicContentTagsForModule("exames"), [
    publicContentCacheTags.exams,
    publicContentCacheTags.scheduling,
  ]);
  assert.deepEqual(publicContentTagsForModule("convenios"), [
    publicContentCacheTags.partners,
  ]);
  assert.equal(
    new Set(Object.values(publicContentCacheTags)).size,
    Object.keys(publicContentCacheTags).length,
  );
});

test("ações do CMS expiram tags somente no contexto autenticado", async () => {
  const actions = await read("../src/app/admin/actions.ts");

  assert.match(actions, /^"use server";/);
  assert.match(
    actions,
    /import \{ revalidatePath, updateTag \} from "next\/cache"/,
  );
  assert.match(actions, /invalidatePublicContentForModule\(moduleKey\)/);
  assert.match(
    actions,
    /invalidatePublicContent\(\[publicContentCacheTags\.institutional\]\)/,
  );
  assert.match(
    actions,
    /invalidatePublicContent\(\[publicContentCacheTags\.scheduling\]\)/,
  );
});

test("rotas públicas evitam opt-out e preservam parâmetros funcionais", async () => {
  const [rootLayout, contact, scheduling, newsDetail, nextConfig] =
    await Promise.all([
      read("../src/app/layout.tsx"),
      read("../src/app/contato/page.tsx"),
      read("../src/components/sections/scheduling.tsx"),
      read("../src/app/noticias/[slug]/page.tsx"),
      read("../next.config.ts"),
    ]);

  assert.doesNotMatch(rootLayout, /force-dynamic|revalidate\s*=\s*0/);
  assert.doesNotMatch(contact, /searchParams/);
  assert.match(scheduling, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(newsDetail, /export async function generateStaticParams/);
  assert.doesNotMatch(nextConfig, /cacheComponents\s*:\s*true/);
});

test("sessões, dados privados, APIs e jobs permanecem dinâmicos", async () => {
  const [supabaseServer, adminLayout, requestPage, guardian, vercel] =
    await Promise.all([
      read("../src/lib/supabase/server.ts"),
      read("../src/app/admin/(protected)/layout.tsx"),
      read("../src/app/solicitacao/[token]/page.tsx"),
      read("../src/app/api/cron/portal-guardian/route.ts"),
      read("../vercel.json"),
    ]);

  assert.match(supabaseServer, /const cookieStore = await cookies\(\)/);
  assert.match(adminLayout, /requireAdmin\(\)/);
  assert.match(requestPage, /dynamic = "force-dynamic"/);
  assert.match(guardian, /dynamic = "force-dynamic"/);
  assert.match(guardian, /cache: "no-store"/);
  assert.match(vercel, /"path": "\/api\/cron\/portal-guardian"/);
  assert.doesNotMatch(vercel, /\*\/([0-9]+) \* \* \* \*/);
});
