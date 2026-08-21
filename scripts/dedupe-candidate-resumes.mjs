import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Configuração do Supabase indisponível.");
}

const execute = process.argv.includes("--execute");
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function loadResumes() {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("candidate_resumes")
      .select("id,candidate_id,storage_path,version,created_at")
      .order("candidate_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

function findDuplicates(rows) {
  const byCandidate = new Map();
  for (const row of rows) {
    const candidateRows = byCandidate.get(row.candidate_id) ?? [];
    candidateRows.push(row);
    byCandidate.set(row.candidate_id, candidateRows);
  }

  const oldRows = [];
  let duplicateCandidates = 0;
  for (const candidateRows of byCandidate.values()) {
    if (candidateRows.length < 2) continue;
    duplicateCandidates += 1;
    candidateRows.sort((left, right) => {
      const byVersion = Number(right.version) - Number(left.version);
      if (byVersion) return byVersion;
      const byCreatedAt =
        Date.parse(right.created_at) - Date.parse(left.created_at);
      return byCreatedAt || String(right.id).localeCompare(String(left.id));
    });
    oldRows.push(...candidateRows.slice(1));
  }
  return { duplicateCandidates, oldRows };
}

function batches(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

const before = await loadResumes();
const { duplicateCandidates, oldRows } = findDuplicates(before);
console.log(`${duplicateCandidates} candidatos com duplicidade`);
console.log(`${oldRows.length} registros antigos serão removidos`);
console.log(`${oldRows.length} arquivos antigos serão removidos`);

if (execute && oldRows.length > 0) {
  for (const group of batches(
    oldRows.map((row) => row.storage_path),
    100,
  )) {
    const { error } = await supabase.storage
      .from("candidate-resumes")
      .remove(group);
    if (error) throw error;
  }

  for (const group of batches(
    oldRows.map((row) => row.id),
    100,
  )) {
    const { error } = await supabase
      .from("candidate_resumes")
      .delete()
      .in("id", group);
    if (error) throw error;
  }

  const after = findDuplicates(await loadResumes());
  console.log(`${oldRows.length} arquivos antigos removidos`);
  console.log(`${oldRows.length} registros antigos removidos`);
  console.log(
    `${after.duplicateCandidates} candidatos ainda possuem duplicidade`,
  );
  if (after.duplicateCandidates !== 0) process.exitCode = 1;
}
