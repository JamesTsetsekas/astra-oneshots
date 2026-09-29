import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arcade = path.join(root, "outputs", "arcade");
const site = path.join(root, "site");
const games = JSON.parse(fs.readFileSync(path.join(arcade, "games.json"), "utf8"));
fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(site, { recursive: true });
fs.mkdirSync(path.join(site, "screenshots"), { recursive: true });
for (const file of ["index.html", "style.css", "app.js", "games.json"]) {
  fs.copyFileSync(path.join(arcade, file), path.join(site, file));
}
const replaceRootAssets = (text) => text
  .replaceAll('"/assets/', '"./assets/')
  .replaceAll("'/assets/", "'./assets/")
  .replaceAll('"/manifest.webmanifest', '"./manifest.webmanifest')
  .replaceAll('"/icon.svg', '"./icon.svg');
for (const game of games) {
  const source = path.join(root, "outputs", game.folder, "dist");
  const target = path.join(site, "games", game.id);
  fs.cpSync(source, target, { recursive: true });
  const all = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|js|css|json|webmanifest)$/.test(entry.name)) all.push(full);
    }
  };
  walk(target);
  for (const file of all) fs.writeFileSync(file, replaceRootAssets(fs.readFileSync(file, "utf8")));
  const screenshot = path.join(root, "outputs", game.folder, game.image);
  fs.copyFileSync(screenshot, path.join(site, "screenshots", `${game.id}.png`));
}
// Copy screenshots from the evidence captures used by the local launcher.
for (const game of games) {
  const screenshot = path.join(root, "outputs", game.folder, game.image);
  fs.copyFileSync(screenshot, path.join(site, "screenshots", `${game.id}.png`));
}
fs.writeFileSync(path.join(site, ".nojekyll"), "");
console.log(`Prepared ${games.length} games for GitHub Pages in ${site}`);
