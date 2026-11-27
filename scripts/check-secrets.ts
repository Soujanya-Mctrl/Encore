import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const localValues = readFileSync("apps/web/.env.local", "utf8").split(/\r?\n/).flatMap((line) => {
  if (line.trim().startsWith("#")) return [];
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (!match || !/(KEY|SECRET|TOKEN)/.test(match[1]!)) return [];
  const value = match[2]!.trim().replace(/^["']|["']$/g, "");
  return value.length >= 16 ? [value] : [];
});
const names = spawnSync("git", ["diff", "--cached", "--name-only", "-z"], { encoding: "utf8" });
if (names.status !== 0) throw new Error("Could not inspect staged paths");
const failed: string[] = [];
for (const file of names.stdout.split("\0").filter(Boolean)) {
  if (/(^|\/)(\.local|node_modules)(\/|$)|(^|\/)\.env(?!\.example$)/.test(file)) { failed.push(file); continue; }
  const result = spawnSync("git", ["show", `:${file}`], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) { failed.push(file); continue; }
  if (localValues.some((value) => result.stdout.includes(value)) ||
    /^-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----$/m.test(result.stdout)) failed.push(file);
}
if (failed.length) { console.error(`Secret review failed for these paths (values hidden):\n${failed.join("\n")}`); process.exitCode = 1; }
else console.log(`Staged secret review passed for ${names.stdout.split("\0").filter(Boolean).length} files. No local credential values found.`);
