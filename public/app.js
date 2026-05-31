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

const COMPARE_NODES = ["day1_N1","day1_N2","day2_N1","day2_N2","day3_N1","day3_N2"];

// map Chinese↔English element names
const ELEM_CN = {"wood":"木","fire":"火","earth":"土","metal":"金","water":"水"};
const ELEM_EN = {"木":"wood","火":"fire","土":"earth","金":"metal","水":"water"};

// ===== State =====
let votes = {};       // { "day1_N1_R01": {left:N, right:N}, ... }
let userVotes = {};   // { "day1_N1_R01": "left"|"right", ... }

// ===== Init =====
async function init() {
  await loadVotes();
  renderSummaries();
  renderCharts();
  renderNodeList();
  renderStats();
  setupTabs();
}

// ===== Helpers =====
function normalizeWeights(w) {
  // Accept both {wood:0.3} and {木:0.3}; always return Chinese keys
  if (!w) return {};
  const out = {};
  for (const [k,v] of Object.entries(w)) {
    const cn = ELEM_CN[k] || k;  // English→Chinese, else keep
    out[cn] = v;
  }
  return out;
}

// ===== API =====
async function loadVotes() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (res.ok) votes = await res.json();
  } catch(e) {}
  try {
    const saved = localStorage.getItem("beany_votes");
    if (saved) userVotes = JSON.parse(saved);
  } catch(e) {}
}

async function submitVote(voteKey, preference) {
  if (!votes[voteKey]) votes[voteKey] = { left:0, right:0 };
  votes[voteKey][preference]++;
  userVotes[voteKey] = preference;
  localStorage.setItem("beany_votes", JSON.stringify(userVotes));
  updateAllUI();
  await fetch(`${API_BASE}/api/vote`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ node_id: voteKey, preference })
  }).catch(()=>{});
}

function updateAllUI() {
  renderStats();
  // update vote buttons in all open nodes
  document.querySelectorAll('[data-votekey]').forEach(el => {
    const vk = el.dataset.votekey;
    const v = votes[vk] || {left:0,right:0};
    const pref = userVotes[vk];
    const total = v.left + v.right;
    const statsEl = el.querySelector('.vote-stats');
    if (statsEl) {
      statsEl.innerHTML = `🌿 <span class="num">${v.left}</span> · 🟠 <span class="num">${v.right}</span> <span style="color:var(--text2)">(${total}票)</span>`;
    }
    el.querySelectorAll('.vote-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.side === pref);
    });
    const bar = el.querySelector('.vote-progress-fill');
    if (bar && total > 0) {
      bar.style.width = (v.left/total*100).toFixed(0)+'%';
    }
  });
}

// ===== Render: Summaries =====
function renderSummaries() {
  const grid = document.getElementById("run-summaries");
  grid.innerHTML = "";
  const d = window.BEANY_DATA.runs;
  RUN_IDS.forEach((rid, idx) => {
    const r = d[rid];
    const tl = r.timeline;
    const days = Object.keys(tl).filter(k => k.startsWith("day") && k!=="day0" && tl[k].health);
    const last = days.length ? tl[days[days.length-1]] : tl.day0;
    const first = tl.day0;
    const health = last?.health ?? 50;
    const identity = last?.identity_code || "";
    const dominant = last?.dominant || first?.dominant || "";
    const axes = last?.["5_axis"] || first?.["5_axis"] || {};
    const weights = normalizeWeights(last?.weights || first?.weights || {});
    const side = rid===LEFT_ID ? "left" : "right";
    const accent = rid===LEFT_ID ? "var(--accent-left)" : "var(--accent-right)";

    let axisHTML = Object.entries(axes).map(([name,val],i) =>
      `<div class="axis-row">
        <span class="name">${name}</span>
        <div class="axis-bar"><div class="axis-fill" style="width:${val*100}%;background:${AXIS_COLORS[i]}"></div></div>
        <span style="font-size:12px">${(val*100).toFixed(1)}%</span>
      </div>`
    ).join("");

    let weightHTML = ["木","火","土","金","水"].map(w => {
      const pct = (weights[w]||0)*2;
      return pct > 0 ? `<div class="weight-bar w-${w}" style="width:${pct}px">${w}${Math.round(weights[w])}%</div>` : "";
    }).join("");

    grid.innerHTML += `<div class="summary-card summary-${side}" style="border-left-color:${accent}">
      <h3>${idx===0?'🌿':'🟠'} ${r.name}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div><div class="label">终局人格</div><div class="value" style="font-size:15px">${identity||'—'}</div></div>
        <div><div class="label">健康分</div><div class="value">${health}/100</div></div>
        <div><div class="label">节点数</div><div class="value">${Object.keys(r.nodes).length}</div></div>
        <div><div class="label">Dominant</div><div class="value" style="color:${ELEMENT_COLORS[dominant]||'#fff'}">${dominant || '—'}</div></div>
      </div>
      <div class="label" style="margin-bottom:4px">健康分</div>
      <div class="health-bar"><div class="health-fill ${health>70?'green':'amber'}" style="width:${health}%"></div></div>
      <div class="label" style="margin:12px 0 4px">5-Axis</div>
      ${axisHTML}
      <div class="label" style="margin:12px 0 4px">五行权重</div>
      <div class="weights-vis">${weightHTML}</div>
    </div>`;
  });
}

