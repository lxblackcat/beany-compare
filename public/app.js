// ===== Simplified Beany Compare App =====
const API = window.location.origin;
const L = "run_02_p06_zhengyin", R = "run_03_p06_shishen";
const ELEM = ["木","火","土","金","水"];
const ELEM_COLORS = {"木":"#4ade80","火":"#f87171","土":"#fbbf24","金":"#a1a1aa","水":"#60a5fa"};
const AXIS_COLORS = ["#4ade80","#60a5fa","#fbbf24","#fb923c","#a78bfa"];
const NODES = ["day1_N1","day1_N2","day2_N1","day2_N2","day3_N1","day3_N2"];
const DAYS = ["day0","day1","day2","day3","day4","day5","day6","day7"];
const AXIS_N = ["attachment","trust","stability","energy","curiosity"];
const AXIS_L = ["Attach","Trust","Stabil","Energy","Curios"];

let votes = {}, userVotes = {};
const D = () => window.BEANY_DATA.runs;

function nw(w) {
  if(!w) return {};
  const o={};
  for(const[k,v]of Object.entries(w)) o[k in{wood:1,fire:1,earth:1,metal:1,water:1}?{wood:"木",fire:"火",earth:"土",metal:"金",water:"水"}[k]:k]=v;
  return o;
}

// Tab switching
function switchTab(t) {
  document.querySelectorAll(".tab,.panel").forEach(e=>e.classList.remove("active"));
  document.querySelector(`.tab[data-tab="${t}"]`).classList.add("active");
  document.getElementById(`panel-${t}`).classList.add("active");
  if(t==="overview") setTimeout(drawCharts,100);
}

// Load votes
async function loadVotes() {
  try{const r=await fetch(API+"/api/stats");if(r.ok)votes=await r.json()}catch(e){}
  try{const s=localStorage.getItem("beany_votes");if(s)userVotes=JSON.parse(s)}catch(e){}
}

// Submit vote
async function doVote(vk,pref){
  if(!votes[vk])votes[vk]={left:0,right:0};
  votes[vk][pref]++;userVotes[vk]=pref;
  localStorage.setItem("beany_votes",JSON.stringify(userVotes));
  updateDisplay();
  try{await fetch(API+"/api/vote",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({node_id:vk,preference:pref})})}catch(e){}
}

function updateDisplay() {
  document.querySelectorAll('[data-vk]').forEach(el=>{
    const v=votes[el.dataset.vk]||{left:0,right:0}, t=v.left+v.right;
    el.querySelector(".vs").innerHTML=`🌿<b>${v.left}</b>·🟠<b>${v.right}</b><span style="color:var(--text2);font-size:11px;margin-left:2px">(${t})</span>`;
    el.querySelectorAll("button").forEach(b=>b.classList.toggle("sel",b.dataset.s===userVotes[el.dataset.vk]));
  });
  renderStats();
  renderRanking();
}

// ===== SUMMARIES =====
function renderSummaries() {
  const g=document.getElementById("run-summaries");g.innerHTML="";
  [L,R].forEach((id,i)=>{
    const r=D()[id],tl=r.timeline;
    const ld=Object.keys(tl).filter(k=>k.startsWith("day")&&k!="day0"&&tl[k].health);
    const last=ld.length?tl[ld[ld.length-1]]:tl.day0;
    const h=last?.health??50,idc=last?.identity_code||"";
    const ax=last?.["5_axis"]||tl.day0?.["5_axis"]||{};
    const w=nw(last?.weights||tl.day0?.weights||{});
    const ac=i?"var(--accent-right)":"var(--accent-left)",si=i?"right":"left";
    
    let axh=AXIS_N.map((n,ai)=>`<div style="display:flex;gap:4px;font-size:12px;padding:2px 0"><span style="width:55px;color:var(--text2)">${AXIS_L[ai]}</span><div style="flex:1;height:6px;border-radius:3px;background:var(--surface2);overflow:hidden"><div style="width:${(ax[n]||0)*100}%;height:100%;background:${AXIS_COLORS[ai]};border-radius:3px"></div></div><span>${((ax[n]||0)*100).toFixed(1)}%</span></div>`).join("");
    let wh=ELEM.map(e=>`<span style="display:inline-block;width:${(w[e]||0)*2}px;height:18px;background:${ELEM_COLORS[e]};border-radius:3px;font-size:10px;line-height:18px;text-align:center;color:#000;font-weight:600;margin-right:2px">${e}${Math.round(w[e]||0)}%</span>`).join("");

    g.innerHTML+=`<div class="summary-card" style="border-left:3px solid ${ac}">
      <h3>${i?'🟠':'🌿'} ${D()[id].name}</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:13px;margin:8px 0">
        <div><span style="color:var(--text2)">终局</span> ${idc||'—'}</div>
        <div><span style="color:var(--text2)">健康</span> ${h}</div>
      </div>
      <div style="margin:0 0 8px">${wh}</div>
      ${axh}
    </div>`;
  });
}

