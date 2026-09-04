import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceRecord = Record<string, unknown> & { key: string };

const snapshotPath = path.resolve("docs/sources/daggerheart-srd2/DH_SRD_2_2026_08_25.paratranz.json");
const latestPath = argument("--source");
if (!latestPath) {
  throw new Error("Usage: tsx scripts/diff-daggerheart-srd2-source.ts --source <ParaTranz JSON> [--accept]");
}

const [snapshotBytes, latestBytes] = await Promise.all([
  readFile(snapshotPath),
  readFile(path.resolve(latestPath)),
]);
const snapshot = parseRecords(snapshotBytes, "仓库快照");
const latest = parseRecords(latestBytes, "最新导出");
const snapshotByKey = new Map(snapshot.map((record) => [record.key, record]));
const latestByKey = new Map(latest.map((record) => [record.key, record]));
const added = latest.filter((record) => !snapshotByKey.has(record.key)).map((record) => record.key);
const removed = snapshot.filter((record) => !latestByKey.has(record.key)).map((record) => record.key);
const changed = latest.flatMap((record) => {
  const previous = snapshotByKey.get(record.key);
  if (!previous) return [];
  const fields = [...new Set([...Object.keys(previous), ...Object.keys(record)])]
    .filter((field) => field !== "key" && JSON.stringify(previous[field]) !== JSON.stringify(record[field]));
  if (fields.length === 0) return [];
  return [{
    key: record.key,
    fields: Object.fromEntries(fields.map((field) => [field, { before: previous[field], after: record[field] }])),
  }];
});

const summary = {
  snapshot: { records: snapshot.length, sha256: sha256(snapshotBytes) },
  latest: { records: latest.length, sha256: sha256(latestBytes) },
  added,
  removed,
  changedCount: changed.length,
};
console.log(JSON.stringify(summary, null, 2));
if (changed.length > 0) console.log(JSON.stringify({ changed }, null, 2));

if (process.argv.includes("--accept")) {
  await writeFile(snapshotPath, latestBytes);
  console.log(`Accepted ${path.basename(latestPath)} as ${path.relative(process.cwd(), snapshotPath)}.`);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseRecords(bytes: Buffer, label: string): SourceRecord[] {
  const value = JSON.parse(bytes.toString("utf8")) as unknown;
  if (!Array.isArray(value)) throw new Error(`${label}不是记录数组。`);
  const records = value as SourceRecord[];
  const keys = new Set<string>();
  for (const record of records) {
    if (!record || typeof record !== "object" || typeof record.key !== "string" || !record.key) {
      throw new Error(`${label}包含无效 key。`);
    }
    if (keys.has(record.key)) throw new Error(`${label}包含重复 key：${record.key}`);
    keys.add(record.key);
  }
  return records;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

