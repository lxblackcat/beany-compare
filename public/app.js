// ===== Configuration =====
const API_BASE = window.location.origin;
const RUN_IDS = ["run_02_p06_zhengyin", "run_03_p06_shishen"];
const LEFT_ID = RUN_IDS[0], RIGHT_ID = RUN_IDS[1];
const ELEMENT_COLORS = { "木":"#4ade80","火":"#f87171","土":"#fbbf24","金":"#a1a1aa","水":"#60a5fa" };
const AXIS_COLORS = ["#4ade80","#60a5fa","#fbbf24","#fb923c","#a78bfa"];
const AXIS_NAMES = ["attachment","trust","stability","energy","curiosity"];
const AXIS_LABELS = ["Attachment","Trust","Stability","Energy","Curiosity"];
const ELEM_CN = {"wood":"木","fire":"火","earth":"土","metal":"金","water":"水"};
const COMPARE_NODES = ["day1_N1","day1_N2","day2_N1","day2_N2","day3_N1","day3_N2"];
const DAYS = ["day0","day1","day2","day3","day4","day5","day6","day7"];

let votes = {}, userVotes = {};

function normalizeWeights(w) {
  if (!w) return {};
  const out = {};
  for (const [k,v] of Object.entries(w)) out[ELEM_CN[k] || k] = v;
  return out;
}

// ===== API =====
async function loadVotes() {
  try { const r = await fetch(`${API_BASE}/api/stats`); if(r.ok) votes = await r.json(); } catch(e) {}
  try { const s = localStorage.getItem("beany_votes"); if(s) userVotes = JSON.parse(s); } catch(e) {}
}

async function submitVote(voteKey, pref) {
  if (!votes[voteKey]) votes[voteKey] = {left:0,right:0};
  votes[voteKey][pref]++; userVotes[voteKey] = pref;
  localStorage.setItem("beany_votes", JSON.stringify(userVotes));
  updateVoteUI();
  await fetch(`${API_BASE}/api/vote`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({node_id:voteKey, preference:pref})
  }).catch(()=>{});
}

function updateVoteUI() {
  renderRanking();
  document.querySelectorAll('[data-votekey]').forEach(el => {
    const vk = el.dataset.votekey;
    const v = votes[vk] || {left:0,right:0};
    const total = v.left + v.right;
    el.querySelector('.vote-stats').innerHTML =
      `🌿 <span class="num">${v.left}</span> · 🟠 <span class="num">${v.right}</span> <span style="color:var(--text2)">(${total}票)</span>`;
    el.querySelectorAll('.vote-btn').forEach(b => b.classList.toggle('selected', b.dataset.side === userVotes[vk]));
    const bar = el.querySelector('.vote-progress-fill');
    if (bar && total > 0) bar.style.width = (v.left/total*100).toFixed(0)+'%';
  });
  renderStats();
}

// ===== Init =====
async function init() {
  await loadVotes();
  renderSummaries();
  renderCharts();
  renderNodeList();
  renderRanking();
  renderStats();
  setupTabs();
}

// ===== Summaries =====
function renderSummaries() {
  const grid = document.getElementById("run-summaries");
  grid.innerHTML = "";
  const d = window.BEANY_DATA.runs;
  RUN_IDS.forEach((rid, idx) => {
    const r = d[rid], tl = r.timeline;
    const days = Object.keys(tl).filter(k => k.startsWith("day") && k!=="day0" && tl[k].health);
    const last = days.length ? tl[days[days.length-1]] : tl.day0;
    const health = last?.health ?? 50, identity = last?.identity_code || "";
    const axes = last?.["5_axis"] || tl.day0?.["5_axis"] || {};
    const weights = normalizeWeights(last?.weights || tl.day0?.weights || {});
    const accent = rid===LEFT_ID ? "var(--accent-left)" : "var(--accent-right)";
    const side = rid===LEFT_ID ? "left" : "right";
    const nodeCount = Object.keys(r.nodes).length;

    let axisHTML = AXIS_NAMES.map((n,i) => `<div class="axis-row">
      <span class="name">${AXIS_LABELS[i]}</span>
      <div class="axis-bar"><div class="axis-fill" style="width:${(axes[n]||0)*100}%;background:${AXIS_COLORS[i]}"></div></div>
      <span style="font-size:12px">${((axes[n]||0)*100).toFixed(1)}%</span>
    </div>`).join("");

    let wHTML = ["木","火","土","金","水"].map(w => {
      const p = (weights[w]||0)*2;
      return p>0 ? `<div class="weight-bar w-${w}" style="width:${p}px">${w}${Math.round(weights[w])}%</div>` : "";
    }).join("");

    grid.innerHTML += `<div class="summary-card summary-${side}" style="border-left-color:${accent}">
      <h3>${idx===0?'🌿':'🟠'} ${r.name}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div><div class="label">终局人格</div><div class="value" style="font-size:15px">${identity||'—'}</div></div>
        <div><div class="label">健康分</div><div class="value">${health}/100</div></div>
        <div><div class="label">节点数</div><div class="value">${nodeCount}</div></div>
      </div>
      <div class="health-bar"><div class="health-fill ${health>70?'green':'amber'}" style="width:${health}%"></div></div>
      <div class="label" style="margin:12px 0 4px">5-Axis</div>${axisHTML}
      <div class="label" style="margin:8px 0 4px">五行权重</div><div class="weights-vis">${wHTML}</div>
    </div>`;
  });
}