// ===== CHARTS =====
function drawCharts() {
  const dpr=window.devicePixelRatio||1, pad={t:20,b:28,l:42,r:10}, M=24;

  // 5-axis
  const c1=document.getElementById("chart-5axis"); if(!c1)return;
  const pw=c1.parentElement.clientWidth-M||400;
  c1.width=pw*dpr;c1.height=220*dpr;c1.style.width=pw+"px";c1.style.height="220px";
  const cx=c1.getContext("2d");cx.scale(dpr,dpr);cx.clearRect(0,0,pw,220);
  const pw2=pw-pad.l-pad.r,ph=220-pad.t-pad.b;

  // grid
  cx.strokeStyle="rgba(255,255,255,0.06)";cx.fillStyle="#777";cx.font="9px sans-serif";cx.textAlign="right";
  for(let v=0;v<=0.4;v+=0.1){const y=pad.t+ph-(v/0.4)*ph;cx.beginPath();cx.moveTo(pad.l,y);cx.lineTo(pw-pad.r,y);cx.stroke();cx.fillText((v*100)+"%",pad.l-4,y+3);}
  cx.textAlign="center";cx.fillStyle="#777";cx.font="9px sans-serif";
  DAYS.forEach((d,i)=>cx.fillText(d,pad.l+(i/(DAYS.length-1))*pw2,220-6));

  AXIS_N.forEach((ax,ai)=>{
    [L,R].forEach((id,ri)=>{
      const pts=[];
      DAYS.forEach((d,i)=>{
        const e=D()[id].timeline[d+"_decision"]||D()[id].timeline[d+"_update"]||D()[id].timeline[d];
        if(!e||!e["5_axis"])return;const v=e["5_axis"][ax];if(v==null)return;
        pts.push({x:pad.l+(i/(DAYS.length-1))*pw2,y:pad.t+ph-(v/0.4)*ph});
      });
      if(pts.length<2)return;
      cx.beginPath();cx.strokeStyle=AXIS_COLORS[ai];cx.lineWidth=ri?1.5:2;cx.setLineDash(ri?[4,3]:[]);
      pts.forEach((p,i)=>i?cx.lineTo(p.x,p.y):cx.moveTo(p.x,p.y));cx.stroke();cx.setLineDash([]);
      pts.forEach(p=>{cx.beginPath();cx.arc(p.x,p.y,ri?2.5:3,0,7);cx.fillStyle=AXIS_COLORS[ai];cx.fill();});
    });
  });

  // Legend
  cx.textAlign="left";cx.font="10px sans-serif";let ly=5;
  AXIS_L.forEach((l,i)=>{cx.fillStyle=AXIS_COLORS[i];cx.fillRect(pw-74,ly,10,2);cx.fillStyle="#999";cx.fillText(l,pw-60,ly+4);ly+=13;});
  ly+=4;cx.strokeStyle="#999";cx.lineWidth=2;cx.setLineDash([]);
  cx.beginPath();cx.moveTo(pw-74,ly);cx.lineTo(pw-60,ly);cx.stroke();cx.fillText("正印",pw-56,ly+4);ly+=13;
  cx.strokeStyle="#999";cx.setLineDash([4,3]);cx.beginPath();cx.moveTo(pw-74,ly);cx.lineTo(pw-60,ly);cx.stroke();cx.setLineDash([]);cx.fillText("食神",pw-56,ly+4);

  // Weights (left = 正印, right = 食神)
  [L,R].forEach((id,ri)=>{
    const id2=ri?"chart-weights-right":"chart-weights-left", lb=ri?"食神":"正印";
    const c2=document.getElementById(id2);if(!c2)return;
    const w=c2.parentElement.clientWidth-M||300;
    c2.width=w*dpr;c2.height=240*dpr;c2.style.width=w+"px";c2.style.height="240px";
    const cx2=c2.getContext("2d");cx2.scale(dpr,dpr);cx2.clearRect(0,0,w,240);
    const rowH=(240-pad.t-pad.b)/5;
    ELEM.forEach((el,ei)=>{
      const y=pad.t+ei*rowH;
      cx2.fillStyle=ELEM_COLORS[el];cx2.font="11px sans-serif";cx2.textAlign="right";cx2.fillText(el,pad.l-4,y+rowH/2+3);
      DAYS.forEach((d,i)=>{
        const e=D()[id].timeline[d+"_decision"]||D()[id].timeline[d+"_update"]||D()[id].timeline[d];
        if(!e||!e.weights)return;
        const pct=nw(e.weights)[el]||0;if(pct===0)return;
        const bx=pad.l+(i/(DAYS.length-1))*(w-pad.l-pad.r)-3,bw=(w-pad.l-pad.r)/(DAYS.length-1)*0.4,bh=(pct/50)*(rowH-6);
        cx2.fillStyle=ELEM_COLORS[el];cx2.globalAlpha=ri?0.55:0.85;
        cx2.fillRect(bx,y+rowH-3-bh,bw,bh);cx2.globalAlpha=1;
        if(bh>8){cx2.fillStyle="#777";cx2.font="8px sans-serif";cx2.textAlign="center";cx2.fillText(Math.round(pct)+"%",bx+bw/2,y+rowH-3-bh-2);}
      });
    });
    cx2.fillStyle="#777";cx2.font="9px sans-serif";cx2.textAlign="center";
    DAYS.forEach((d,i)=>cx2.fillText(d,pad.l+(i/(DAYS.length-1))*(w-pad.l-pad.r),240-6));
  });
}