// ===== Render: Charts =====
function renderCharts() {
  const runsData = window.BEANY_DATA.runs;
  const allDays = ["day0","day1","day2","day3","day4","day5","day6","day7"];
  const axisNames = ["attachment","trust","stability","energy","curiosity"];
  const axisLabels = ["Attachment","Trust","Stability","Energy","Curiosity"];
  const wlabels = ["木","火","土","金","水"];
  const dpr = window.devicePixelRatio || 1;

  // --- 5-axis chart ---
  const c1 = document.getElementById("chart-5axis");
  const r1 = c1.parentElement.getBoundingClientRect();
  c1.width = (r1.width-32)*dpr; c1.height = 200*dpr;
  c1.style.width = (r1.width-32)+"px"; c1.style.height = "200px";
  const ctx = c1.getContext("2d"); ctx.scale(dpr,dpr);
  const W = c1.width/dpr, H=200, pad={top:16,bottom:24,left:36,right:16};
  const cw = W-pad.left-pad.right, ch = H-pad.top-pad.bottom;
  ctx.clearRect(0,0,W,H);
  const pal = [["#4ade80","#22c55e"],["#fb923c","#f59e0b"]];

  axisNames.forEach((ax, ai) => {
    [LEFT_ID,RIGHT_ID].forEach((rid, ri) => {
      const pts = allDays.map((dd, di) => {
        const e = runsData[rid].timeline[dd+"_decision"] || runsData[rid].timeline[dd];
        if (!e||!e["5_axis"]) return null;
        const v = e["5_axis"][ax];
        return v!=null ? { x: pad.left+(di/(allDays.length-1))*cw, y: pad.top+ch-(v/0.4)*ch } : null;
      }).filter(p=>p);
      if (pts.length<2) return;
      ctx.beginPath(); ctx.strokeStyle = pal[ri][0]; ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.6+ai*0.07;
      pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.stroke(); ctx.globalAlpha = 1;
      pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fillStyle=pal[ri][0];ctx.fill();});
    });
  });
  ctx.fillStyle="#9999b0"; ctx.font="10px sans-serif"; ctx.textAlign="right";
  for(let v=0;v<=0.4;v+=0.1){const y=pad.top+ch-(v/0.4)*ch;ctx.fillText((v*100).toFixed(0)+"%",pad.left-4,y+3);ctx.strokeStyle="rgba(255,255,255,0.04)";ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();}
  ctx.textAlign="center"; allDays.forEach((d,di)=>{ctx.fillText(d,pad.left+(di/(allDays.length-1))*cw,H-4);});
  ctx.textAlign="left"; ctx.font="11px sans-serif";
  ctx.fillStyle="#4ade80"; ctx.fillRect(W-120,8,12,3); ctx.fillStyle="#9999b0"; ctx.fillText("正印",W-104,12);
  ctx.fillStyle="#fb923c"; ctx.fillRect(W-120,20,12,3); ctx.fillText("食神",W-104,24);

  // --- Health chart ---
  const c2 = document.getElementById("chart-health");
  c2.width = (r1.width-32)*dpr; c2.height = 200*dpr;
  c2.style.width = (r1.width-32)+"px"; c2.style.height="200px";
  const ctx2 = c2.getContext("2d"); ctx2.scale(dpr,dpr);
  const W2=c2.width/dpr, H2=200;
  ctx2.clearRect(0,0,W2,H2);
  [LEFT_ID,RIGHT_ID].forEach((rid,ri)=>{
    const pts = allDays.map((dd,di)=>{
      const e = runsData[rid].timeline[dd+"_decision"] || runsData[rid].timeline[dd];
      if(!e||!e.health) return null;
      return {x:pad.left+(di/(allDays.length-1))*(W2-pad.left-pad.right), y:pad.top+ch-(e.health/100)*ch};
    }).filter(p=>p);
    if(pts.length<2) return;
    ctx2.beginPath(); ctx2.strokeStyle=pal[ri][0]; ctx2.lineWidth=2.5;
    pts.forEach((p,i)=>i===0?ctx2.moveTo(p.x,p.y):ctx2.lineTo(p.x,p.y));
    ctx2.stroke();
    pts.forEach(p=>{ctx2.beginPath();ctx2.arc(p.x,p.y,4,0,Math.PI*2);ctx2.fillStyle=pal[ri][0];ctx2.fill();});
  });
  ctx2.fillStyle="#9999b0"; ctx2.font="10px sans-serif"; ctx2.textAlign="right";
  for(let v=0;v<=100;v+=20){const y=pad.top+ch-(v/100)*ch;ctx2.fillText(v,pad.left-6,y+3);}
  ctx2.textAlign="center"; allDays.forEach((d,di)=>{ctx2.fillText(d,pad.left+(di/(allDays.length-1))*(W2-pad.left-pad.right),H2-4);});

  // --- Weights chart ---
  const c3 = document.getElementById("chart-weights");
  c3.width = (r1.width-32)*dpr; c3.height = 300*dpr;
  c3.style.width = (r1.width-32)+"px"; c3.style.height="300px";
  const ctx3 = c3.getContext("2d"); ctx3.scale(dpr,dpr);
  const W3=c3.width/dpr, H3=300;
  ctx3.clearRect(0,0,W3,H3);
  const p2 = [["#4ade80","#22c55e"],["#fb923c","#f59e0b"]];
  wlabels.forEach((wl,wi) => {
    [LEFT_ID,RIGHT_ID].forEach((rid,ri)=>{
      ctx3.fillStyle=ELEMENT_COLORS[wl]; ctx3.font="10px sans-serif"; ctx3.textAlign="right";
      ctx3.fillText(wl, pad.left-4, pad.top+wi*(ch/5)+(ch/5-4)/2+3);
      allDays.forEach((dd,di)=>{const e = runsData[rid].timeline[dd+"_decision"] || runsData[rid].timeline[dd];
        if(!e||!e.weights) return;
        const w = normalizeWeights(e.weights);
        const pct = w[wl]||0;
        if(pct===0) return;
        const x = pad.left+(di/(allDays.length-1))*(W3-pad.left-pad.right);
        const bw = cw/(allDays.length-1)*0.6;
        const bx = ri===0 ? x-bw/2-1 : x+1;
        ctx3.fillStyle = p2[ri][0]; ctx3.globalAlpha = ri===0?0.7:0.6;
        ctx3.fillRect(bx, pad.top+wi*(ch/5)+(ch/5-4)-(pct/50)*(ch/5-4), bw, (pct/50)*(ch/5-4));
        ctx3.globalAlpha = 1;
      });
    });
  });
  ctx3.fillStyle="#9999b0"; ctx3.font="10px sans-serif"; ctx3.textAlign="center";
  allDays.forEach((d,di)=>{ctx3.fillText(d,pad.left+(di/(allDays.length-1))*(W3-pad.left-pad.right),H3-4);});
}

