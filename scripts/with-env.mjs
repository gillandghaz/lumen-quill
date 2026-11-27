// Run a Next.js command with secrets loaded from a file OUTSIDE the repo:
//
//   node --env-file=<secrets file> scripts/with-env.mjs dev|build|start [args...]
//
// Next.js forwards Node flags to its build workers through NODE_OPTIONS, where --env-file is not allowed,
// so this wrapper loads the file once and starts Next as a child process with the variables in its environment.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const r = spawnSync(process.execPath, [next, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
