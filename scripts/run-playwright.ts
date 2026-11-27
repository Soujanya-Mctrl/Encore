import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const browsers = path.resolve(".local/ms-playwright");
const result = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, ...(existsSync(browsers) && !process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: browsers } : {}) }
});
process.exitCode = result.status ?? 1;
