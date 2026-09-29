const glyphs = {
  shardfront: "△",
  ashfall: "♜",
  breachline: "⌖",
  protocol: "◈",
  crownfall: "♛",
  skybreak: "◇",
  meridian: "↗",
  farestorm: "〰",
};
let refreshTimer;
async function render(attempt = 0) {
  clearTimeout(refreshTimer);
  try {
    const local = await fetch("/api/games", { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("Local status unavailable");
      return r.json();
    }).catch(() => null);
    const games = local ?? await fetch("./games.json", { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("Static game manifest unavailable");
      return r.json();
    });
    const staticMode = !local;
    document.getElementById("count").textContent =
      `${games.filter((g) => staticMode || g.running).length} / ${games.length} READY TO PLAY`;
    document.getElementById("games").replaceChildren(
      ...games.map((g, i) => {
        const card = document.createElement("article");
        card.className = `game game-${g.id}`;
        const image = document.createElement("div");
        image.className = "preview";
        if (g.screenshot) {
          const img = document.createElement("img");
          img.src = staticMode ? `./screenshots/${g.id}.png` : `/screenshots/${g.id}`;
          img.alt = `${g.name} actual gameplay`;
          img.loading = "lazy";
          image.append(img);
        } else {
          const motif = document.createElement("span");
          motif.className = "motif";
          motif.textContent = glyphs[g.id];
          image.append(motif);
        }
        const num = document.createElement("span");
        num.className = "number";
        num.textContent = String(i + 1).padStart(2, "0");
        image.append(num);
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = g.tag;
        image.append(badge);
        const details = document.createElement("div");
        details.className = "details";
        const genre = document.createElement("p");
        genre.className = "genre";
        genre.textContent = g.genre;
        const title = document.createElement("h2");
        title.textContent = g.name;
        const description = document.createElement("p");
        description.className = "description";
        description.textContent = g.description;
        const link = document.createElement("a");
        link.href = staticMode ? `./games/${g.id}/` : `http://127.0.0.1:${g.port}/`;
        link.target = "_blank";
        link.rel = "noopener";
        if (g.id === "breachline")
          link.title = g.relayReady
            ? "Local bot game and optional local WebSocket relay are available."
            : "Local bot game. Optional local relay is not confirmed on this server.";
        const ready = staticMode || g.running;
        link.className = ready ? "play" : "play disabled";
        link.setAttribute("aria-disabled", String(!ready));
        link.textContent = ready ? "PLAY GAME" : "BUILD NOT RUNNING";
        const arrow = document.createElement("span");
        arrow.textContent = "↗";
        link.append(arrow);
        if (!ready)
          link.addEventListener("click", (e) => e.preventDefault());
        details.append(genre, title, description, link);
        card.append(image, details);
        return card;
      }),
    );
    if (
      games.some(
        (g) => !staticMode && (!g.running || (g.id === "breachline" && !g.relayReady)),
      ) &&
      attempt < 8
    )
      refreshTimer = setTimeout(() => render(attempt + 1), 2000);
  } catch {
    document.getElementById("count").textContent = "LOCAL SERVER UNAVAILABLE";
    if (attempt < 8) refreshTimer = setTimeout(() => render(attempt + 1), 2000);
  }
}
document.getElementById("refresh").addEventListener("click", () => render());
render();