// ===== Charts =====
function renderCharts() {
  const d = window.BEANY_DATA.runs;
  const dpr = window.devicePixelRatio || 1;
  const pad = {top:20,bottom:28,left:42,right:16};
  const M = 32; // container margin

  // --- 5-axis chart (one chart, lines by axis + dashed for 食神) ---
  const c1 = document.getElementById("chart-5axis");
  const r1 = c1.parentElement.getBoundingClientRect();
  const W1 = r1.width - M;
  c1.width = W1 * dpr; c1.height = 220 * dpr;
  c1.style.width = W1+"px"; c1.style.height = "220px";
  const ctx = c1.getContext("2d"); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W1,220);
  const pw = W1 - pad.left - pad.right, ph = 220 - pad.top - pad.bottom;

  // grid
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.fillStyle = "#7777aa"; ctx.font = "9px sans-serif";
  ctx.textAlign = "right";
  for(let v=0;v<=0.4;v+=0.1){
    const y = pad.top + ph - (v/0.4)*ph;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W1-pad.right,y); ctx.stroke();
    ctx.fillText((v*100).toFixed(0)+"%", pad.left-4, y+3);
  }

  // 5 axes × 2 runs
  AXIS_NAMES.forEach((ax, ai) => {
    ctx.strokeStyle = AXIS_COLORS[ai];
    [LEFT_ID,RIGHT_ID].forEach((rid, ri) => {
      const pts = [];
      DAYS.forEach((dd, di) => {
        const e = R[rid].timeline[dd+"_decision"] || R[rid].timeline[dd];
        if(!e||!e["5_axis"]) return;
        const v = e["5_axis"][ax];
        if(v==null) return;
        pts.push({x:pad.left+(di/(DAYS.length-1))*pw, y:pad.top+ph-(v/0.4)*ph});
      });
      if(pts.length<2) return;
      ctx.lineWidth = ri===0 ? 2 : 1.5;
      ctx.setLineDash(ri===0 ? [] : [4,3]);
      ctx.beginPath();
      pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
      ctx.stroke();
      ctx.setLineDash([]);
      pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y, ri===0?3:2.5, 0, Math.PI*2); ctx.fillStyle=AXIS_COLORS[ai]; ctx.fill(); });
    });
  });

  ctx.fillStyle="#7777aa"; ctx.font="9px sans-serif"; ctx.textAlign="center";
  DAYS.forEach((d,di) => ctx.fillText(d.replace("_decision",""), pad.left+(di/(DAYS.length-1))*pw, 220-6));

  // legend
  ctx.textAlign = "left";
  let ly = 8;
  AXIS_LABELS.forEach((l,ai) => { ctx.fillStyle=AXIS_COLORS[ai]; ctx.fillRect(W1-72,ly,10,2); ctx.font="10px sans-serif"; ctx.fillText(l, W1-58,ly+4); ly+=14; });
  ly += 4;
  ctx.strokeStyle="#999"; ctx.lineWidth=2; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(W1-72,ly); ctx.lineTo(W1-58,ly); ctx.stroke(); ctx.fillStyle="#999"; ctx.fillText("正印", W1-54,ly+4);
  ly+=14;
  ctx.strokeStyle="#999"; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.moveTo(W1-72,ly); ctx.lineTo(W1-58,ly); ctx.stroke(); ctx.fillText("食神", W1-54,ly+4);
  ctx.setLineDash([]);

  // --- Weight chart (separate per run) ---
  [LEFT_ID,RIGHT_ID].forEach((rid, ri) => {
    const id = ri===0 ? "chart-weights-left" : "chart-weights-right";
    const c = document.getElementById(id);
    if(!c) return;
    const r = c.parentElement.getBoundingClientRect();
    const cw = r.width - M;
    c.width = cw * dpr; c.height = 240 * dpr;
    c.style.width = cw+"px"; c.style.height = "240px";
    const cx = c.getContext("2d"); cx.scale(dpr,dpr);
    cx.clearRect(0,0,cw,240);

    const rowH = (240-pad.top-pad.bottom)/5;
    ["木","火","土","金","水"].forEach((elem, ei) => {
      const y = pad.top + ei * rowH;
      cx.fillStyle = ELEMENT_COLORS[elem]; cx.font = "10px sans-serif"; cx.textAlign="right";
      cx.fillText(elem, pad.left-4, y+rowH/2+3);
      DAYS.forEach((dd, di) => {
        const e = R[rid].timeline[dd+"_decision"] || R[rid].timeline[dd];
        if(!e||!e.weights) return;
        const w = normalizeWeights(e.weights);
        const pct = w[elem]||0;
        if(pct===0) return;
        const bx = pad.left + (di/(DAYS.length-1))*(cw-pad.left-pad.right) - 3;
        const bw = (cw-pad.left-pad.right)/(DAYS.length-1)*0.4;
        const bh = (pct/50)*(rowH-6);
        cx.fillStyle = ELEMENT_COLORS[elem];
        cx.globalAlpha = ri===0 ? 0.85 : 0.6;
        cx.fillRect(bx, y+rowH-3-bh, bw, bh);
        cx.globalAlpha = 1;
        if(bh>10) { cx.fillStyle="#7777aa"; cx.font="8px sans-serif"; cx.textAlign="center"; cx.fillText(Math.round(pct)+"%", bx+bw/2, y+rowH-3-bh-2); }
      });
    });
    cx.fillStyle="#7777aa"; cx.font="9px sans-serif"; cx.textAlign="center";
    DAYS.forEach((d,di) => cx.fillText(d.replace("_decision",""), pad.left+(di/(DAYS.length-1))*(cw-pad.left-pad.right), 240-6));
  });
}

