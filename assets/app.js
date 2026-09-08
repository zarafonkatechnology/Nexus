const API = "/api/v1";
let lastQuotes = [];

function fmtPrice(v) {
  const n = parseFloat(v);
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: n > 100 ? 3 : 5, maximumFractionDigits: n > 100 ? 3 : 5 });
}

function chgClass(c) { return c >= 0 ? "up" : "down"; }

function pairName(sym) {
  return sym.length === 6 ? sym.slice(0, 3) + "/" + sym.slice(3) : sym;
}

function timeAgo(ts) {
  if (!ts) return "—";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return s < 5 ? "now" : s + "s ago";
}

async function loadQuotes() {
  try {
    const res = await fetch(API + "/market/quotes");
    if (!res.ok) throw new Error(res.status);
    lastQuotes = await res.json();
    renderMini(lastQuotes);
    renderTable(lastQuotes);
    const st = document.getElementById("feed-status");
    if (st) { st.textContent = "live"; st.style.color = "#22c55e"; }
  } catch (e) {
    const st = document.getElementById("feed-status");
    if (st) { st.textContent = "offline — retrying"; st.style.color = "#ef4444"; }
  }
}

function renderMini(list) {
  const el = document.getElementById("mini-ticker");
  if (!el || !list.length) return;
  const top = [...list].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct)).slice(0, 4);
  el.innerHTML = top.map(q => `
    <div class="trow">
      <div><span class="sym">${pairName(q.symbol)}</span></div>
      <div class="mid">${fmtPrice(q.price)}</div>
      <div class="chg ${chgClass(q.change_pct)}">${q.change_pct >= 0 ? "+" : ""}${q.change_pct.toFixed(2)}%</div>
    </div>`).join("");
}

function renderTable(list) {
  const body = document.getElementById("market-body");
  if (!body || !list.length) return;
  body.innerHTML = list.map(q => `
    <tr>
      <td><strong>${pairName(q.symbol)}</strong></td>
      <td>${fmtPrice(q.bid)}</td>
      <td>${fmtPrice(q.ask)}</td>
      <td><span class="badge ${chgClass(q.change_pct)}">${q.change_pct >= 0 ? "+" : ""}${q.change_pct.toFixed(2)}%</span></td>
      <td class="muted" data-ts="${q.ts}">${timeAgo(q.ts)}</td>
    </tr>`).join("");
}

setInterval(() => {
  document.querySelectorAll("#market-body td[data-ts]").forEach(td => {
    td.textContent = timeAgo(parseInt(td.dataset.ts));
  });
}, 2000);

function detectOS() {
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return { id: "android", label: "Android" };
  if (/iphone|ipad|ipod/.test(ua)) return { id: "ios", label: "iOS" };
  if (/macintosh|mac os x/.test(ua) && !/iphone/.test(ua)) return { id: "macos", label: "macOS" };
  if (/windows/.test(ua)) return { id: "windows", label: "Windows" };
  if (/linux/.test(ua) && !/android/.test(ua)) return { id: "linux", label: "Linux" };
  return null;
}

async function loadReleases() {
  let releases = {};
  try {
    const res = await fetch(API + "/releases/latest");
    if (res.ok) {
      const data = await res.json();
      releases = Object.fromEntries((data.platforms || []).map(p => [p.id, p]));
      const v = document.querySelector(".dl-sub");
      if (v && data.version) v.dataset.version = data.version;
    }
  } catch (e) {}

  const os = detectOS();
  const labelEl = document.getElementById("detected-os");

  document.querySelectorAll(".dl-card").forEach(card => {
    const id = card.dataset.platform;
    const meta = card.querySelector(".dl-meta");
    const info = releases[id];

    if (info && info.available) {
      meta.textContent = `v${info.version} · ${(info.size_mb || 0).toFixed(1)} MB`;
    } else {
      card.classList.add("unavailable");
      meta.textContent = "build pending";
    }

    if (os && os.id === id) {
      card.classList.add("recommended");
      if (labelEl) labelEl.textContent = os.label + (info?.available ? " ✔ ready to install" : "");
    }
  });

  if (labelEl && !os) labelEl.textContent = "your platform";

  document.querySelectorAll(".dl-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.platform;
      const name = card.querySelector(".dl-name").textContent;
      if (card.classList.contains("unavailable")) {
        toast(`${name} build is not published yet. Run scripts/build_all.sh on the server, then refresh this page.`);
        return;
      }
      window.location.href = `/download/${id}`;
      toast(`Downloading Nexus for ${name}…`);
    });
  });
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 4200);
}

loadQuotes();
setInterval(loadQuotes, 3000);
loadReleases();
