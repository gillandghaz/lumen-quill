// Apply (create or update) the repository rulesets in .github/rulesets/*.json.
//
//   GH_TOKEN=<token with admin on the repo> node scripts/apply-rulesets.mjs <owner>/<repo>
//
// GitHub enforces rulesets on private repositories only with GitHub Pro / Team; on GitHub Free it answers 403
// ("Upgrade to GitHub Pro or make this repository public"). The script reports that and exits 0, so it can be
// re-run unchanged after the repository becomes public or the plan changes. Prints names and status only.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = process.argv[2] ?? process.env.GITHUB_REPOSITORY;
if (!repo) {
  console.error("Usage: node scripts/apply-rulesets.mjs <owner>/<repo>  (or set GITHUB_REPOSITORY)");
  process.exit(1);
}
const token = process.env.GH_TOKEN;
if (!token) {
  console.error("Set GH_TOKEN (e.g. GH_TOKEN=$(gh auth token) node scripts/apply-rulesets.mjs)");
  process.exit(1);
}
const dir = fileURLToPath(new URL("../.github/rulesets/", import.meta.url));
const api = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers ?? {}) },
  });

const list = await api("/rulesets");
if (list.status === 403) {
  console.log("Rulesets are not available for this repository on the current plan (private repo on GitHub Free).");
  console.log("They are kept in .github/rulesets/ and apply as soon as the repo is public or on GitHub Pro.");
  process.exit(0);
}
if (!list.ok) {
  console.error(`Cannot list rulesets: HTTP ${list.status}`);
  process.exit(1);
}
const existing = new Map((await list.json()).map((r) => [r.name, r.id]));
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const body = readFileSync(dir + file, "utf8");
  const { name } = JSON.parse(body);
  const id = existing.get(name);
  const res = await api(id ? `/rulesets/${id}` : "/rulesets", { method: id ? "PUT" : "POST", body, headers: { "Content-Type": "application/json" } });
  console.log(`${id ? "updated" : "created"} ${name}: HTTP ${res.status}`);
}
