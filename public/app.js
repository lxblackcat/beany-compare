
// ===== Configuration =====
const API_BASE = window.location.origin;

const RUN_IDS = ["run_02_p06_zhengyin", "run_03_p06_shishen"];
const LEFT_ID = RUN_IDS[0];
const RIGHT_ID = RUN_IDS[1];

const ELEMENT_COLORS = {
  "木": "#4ade80", "火": "#f87171", "土": "#fbbf24",
  "金": "#a1a1aa", "水": "#60a5fa"
};
const AXIS_COLORS = ["#4ade80", "#60a5fa", "#fbbf24", "#fb923c", "#a78bfa"];

// node order for comparison
const COMPARE_NODES = [
  "day1_N1", "day1_N2", "day2_N1", "day2_N2", "day3_N1", "day3_N2"
];

// ===== State =====
let votes = {}; // { node_id: { left: N, right: N } }
let userVotes = {}; // { node_id: "left"|"right" }

// ===== Init =====
async function init() {
  await loadVotes();
  renderSummaries();
  renderCharts();
  renderNodeList();
  renderStats();
  setupTabs();
}

// ===== API =====
async function loadVotes() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (res.ok) votes = await res.json();
    else votes = {};
  } catch (e) {
    console.log("Stats API unavailable, using local", e);
    votes = {};
  }
  // Load user's own votes from localStorage
  try {
    const saved = localStorage.getItem("beany_votes");
    if (saved) userVotes = JSON.parse(saved);
  } catch(e) {}
}