// ===== NODE COMPARISON =====
function renderNodes() {
  const list=document.getElementById("node-list");list.innerHTML="";
  NODES.forEach(nid=>{
    const ln=D()[L].nodes[nid],rn=D()[R].nodes[nid];
    if(!ln&&!rn)return;
    const dn=nid.match(/day(\d+)/)[1]||"?",sn=nid.match(/N(\d+)/)[1]||"?";
    list.innerHTML+=`<div class="node-card">
      <div class="node-header" onclick="toggleNode('${nid}')">
        <span class="day-badge">Day ${dn}·N${sn}</span>
        <span class="event-name"><span style="color:var(--accent-left)">${ln?.event_type||'—'}</span><span style="color:var(--text2);margin:0 4px">/</span><span style="color:var(--accent-right)">${rn?.event_type||'—'}</span></span>
        <span class="arrow">▼</span>
      </div>
      <div class="node-body" id="nb-${nid}" style="display:none">
        <div style="padding:12px" id="content-${nid}"></div>
      </div>
    </div>`;
    renderRounds(nid,ln,rn);
  });
}

function renderRounds(nid,ln,rn){
  const c=document.getElementById(`content-${nid}`);if(!c)return;
  let h="";
  // Environment
  if(ln?.environment||rn?.environment){
    h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div style="background:var(--surface2);border-radius:8px;padding:10px;border-top:3px solid var(--accent-left)">
        <div style="color:var(--accent-left);font-size:12px;font-weight:600;margin-bottom:4px">🌿 正印 · 场景</div>
        ${ln?.environment?`<div style="font-size:12px;color:var(--text2);line-height:1.5">🏠 ${ln.environment}</div>`:''}
        ${deltaHTML(ln?.personality_delta)}
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:10px;border-top:3px solid var(--accent-right)">
        <div style="color:var(--accent-right);font-size:12px;font-weight:600;margin-bottom:4px">🟠 食神 · 场景</div>
        ${rn?.environment?`<div style="font-size:12px;color:var(--text2);line-height:1.5">🏠 ${rn.environment}</div>`:''}
        ${deltaHTML(rn?.personality_delta)}
      </div>
    </div>`;
  }
  const mr=Math.max(ln?.beany_rounds?.length||0,rn?.beany_rounds?.length||0);
  for(let ri=0;ri<mr;ri++){
    const lr=ln?.beany_rounds?.[ri],rr=rn?.beany_rounds?.[ri];
    const vk=nid+"_R"+String(ri+1).padStart(2,'0');
    const v=votes[vk]||{left:0,right:0};
    const t=v.left+v.right;
    h+=`<div style="margin-bottom:8px">
      <div style="font-size:12px;color:var(--text2);margin-bottom:4px">Round ${ri+1}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px">
        <div style="background:var(--surface2);border-radius:8px;padding:10px;border-top:3px solid var(--accent-left)">
          ${lr?`<div>${lr.mood?'💭 '+lr.mood:''}</div><div style="color:var(--text2);font-size:12px">${lr.meaning?'📝 '+lr.meaning:''}</div><div style="font-weight:500">${lr.action?'👋 '+lr.action:''}</div>`:'<div style="color:var(--text2);font-size:12px">无此轮数据</div>'}
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:10px;border-top:3px solid var(--accent-right)">
          ${rr?`<div>${rr.mood?'💭 '+rr.mood:''}</div><div style="color:var(--text2);font-size:12px">${rr.meaning?'📝 '+rr.meaning:''}</div><div style="font-weight:500">${rr.action?'👋 '+rr.action:''}</div>`:'<div style="color:var(--text2);font-size:12px">无此轮数据</div>'}
        </div>
      </div>
      <div class="va" data-vk="${vk}" style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:8px">
        <button class="vb" data-s="left" onclick="doVote('${vk}','left')" style="padding:3px 10px;border-radius:12px;border:2px solid var(--accent-left);background:transparent;color:var(--accent-left);font-size:14px;cursor:pointer">🌿</button>
        <button class="vb" data-s="right" onclick="doVote('${vk}','right')" style="padding:3px 10px;border-radius:12px;border:2px solid var(--accent-right);background:transparent;color:var(--accent-right);font-size:14px;cursor:pointer">🟠</button>
        <span class="vs">🌿<b>${v.left}</b>·🟠<b>${v.right}</b><span style="color:var(--text2);font-size:11px;margin-left:2px">(${t})</span></span>
        ${t?`<div style="flex:1;max-width:100px;height:6px;border-radius:3px;background:var(--surface2);overflow:hidden"><div class="pf" style="width:${(v.left/t*100).toFixed(0)}%;height:100%;background:var(--accent-left);border-radius:3px;transition:width 0.3s"></div></div>`:''}
      </div>
    </div>`;
  }
  c.innerHTML=h;
}

function deltaHTML(d){
  if(!d||!Object.keys(d).length)return'';
  return'<div style="display:flex;flex-wrap:wrap;gap:2px 8px;font-size:11px;color:var(--text2);margin-top:6px">'+
    Object.entries(d).map(([k,v])=>`<span>${k} <b style="color:${v>0?'var(--accent-left)':v<0?'#f87171':'var(--text2)'}">${v>0?'↑':v<0?'↓':''}${v||'0'}</b></span>`).join('')+
    '</div>';
}

function toggleNode(nid){
  const b=document.getElementById(`nb-${nid}`);
  if(!b)return;
  const o=b.style.display!=='none';
  b.style.display=o?'none':'block';
  b.parentElement.querySelector('.arrow').style.transform=o?'':'rotate(180deg)';
}

// ===== STATS =====
function renderStats(){
  const g=document.getElementById("stats-grid");g.innerHTML="";
  NODES.forEach(nid=>{
    let l=0,r=0;
    for(let i=0;i<8;i++){const v=votes[nid+'_R'+String(i+1).padStart(2,'0')]||{l:0,r:0};l+=v.left;r+=v.right;}
    const t=l+r;if(!t)return;
    const lp=(l/t*100).toFixed(0),dn=nid.match(/day(\d+)/)[1]||"?";
    const w=l>r?"🌿 正印":r>l?"🟠 食神":"⚖️ 平局";
    let bd="";
    for(let i=0;i<8;i++){const v=votes[nid+'_R'+String(i+1).padStart(2,'0')]||{l:0,r:0};if(v.left+v.right)bd+=`<span style="font-size:11px;color:var(--text2);margin-right:6px">R${i+1}: 🌿${v.left} 🟠${v.right}</span>`;}
    g.innerHTML+=`<div style="background:var(--surface);border-radius:12px;padding:16px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><b>Day ${dn}</b><span style="color:var(--text2);font-size:12px">${t}票</span></div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${bd}</div>
      <div style="height:24px;border-radius:6px;background:var(--surface2);overflow:hidden;display:flex;margin-bottom:4px">
        <div style="width:${lp}%;background:var(--accent-left);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#000;min-width:24px">${lp}%</div>
        <div style="flex:1;background:var(--accent-right);text-align:center;font-size:11px;font-weight:600;line-height:24px;color:#000">${(100-lp)}%</div>
      </div>
      <div style="font-size:12px;display:flex;justify-content:space-between;color:var(--text2)"><span>🌿 ${l}</span><span style="font-weight:600">${w}</span><span>${r} 🟠</span></div>
    </div>`;
  });
}

// ===== RANKING =====
function renderRanking(){
  const list=document.getElementById("ranking-list");if(!list)return;
  const rank=[];
  NODES.forEach(nid=>{
    const ln=D()[L].nodes[nid],rn=D()[R].nodes[nid];
    const mr=Math.max(ln?.beany_rounds?.length||0,rn?.beany_rounds?.length||0);
    for(let ri=0;ri<mr;ri++){
      const vk=nid+'_R'+String(ri+1).padStart(2,'0');
      const v=votes[vk]||{left:0,right:0};
      if(v.left+v.right===0)continue;
      if(ln?.beany_rounds?.[ri])rank.push({run:"left",nm:"正印",nid,ri,m:ln.beany_rounds[ri].mood,me:ln.beany_rounds[ri].meaning,a:ln.beany_rounds[ri].action,vt:v.left});
      if(rn?.beany_rounds?.[ri])rank.push({run:"right",nm:"食神",nid,ri,m:rn.beany_rounds[ri].mood,me:rn.beany_rounds[ri].meaning,a:rn.beany_rounds[ri].action,vt:v.right});
    }
  });
  rank.sort((a,b)=>b.vt-a.vt);
  const top=rank.slice(0,10);
  if(!top.length){list.innerHTML='<div style="text-align:center;padding:40px;color:var(--text2)">还没有投票数据</div>';return;}
  list.innerHTML='<h3 style="margin-bottom:12px">🏆 最受欢迎 Beany 响应 Top 10</h3>'+
    top.map((item,i)=>{
      const c=i===0?"gold":i===1?"silver":i===2?"bronze":"";
      const dn=item.nid.match(/day(\d+)/)[1]||"?",sn=item.nid.match(/N(\d+)/)[1]||"?";
      const bg=item.run==="left"?'<span style="display:inline-block;padding:0 6px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(74,222,128,0.15);color:var(--accent-left)">🌿 正印</span>':'<span style="display:inline-block;padding:0 6px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(251,146,60,0.15);color:var(--accent-right)">🟠 食神</span>';
      return `<div style="display:flex;align-items:center;gap:10px;background:var(--surface);border-radius:10px;padding:10px 14px;border:1px solid var(--border);margin-bottom:6px">
        <div style="font-size:20px;font-weight:700;min-width:30px;text-align:center;color:${i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#d97706':'var(--text2)'}">${i+1}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">${bg}<span style="font-size:11px;color:var(--text2)">Day ${dn}·N${sn}·R${item.ri+1}</span></div>
          <div style="font-size:13px">${item.m?'💭 '+item.m:''}</div>
          <div style="font-size:12px;color:var(--text2)">${item.me?'📝 '+item.me:''}</div>
          <div style="font-size:13px;font-weight:500">${item.a?'👋 '+item.a:''}</div>
        </div>
        <div style="text-align:right;min-width:40px"><div style="font-size:20px;font-weight:700">${item.vt}</div><div style="font-size:10px;color:var(--text2)">票</div></div>
      </div>`;
    }).join('');
}

// ===== INIT =====
async function init(){
  await loadVotes();
  renderSummaries();
  setTimeout(drawCharts,50);
  renderNodes();
  renderStats();
  renderRanking();
  document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>switchTab(t.dataset.tab)));
}
document.addEventListener("DOMContentLoaded",init);