// ===== Render: Node List =====
function renderNodeList() {
  const list = document.getElementById("node-list");
  list.innerHTML = "";
  const d = window.BEANY_DATA.runs;
  COMPARE_NODES.forEach(nid => {
    const ln = d[LEFT_ID]  .nodes[nid];
    const rn = d[RIGHT_ID] .nodes[nid];
    if(!ln && !rn) return;
    const dayNum = nid.match(/day(\d+)/)?.[1]||"?";
    const sesNum = nid.match(/N(\d+)/)?.[1]||"?";
    const eventL = ln?.event_type||"—", eventR = rn?.event_type||"—";

    list.innerHTML += `<div class="node-card" data-node="${nid}">
      <div class="node-header" onclick="toggleNode('${nid}')">
        <span class="day-badge">Day ${dayNum} · N${sesNum}</span>
        <span class="event-name">
          <span style="color:var(--accent-left)">${eventL}</span>
          <span style="color:var(--text2)"> / </span>
          <span style="color:var(--accent-right)">${eventR}</span>
        </span>
        <span class="arrow">▼</span>
      </div>
      <div class="node-body" id="body-${nid}">
        <div class="compare-grid" id="grid-${nid}"></div>
      </div>
    </div>`;
    // Now render rounds
    renderNodeRounds(nid);
  });
}