async function submitVote(nodeId, preference) {
  // Optimistic update
  if (!votes[nodeId]) votes[nodeId] = { left: 0, right: 0 };
  votes[nodeId][preference]++;

  userVotes[nodeId] = preference;
  localStorage.setItem("beany_votes", JSON.stringify(userVotes));

  // Re-render
  updateNodeVoteUI(nodeId);
  renderStats();

  try {
    await fetch(`${API_BASE}/api/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId, preference })
    });
  } catch (e) {
    console.log("Vote API unavailable", e);
  }
}

// ===== Render: Summaries =====
function renderSummaries() {
  const grid = document.getElementById("run-summaries");
  grid.innerHTML = "";
  const data = window.BEANY_DATA.runs;

  RUN_IDS.forEach((rid, idx) => {
    const r = data[rid];
    const timeline = r.timeline;
    const days = Object.keys(timeline).filter(k => k.startsWith("day") && k !== "day0");
    const last = days.length > 0 ? timeline[days[days.length-1]] : timeline.day0;
    const first = timeline.day0;

    const health = last?.health ?? first?.health ?? 50;
    const identity = last?.identity_code || first?.identity_code || "";
    const dominant = last?.dominant || first?.dominant || "";
    const axes = last?.["5_axis"] || first?.["5_axis"] || {};
    const weights = last?.weights || first?.weights || {};

    const side = rid === LEFT_ID ? "left" : "right";
    const accent = rid === LEFT_ID ? "var(--accent-left)" : "var(--accent-right)";
    const healthColor = health > 70 ? "green" : "amber";

    let healthBar = `<div class="health-bar"><div class="health-fill ${healthColor}" style="width:${health}%"></div></div>`;

    let axisHTML = "";
    for (const [name, val] of Object.entries(axes)) {
      const pct = Math.round(val * 100);
      const ci = Object.keys(axes).indexOf(name);
      axisHTML += `<div class="axis-row">
        <span class="name">${name}</span>
        <div class="axis-bar"><div class="axis-fill" style="width:${pct}%;background:${AXIS_COLORS[ci]}"></div></div>
        <span style="font-size:12px">${(val*100).toFixed(1)}%</span>
      </div>`;
    }

    let weightHTML = "";
    const wlabels = ["木","火","土","金","水"];
    for (const w of wlabels) {
      const pct = (weights[w] || 0);
      if (pct > 0) {
        weightHTML += `<div class="weight-bar w-${w}" style="width:${pct*2}px;background:${ELEMENT_COLORS[w]||'#888'}">${w}${Math.round(pct)}%</div>`;
      }
    }

    const nodeCount = Object.keys(r.nodes).length;

    grid.innerHTML += `<div class="summary-card summary-${side}" style="border-left-color:${accent}">
      <h3>${idx === 0 ? '🌿' : '🟠'} ${r.name}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div><div class="label">终局人格</div><div class="value" style="font-size:15px">${identity}</div></div>
        <div><div class="label">健康分</div><div class="value">${health}/100</div></div>
        <div><div class="label">节点数</div><div class="value">${nodeCount}</div></div>
        <div><div class="label">Dominant</div><div class="value" style="color:${ELEMENT_COLORS[dominant]||'#fff'}">${dominant}</div></div>
      </div>
      <div class="label" style="margin-bottom:4px">健康分</div>
      ${healthBar}
      <div class="label" style="margin:12px 0 4px">5-Axis</div>
      ${axisHTML}
      <div class="label" style="margin:12px 0 4px">五行权重</div>
      <div class="weights-vis">${weightHTML}</div>
    </div>`;
  });
}

// ===== Render: Charts =====
function renderCharts() {
  const data = window.BEANY_DATA.runs;
  const allDays = ["day0","day1","day2","day3","day4","day5","day6","day7"];
  const axisNames = ["attachment","trust","stability","energy","curiosity"];
  const axisLabels = ["Attachment","Trust","Stability","Energy","Curiosity"];

  // --- 5-axis chart ---
  const canvas = document.getElementById("chart-5axis");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = (rect.width - 32) * dpr;
  canvas.height = 200 * dpr;
  canvas.style.width = (rect.width - 32) + "px";
  canvas.style.height = "200px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const W = canvas.width / dpr;
  const H = 200;
  const pad = { top: 16, bottom: 24, left: 36, right: 16 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  ctx.clearRect(0,0,W,H);

  const runColors = [LEFT_ID, RIGHT_ID];
  const palette = [["#4ade80","#22c55e"], ["#fb923c","#f59e0b"]];

  // For each axis, draw two lines
  axisNames.forEach((ax, ai) => {
    runColors.forEach((rid, ri) => {
      const r = data[rid];
      const stroke = palette[ri][0];
      const fill = palette[ri][1];
      
      const points = allDays.map((d, di) => {
        const entry = r.timeline[d + "_decision"] || r.timeline[d];
        if (!entry || !entry["5_axis"]) return null;
        const val = entry["5_axis"][ax];
        if (val === undefined) return null;
        return {
          x: pad.left + (di / (allDays.length - 1)) * cw,
          y: pad.top + ch - (val / 0.4) * ch
        };
      }).filter(p => p !== null);

      if (points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = ri === 0 ? 2.5 : 2.5;
      ctx.globalAlpha = 0.7 + ai * 0.05;
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Dot at each point
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = stroke;
        ctx.fill();
      });
    });
  });

  // Y-axis labels
  ctx.fillStyle = "#9999b0";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  for (let v = 0; v <= 0.4; v += 0.1) {
    const y = pad.top + ch - (v / 0.4) * ch;
    ctx.fillText((v*100).toFixed(0) + "%", pad.left - 4, y + 3);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
  }

  // X-axis labels
  ctx.textAlign = "center";
  allDays.forEach((d, di) => {
    const x = pad.left + (di / (allDays.length - 1)) * cw;
    ctx.fillText(d, x, H - 4);
  });

  // Legend
  const lgX = W - 120;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(lgX, 8, 12, 3);
  ctx.fillStyle = "#9999b0";
  ctx.fillText("正印", lgX + 16, 12);
  ctx.fillStyle = "#fb923c";
  ctx.fillRect(lgX, 20, 12, 3);
  ctx.fillStyle = "#9999b0";
  ctx.fillText("食神", lgX + 16, 24);

  // Axis labels (small)
  ctx.font = "9px sans-serif";
  axisLabels.forEach((lbl, ai) => {
    ctx.fillStyle = AXIS_COLORS[ai];
    ctx.textAlign = "left";
    ctx.fillText(lbl, W - pad.right - 50, pad.top + 12 + ai * 14);
  });

  // --- Health chart ---
  const canvas2 = document.getElementById("chart-health");
  const rect2 = canvas2.parentElement.getBoundingClientRect();
  canvas2.width = (rect2.width - 32) * dpr;
  canvas2.height = 200 * dpr;
  canvas2.style.width = (rect2.width - 32) + "px";
  canvas2.style.height = "200px";
  const ctx2 = canvas2.getContext("2d");
  ctx2.scale(dpr, dpr);
  const W2 = canvas2.width / dpr;
  const H2 = 200;

  ctx2.clearRect(0,0,W2,H2);
  ctx2.fillStyle = "#9999b0";
  ctx2.font = "10px sans-serif";

  runColors.forEach((rid, ri) => {
    const r = data[rid];
    const stroke = palette[ri][0];
    const points = allDays.map((d, di) => {
      const entry = r.timeline[d + "_decision"] || r.timeline[d];
      if (!entry || !entry.health) return null;
      return {
        x: pad.left + (di / (allDays.length - 1)) * (W2 - pad.left - pad.right),
        y: pad.top + ch - (entry.health / 100) * ch
      };
    }).filter(p => p !== null);

    if (points.length < 2) return;
    ctx2.beginPath();
    ctx2.strokeStyle = stroke;
    ctx2.lineWidth = 2.5;
    points.forEach((p, i) => {
      if (i === 0) ctx2.moveTo(p.x, p.y);
      else ctx2.lineTo(p.x, p.y);
    });
    ctx2.stroke();
    points.forEach(p => {
      ctx2.beginPath();
      ctx2.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx2.fillStyle = stroke;
      ctx2.fill();
      ctx2.fillStyle = "#fff";
      ctx2.textAlign = "center";
      ctx2.font = "8px sans-serif";
      ctx2.fillText(Math.round(p.y * 100 / ch), p.x, p.y - 6);
      ctx2.font = "10px sans-serif";
    });
  });

  // Health Y-axis
  ctx2.fillStyle = "#9999b0";
  for (let v = 0; v <= 100; v += 20) {
    const y = pad.top + ch - (v / 100) * ch;
    ctx2.fillText(v, pad.left - 6, y + 3);
    ctx2.strokeStyle = "rgba(255,255,255,0.04)";
    ctx2.beginPath();
    ctx2.moveTo(pad.left, y);
    ctx2.lineTo(W2 - pad.right, y);
    ctx2.stroke();
  }
  ctx2.textAlign = "center";
  allDays.forEach((d, di) => {
    const x = pad.left + (di / (allDays.length - 1)) * (W2 - pad.left - pad.right);
    ctx2.fillText(d, x, H2 - 4);
  });

  // --- Weights chart ---
  renderWeightsChart();
}

function renderWeightsChart() {
  const data = window.BEANY_DATA.runs;
  const canvas = document.getElementById("chart-weights");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = (rect.width - 32) * dpr;
  canvas.height = 300 * dpr;
  canvas.style.width = (rect.width - 32) + "px";
  canvas.style.height = "300px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const W = canvas.width / dpr;
  const H = 300;
  const pad = { top: 20, bottom: 24, left: 36, right: 60 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;
  const allDays = ["day0","day1","day2","day3","day4","day5","day6","day7"];
  const wlabels = ["木","火","土","金","水"];

  const runColors = [LEFT_ID, RIGHT_ID];
  const palette = [["#4ade80","#22c55e"], ["#fb923c","#f59e0b"]];

  wlabels.forEach((wl, wi) => {
    runColors.forEach((rid, ri) => {
      const r = data[rid];
      const stroke = palette[ri][0];
      const y0 = pad.top + wi * (ch / 5);
      const hbar = ch / 5 - 4;

      // Label
      ctx.fillStyle = ELEMENT_COLORS[wl] || "#888";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(wl, pad.left - 4, y0 + hbar / 2 + 3);

      allDays.forEach((d, di) => {
        const entry = r.timeline[d + "_decision"] || r.timeline[d];
        if (!entry || !entry.weights) return;
        const pct = entry.weights[wl] || 0;
        const x = pad.left + (di / (allDays.length - 1)) * cw;
        const bw = cw / (allDays.length - 1) * 0.6;
        
        const bx = ri === 0 ? x - bw/2 - 1 : x + 1;
        
        ctx.fillStyle = stroke;
        ctx.globalAlpha = ri === 0 ? 0.7 : 0.6;
        ctx.fillRect(bx, y0 + hbar - (pct/50)*hbar, bw, (pct/50)*hbar);
        ctx.globalAlpha = 1;
      });
    });
  });

  // X-axis
  ctx.fillStyle = "#9999b0";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  allDays.forEach((d, di) => {
    const x = pad.left + (di / (allDays.length - 1)) * cw;
    ctx.fillText(d, x, H - 4);
  });

  // Legend
  ctx.textAlign = "left";
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(W - 56, 10, 12, 3);
  ctx.fillStyle = "#9999b0";
  ctx.fillText("正印", W - 40, 14);
  ctx.fillStyle = "#fb923c";
  ctx.fillRect(W - 56, 22, 12, 3);
  ctx.fillText("食神", W - 40, 26);
}

// ===== Render: Node Comparison =====
function renderNodeList() {
  const list = document.getElementById("node-list");
  list.innerHTML = "";
  const data = window.BEANY_DATA.runs;
  const left = data[LEFT_ID];
  const right = data[RIGHT_ID];

  COMPARE_NODES.forEach((nid) => {
    const ln = left.nodes[nid];
    const rn = right.nodes[nid];
    if (!ln && !rn) return;

    const dayNum = nid.match(/day(\d+)/)?.[1] || "?";
    const sessionNum = nid.match(/N(\d+)/)?.[1] || "?";
    const eventL = ln?.event_type || "—";
    const eventR = rn?.event_type || "—";
    const hasLeft = ln && ln.round_count > 0 && ln.beany_rounds.length > 0;
    const hasRight = rn && rn.round_count > 0 && rn.beany_rounds.length > 0;
    const hasBoth = hasLeft && hasRight;
    const votesForNode = votes[nid] || { left: 0, right: 0 };
    const total = votesForNode.left + votesForNode.right;

    list.innerHTML += `<div class="node-card" data-node="${nid}">
      <div class="node-header" onclick="toggleNode('${nid}')">
        <span class="day-badge">Day ${dayNum} · N${sessionNum}</span>
        <span class="event-name">
          <span style="color:var(--accent-left)">${eventL}</span>
          <span style="color:var(--text2)"> / </span>
          <span style="color:var(--accent-right)">${eventR}</span>
        </span>
        <span class="round-count">${hasLeft ? ln.round_count + '轮' : '—'} / ${hasRight ? rn.round_count + '轮' : '—'}</span>
        <span class="arrow">▼</span>
      </div>
      <div class="node-body" id="body-${nid}">
        <div class="compare-grid">
          <div class="compare-side side-left" data-side="left">
            <div class="run-label">🌿 正印 · Beany</div>
            ${hasLeft ? renderBeanySide(ln, nid, "left") : renderEmptyState()}
          </div>
          <div class="compare-side side-right" data-side="right">
            <div class="run-label">🟠 食神 · Beany</div>
            ${hasRight ? renderBeanySide(rn, nid, "right") : renderEmptyState()}
          </div>
        </div>
        <div class="vote-area" data-votearea="${nid}">
          <button class="vote-btn left ${userVotes[nid] === 'left' ? 'selected' : ''}" onclick="submitVote('${nid}','left')">
            🌿 正印更好
          </button>
          <button class="vote-btn right ${userVotes[nid] === 'right' ? 'selected' : ''}" onclick="submitVote('${nid}','right')">
            🟠 食神更好
          </button>
          <span class="vote-stats" id="votestats-${nid}">
            🌿 <span class="num">${votesForNode.left}</span> · 
            🟠 <span class="num">${votesForNode.right}</span>
            <span style="color:var(--text2)">(${total} 票)</span>
          </span>
          ${total > 0 ? `<div class="vote-progress">
            <div class="vote-progress-fill left-fill" style="width:${(votesForNode.left/total*100).toFixed(0)}%"></div>
          </div><span style="font-size:11px;color:var(--text2);margin-left:2px">${(votesForNode.right/total*100).toFixed(0)}%</span>` : ''}
        </div>
      </div>
    </div>`;
  });
}

function renderBeanySide(nodeData, nid, side) {
  const deltas = nodeData.personality_delta;
  let deltaHTML = "";
  if (deltas && Object.keys(deltas).length > 0) {
    const items = Object.entries(deltas).map(([k,v]) => {
      const cls = v > 0 ? "up" : v < 0 ? "down" : "flat";
      const arrow = v > 0 ? "↑" : v < 0 ? "↓" : "→";
      return `<span class="delta-item">${k} <span class="delta-val ${cls}">${arrow}${v > 0 ? '+' : ''}${v}</span></span>`;
    }).join("");
    deltaHTML = `<div class="delta-row">${items}</div>`;
  }

  let envHTML = nodeData.environment
    ? `<div class="env-text">🏠 ${nodeData.environment}</div>`
    : "";

  let roundHTML = nodeData.beany_rounds.map((r, i) => `
    <div class="beany-round">
      <div class="round-num">Round ${i+1}</div>
      <div class="mood">${r.mood ? '💭 ' + r.mood : ''}</div>
      <div class="meaning">${r.meaning ? '📝 ' + r.meaning : ''}</div>
      <div class="action">${r.action ? '👋 ' + r.action : ''}</div>
    </div>
  `).join("");

  return envHTML + roundHTML + deltaHTML;
}

function renderEmptyState() {
  return '<div class="no-interaction"><div class="icon">🌙</div>此节点无互动数据</div>';
}

function toggleNode(nid) {
  const card = document.querySelector(`.node-card[data-node="${nid}"]`);
  const body = document.getElementById(`body-${nid}`);
  const header = card.querySelector(".node-header");
  if (!body) return;
  const isOpen = body.classList.contains("open");
  body.classList.toggle("open");
  header.classList.toggle("open");
}

function updateNodeVoteUI(nid) {
  const v = votes[nid] || { left: 0, right: 0 };
  const total = v.left + v.right;
  const stats = document.getElementById(`votestats-${nid}`);
  if (stats) {
    stats.innerHTML = `🌿 <span class="num">${v.left}</span> · 🟠 <span class="num">${v.right}</span> <span style="color:var(--text2)">(${total} 票)</span>`;
  }
  // Update user vote display
  const btns = document.querySelectorAll(`[data-votearea="${nid}"] .vote-btn`);
  btns.forEach(b => {
    b.classList.remove("selected");
    if (b.classList.contains("left") && userVotes[nid] === "left") b.classList.add("selected");
    if (b.classList.contains("right") && userVotes[nid] === "right") b.classList.add("selected");
  });
}

// ===== Render: Stats =====
function renderStats() {
  const grid = document.getElementById("stats-grid");
  grid.innerHTML = "";
  const data = window.BEANY_DATA.runs;

  COMPARE_NODES.forEach((nid) => {
    const v = votes[nid] || { left: 0, right: 0 };
    const total = v.left + v.right;
    const leftPct = total > 0 ? (v.left / total * 100).toFixed(0) : 50;
    const rightPct = total > 0 ? (v.right / total * 100).toFixed(0) : 50;

    const dayNum = nid.match(/day(\d+)/)?.[1] || "?";
    const eventL = data[LEFT_ID]?.nodes[nid]?.event_type || "—";
    const eventR = data[RIGHT_ID]?.nodes[nid]?.event_type || "—";

    const winner = v.left > v.right ? "🌿 正印" : v.right > v.left ? "🟠 食神" : "⚖️ 平局";

    grid.innerHTML += `<div class="stat-card">
      <div class="stat-header">
        <h4>Day ${dayNum} · N${nid.split('_N')[1] || "?"}</h4>
        <div class="stat-votes">${total} 票</div>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${eventL} / ${eventR}</div>
      <div class="stat-result-bar">
        <div class="left-portion" style="width:${leftPct}%">${leftPct}%</div>
        <div class="right-portion" style="width:${rightPct}%">${rightPct}%</div>
      </div>
      <div style="font-size:12px;display:flex;justify-content:space-between;color:var(--text2)">
        <span>🌿 ${v.left}</span>
        <span style="font-weight:600">${winner}</span>
        <span>${v.right} 🟠</span>
      </div>
    </div>`;
  });
}

// ===== Tabs =====
function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const panel = document.getElementById(`panel-${tab.dataset.tab}`);
      if (panel) panel.classList.add("active");
      // Re-render charts when switching to overview (fix sizing)
      if (tab.dataset.tab === "overview") {
        setTimeout(renderCharts, 50);
      }
    });
  });
}

// ===== Start =====
document.addEventListener("DOMContentLoaded", init);