// ===== Node List =====
function renderNodeList() {
  const list = document.getElementById("node-list");
  list.innerHTML = "";
  const d = window.BEANY_DATA.runs;
  COMPARE_NODES.forEach(nid => {
    const ln = d[LEFT_ID].nodes[nid], rn = d[RIGHT_ID].nodes[nid];
    if(!ln && !rn) return;
    const dayNum = nid.match(/day(\d+)/)?.[1]||"?", sesNum = nid.match(/N(\d+)/)?.[1]||"?";
    list.innerHTML += `<div class="node-card" data-node="${nid}">
      <div class="node-header" onclick="toggleNode('${nid}')">
        <span class="day-badge">Day ${dayNum} · N${sesNum}</span>
        <span class="event-name">
          <span style="color:var(--accent-left)">${ln?.event_type||'—'}</span>
          <span style="color:var(--text2)"> / </span>
          <span style="color:var(--accent-right)">${rn?.event_type||'—'}</span>
        </span>
        <span class="arrow">▼</span>
      </div>
      <div class="node-body" id="body-${nid}"><div id="grid-${nid}" class="compare-grid"></div></div>
    </div>`;
    renderNodeRounds(nid, ln, rn);
  });
}

function renderNodeRounds(nid, ln, rn) {
  const grid = document.getElementById(`grid-${nid}`);
  if(!grid) return;
  const maxRounds = Math.max(ln?.beany_rounds?.length||0, rn?.beany_rounds?.length||0);

  // Top bar: scene info (environment + personality delta)
  let envHTML = "";
  if(ln?.environment || rn?.environment) {
    const leftEnv = ln?.environment ? `<div class="env-text">🏠 ${ln.environment}</div>` : '';
    const rightEnv = rn?.environment ? `<div class="env-text">🏠 ${rn.environment}</div>` : '';
    const leftDelta = renderDelta(ln?.personality_delta);
    const rightDelta = renderDelta(rn?.personality_delta);
    envHTML = `<div style="grid-column:1/-1;margin-bottom:8px"><div class="compare-grid" style="padding:0">
      <div class="compare-side side-left" style="border-top:3px solid var(--accent-left)"><div class="run-label" style="color:var(--accent-left)">🌿 正印 · 场景</div>${leftEnv}${leftDelta}</div>
      <div class="compare-side side-right" style="border-top:3px solid var(--accent-right)"><div class="run-label" style="color:var(--accent-right)">🟠 食神 · 场景</div>${rightEnv}${rightDelta}</div>
    </div></div>`;
  }
  grid.innerHTML = envHTML;

  // Rounds
  for(let ri=0; ri<maxRounds; ri++) {
    const lr = ln?.beany_rounds?.[ri] || null;
    const rr = rn?.beany_rounds?.[ri] || null;
    const roundLabel = `R${String(ri+1).padStart(2,'0')}`;
    const voteKey = `${nid}_${roundLabel}`;
    const v = votes[voteKey] || {left:0,right:0};
    const total = v.left + v.right;

    grid.innerHTML += `<div style="grid-column:1/-1">
      <div style="font-size:12px;color:var(--text2);margin:6px 0 4px;font-weight:500">Round ${ri+1}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="compare-side side-left" style="border-top:3px solid var(--accent-left)">
          ${lr ? `<div class="beany-round">${lr.mood?`<div class="mood">💭 ${lr.mood}</div>`:''}${lr.meaning?`<div class="meaning">📝 ${lr.meaning}</div>`:''}${lr.action?`<div class="action">👋 ${lr.action}</div>`:''}</div>` : '<div style="padding:12px;text-align:center;color:var(--text2);font-size:12px">无此轮数据</div>'}
        </div>
        <div class="compare-side side-right" style="border-top:3px solid var(--accent-right)">
          ${rr ? `<div class="beany-round">${rr.mood?`<div class="mood">💭 ${rr.mood}</div>`:''}${rr.meaning?`<div class="meaning">📝 ${rr.meaning}</div>`:''}${rr.action?`<div class="action">👋 ${rr.action}</div>`:''}</div>` : '<div style="padding:12px;text-align:center;color:var(--text2);font-size:12px">无此轮数据</div>'}
        </div>
      </div>
      <div class="vote-area" data-votekey="${voteKey}">
        <button class="vote-btn left" data-side="left" onclick="submitVote('${voteKey}','left')">🌿</button>
        <button class="vote-btn right" data-side="right" onclick="submitVote('${voteKey}','right')">🟠</button>
        <span class="vote-stats">🌿 <span class="num">${v.left}</span> · 🟠 <span class="num">${v.right}</span> <span style="color:var(--text2)">(${total}票)</span></span>
        ${total>0 ? `<div class="vote-progress"><div class="vote-progress-fill left-fill" style="width:${(v.left/total*100).toFixed(0)}%"></div></div><span style="font-size:11px;color:var(--text2)">${(v.right/total*100).toFixed(0)}%</span>` : ''}
      </div>
    </div>`;
  }
  updateVoteUI();
}