function renderNodeRounds(nid) {
  const grid = document.getElementById(`grid-${nid}`);
  if(!grid) return;
  const d = window.BEANY_DATA.runs;
  const ln = d[LEFT_ID] .nodes[nid];
  const rn = d[RIGHT_ID].nodes[nid];
  const maxRounds = Math.max(ln?.beany_rounds?.length||0, rn?.beany_rounds?.length||0);

  for(let ri=0; ri<maxRounds; ri++) {
    const lr = ln?.beany_rounds?.[ri] || null;
    const rr = rn?.beany_rounds?.[ri] || null;
    const roundLabel = `R${String(ri+1).padStart(2,'0')}`;
    const voteKey = `${nid}_${roundLabel}`;
    const v = votes[voteKey] || {left:0,right:0};
    const total = v.left+v.right;
    const userPref = userVotes[voteKey];

    grid.innerHTML += `<div style="grid-column:1/-1">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 4px;font-size:12px;color:var(--text2)">
        <span>Round ${ri+1}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="compare-side side-left" style="border-top:3px solid var(--accent-left)">
          ${lr ? renderRoundContent(lr) : '<div class="no-interaction" style="padding:12px;text-align:center;color:var(--text2);font-size:12px">无此轮数据</div>'}
        </div>
        <div class="compare-side side-right" style="border-top:3px solid var(--accent-right)">
          ${rr ? renderRoundContent(rr) : '<div class="no-interaction" style="padding:12px;text-align:center;color:var(--text2);font-size:12px">无此轮数据</div>'}
        </div>
      </div>
      <div class="vote-area" data-votekey="${voteKey}">
        <button class="vote-btn left" data-side="left" onclick="submitVote('${voteKey}','left')">🌿 正印更好</button>
        <button class="vote-btn right" data-side="right" onclick="submitVote('${voteKey}','right')">🟠 食神更好</button>
        <span class="vote-stats">🌿 <span class="num">${v.left}</span> · 🟠 <span class="num">${v.right}</span> <span style="color:var(--text2)">(${total}票)</span></span>
        ${total>0 ? `<div class="vote-progress"><div class="vote-progress-fill left-fill" style="width:${(v.left/total*100).toFixed(0)}%"></div></div><span style="font-size:11px;color:var(--text2)">${(v.right/total*100).toFixed(0)}%</span>` : ''}
      </div>
    </div>`;
  }

  // Also show node-level environment and personality delta
  if(ln?.environment || rn?.environment) {
    grid.innerHTML += `<div style="grid-column:1/-1;margin-top:8px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="compare-side side-left" style="border-top:3px solid var(--accent-left)">
          ${ln?.environment ? `<div class="env-text">🏠 ${ln.environment}</div>` : ''}
          ${renderDelta(ln?.personality_delta)}
        </div>
        <div class="compare-side side-right" style="border-top:3px solid var(--accent-right)">
          ${rn?.environment ? `<div class="env-text">🏠 ${rn.environment}</div>` : ''}
          ${renderDelta(rn?.personality_delta)}
        </div>
      </div>
    </div>`;
  }
}

