import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const games = [
  "shardfront-rts",
  "ashfall-covenant-arpg",
  "breachline-fps",
  "last-protocol-fps",
  "crownfall-moba",
  "skybreak-br",
  "meridian-run",
  "farestorm",
];
const action = process.argv[2];
const commands = {
  setup: [["ci"], ["run", "build"]],
  install: [["ci"]],
  build: [["run", "build"]],
  test: [["test"]],
};
if (!Object.hasOwn(commands, action)) {
  console.error("Use npm run setup, npm run install:games, npm run build, or npm test.");
  process.exit(1);
}
const npm = process.env.npm_execpath;
if (!npm || !existsSync(npm)) {
  console.error("Run this script through npm so its CLI path is available.");
  process.exit(1);
}
for (const game of games) {
  const directory = path.join(root, "outputs", game);
  for (const args of commands[action]) {
    console.log(`\n[${game}] npm ${args.join(" ")}`);
    const result = spawnSync(process.execPath, [npm, ...args], {
      cwd: directory,
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.error || result.status !== 0) {
      console.error(`Stopped at ${game}: ${result.error?.message ?? `exit ${result.status ?? result.signal}`}`);
      process.exit(result.status || 1);
    }
  }
}
console.log(`\n${action} completed for all ${games.length} games.`);