function renderDelta(d) {
  if(!d||!Object.keys(d).length) return '';
  return '<div class="delta-row">' +
    Object.entries(d).map(([k,v])=>`<span class="delta-item">${k} <span class="delta-val ${v>0?'up':v<0?'down':'flat'}">${v>0?'↑+':v<0?'↓':''}${v||'→0'}</span></span>`).join('') +
    '</div>';
}

function toggleNode(nid) {
  const card = document.querySelector(`.node-card[data-node="${nid}"]`);
  const body = document.getElementById(`body-${nid}`);
  card?.querySelector(".node-header")?.classList.toggle("open");
  body?.classList.toggle("open");
}

// ===== Stats =====
function renderStats() {
  const grid = document.getElementById("stats-grid");
  grid.innerHTML = "";
  COMPARE_NODES.forEach(nid => {
    let left=0, right=0;
    for(let ri=0;ri<8;ri++){
      const v = votes[`${nid}_R${String(ri+1).padStart(2,'0')}`]||{left:0,right:0};
      left+=v.left; right+=v.right;
    }
    const total=left+right;
    if(total===0) return;
    const lp = total>0?(left/total*100).toFixed(0):50;
    const day=nid.match(/day(\d+)/)?.[1]||"?";
    const winner = left>right?"🌿 正印":right>left?"🟠 食神":"⚖️ 平局";

    let breakdown="";
    for(let ri=0;ri<8;ri++){
      const rl=`R${String(ri+1).padStart(2,'0')}`;
      const v=votes[`${nid}_${rl}`]||{left:0,right:0};
      if(v.left+v.right===0) continue;
      breakdown+=`<span style="font-size:11px;color:var(--text2);margin-right:8px">${rl}: 🌿${v.left} 🟠${v.right}</span>`;
    }

    grid.innerHTML+=`<div class="stat-card">
      <div class="stat-header"><h4>Day ${day} · ${nid.split('_N')[1]||"?"}</h4><div class="stat-votes">${total} 票</div></div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${breakdown}</div>
      <div class="stat-result-bar"><div class="left-portion" style="width:${lp}%">${lp}%</div><div class="right-portion" style="width:${100-lp}%">${100-lp}%</div></div>
      <div style="font-size:12px;display:flex;justify-content:space-between;color:var(--text2)"><span>🌿 ${left}</span><span style="font-weight:600">${winner}</span><span>${right} 🟠</span></div>
    </div>`;
  });
}