function renderRoundContent(r) {
  return `<div class="beany-round">
    ${r.mood ? `<div class="mood">💭 ${r.mood}</div>` : ''}
    ${r.meaning ? `<div class="meaning">📝 ${r.meaning}</div>` : ''}
    ${r.action ? `<div class="action">👋 ${r.action}</div>` : ''}
  </div>`;
}

function renderDelta(delta) {
  if(!delta || !Object.keys(delta).length) return '';
  const items = Object.entries(delta).map(([k,v]) => {
    const cls = v>0?"up":v<0?"down":"flat";
    const arr = v>0?"↑":v<0?"↓":"→";
    return `<span class="delta-item">${k} <span class="delta-val ${cls}">${arr}${v>0?'+':''}${v}</span></span>`;
  }).join("");
  return `<div class="delta-row">${items}</div>`;
}

function toggleNode(nid) {
  const card = document.querySelector(`.node-card[data-node="${nid}"]`);
  const body = document.getElementById(`body-${nid}`);
  const header = card?.querySelector(".node-header");
  if(!body) return;
  body.classList.toggle("open");
  header?.classList.toggle("open");
}

// ===== Render: Stats =====
function renderStats() {
  const grid = document.getElementById("stats-grid");
  grid.innerHTML = "";
  COMPARE_NODES.forEach(nid => {
    const maxRounds = 8; // enough for all nodes
    let totalLeft=0, totalRight=0, totalVotes=0;

    for(let ri=0; ri<maxRounds; ri++) {
      const rl = `R${String(ri+1).padStart(2,'0')}`;
      const v = votes[`${nid}_${rl}`] || {left:0,right:0};
      totalLeft += v.left;
      totalRight += v.right;
    }
    totalVotes = totalLeft + totalRight;
    if(totalVotes === 0) return; // skip empty

    const leftPct = totalVotes>0 ? (totalLeft/totalVotes*100).toFixed(0) : 50;
    const rightPct = totalVotes>0 ? (totalRight/totalVotes*100).toFixed(0) : 50;
    const dayNum = nid.match(/day(\d+)/)?.[1]||"?";
    const winner = totalLeft>totalRight ? "🌿 正印" : totalRight>totalLeft ? "🟠 食神" : "⚖️ 平局";

    // Per-round breakdown
    let breakdown = "";
    for(let ri=0; ri<maxRounds; ri++) {
      const rl = `R${String(ri+1).padStart(2,'0')}`;
      const v = votes[`${nid}_${rl}`] || {left:0,right:0};
      if(v.left+v.right === 0) continue;
      breakdown += `<span style="font-size:11px;color:var(--text2);margin-right:8px">${rl}: 🌿${v.left} 🟠${v.right}</span>`;
    }

    grid.innerHTML += `<div class="stat-card">
      <div class="stat-header"><h4>Day ${dayNum} · ${nid.split('_N')[1]||"?"}</h4><div class="stat-votes">${totalVotes} 票</div></div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${breakdown}</div>
      <div class="stat-result-bar">
        <div class="left-portion" style="width:${leftPct}%">${leftPct}%</div>
        <div class="right-portion" style="width:${rightPct}%">${rightPct}%</div>
      </div>
      <div style="font-size:12px;display:flex;justify-content:space-between;color:var(--text2)">
        <span>🌿 ${totalLeft}</span>
        <span style="font-weight:600">${winner}</span>
        <span>${totalRight} 🟠</span>
      </div>
    </div>`;
  });
}

// ===== Tabs =====
function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab,.panel").forEach(el => el.classList.remove("active"));
      tab.classList.add("active");
      const p = document.getElementById(`panel-${tab.dataset.tab}`);
      if(p) { p.classList.add("active"); }
      if(tab.dataset.tab==="overview") setTimeout(renderCharts,50);
    });
  });
}

// ===== Start =====
document.addEventListener("DOMContentLoaded", init);