// ===== Tabs =====
function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab,.panel").forEach(e => e.classList.remove("active"));
      tab.classList.add("active");
      const p = document.getElementById(`panel-${tab.dataset.tab}`);
      if(p) p.classList.add("active");
      if(tab.dataset.tab==="overview") setTimeout(renderCharts, 80);
    });
  });
}

document.addEventListener("DOMContentLoaded", init);


// ===== Ranking =====
function renderRanking() {
  const list = document.getElementById("ranking-list");
  if(!list) return;
  const d = window.BEANY_DATA.runs;
  const rank = [];

  COMPARE_NODES.forEach(nid => {
    const ln = d[LEFT_ID].nodes[nid], rn = d[RIGHT_ID].nodes[nid];
    const maxR = Math.max(ln?.beany_rounds?.length||0, rn?.beany_rounds?.length||0);
    for(let ri=0; ri<maxR; ri++) {
      const vk = nid+"_R"+String(ri+1).padStart(2,'0');
      const v = votes[vk] || {left:0,right:0};
      if(v.left+v.right === 0) continue;
      const lr = ln?.beany_rounds?.[ri];
      if(lr) rank.push({run:"left",runName:"正印",node:nid,round:ri+1,mood:lr.mood,meaning:lr.meaning,action:lr.action,votes:v.left});
      const rr = rn?.beany_rounds?.[ri];
      if(rr) rank.push({run:"right",runName:"食神",node:nid,round:ri+1,mood:rr.mood,meaning:rr.meaning,action:rr.action,votes:v.right});
    }
  });

  rank.sort((a,b)=>b.votes-a.votes);
  const top = rank.slice(0,10);
  if(top.length===0) { list.innerHTML='<div style="text-align:center;padding:40px;color:var(--text2)">还没有投票数据 🤔</div>'; return; }

  list.innerHTML = '<h3 style="margin-bottom:12px;font-size:16px">🏆 最受欢迎 Beany 响应 Top 10</h3>' +
    top.map((item,i)=>{
      const cls=i===0?"gold":i===1?"silver":i===2?"bronze":"";
      const dn=item.node.match(/day(\d+)/)?.[1]||"?", sn=item.node.match(/N(\d+)/)?.[1]||"?";
      const badge=item.run==="left"?'<span class="rank-run-badge left">🌿 正印</span>':'<span class="rank-run-badge right">🟠 食神</span>';
      return `<div class="rank-card">
        <div class="rank-number ${cls}">${i+1}</div>
        <div class="rank-content">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">${badge}<span style="font-size:12px;color:var(--text2)">Day ${dn} · N${sn} · R${item.round}</span></div>
          <div class="response-text">${item.mood?'💭 '+item.mood:''}</div>
          <div class="response-sub">${item.meaning?'📝 '+item.meaning:''}</div>
          <div class="response-sub">${item.action?'👋 '+item.action:''}</div>
        </div>
        <div class="rank-votes"><div class="count">${item.votes}</div><div class="label">票</div></div>
      </div>`;
    }).join('')+"<div style='margin-top:12px;font-size:12px;color:var(--text2);text-align:center'>正印和食神的响应各自计票，按票数排名</div>";
}
