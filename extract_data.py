#!/usr/bin/env python3
"""Extract run data from beany-sim-v2/runs/ into public/data.js"""
import json, os, re

BASE = "/home/blackcat/.openclaw/beany-sim-v2/runs"
OUT = "public/data.js"
RUNS = ["run_02_p06_zhengyin", "run_03_p06_shishen"]

def extract_beany_rounds(rounds_dir):
    rounds = []
    if not os.path.isdir(rounds_dir): return rounds
    for rf in sorted(os.listdir(rounds_dir)):
        if "_Beany" not in rf and "_beany" not in rf: continue
        with open(f"{rounds_dir}/{rf}") as f: raw = f.read().strip()
        mood = re.search(r'心情[：:]\s*(.+?)(?:\n|$)', raw)
        meaning = re.search(r'意思[：:]\s*(.+?)(?:\n|$)', raw)
        action = re.search(r'动作[：:]\s*(.+?)(?:\n|$)', raw)
        rounds.append({
            "file": rf,
            "mood": (mood.group(1).strip().rstrip('。') if mood else ""),
            "meaning": (meaning.group(1).strip().rstrip('。') if meaning else ""),
            "action": (action.group(1).strip().rstrip('。') if action else ""),
            "raw": raw
        })
    return rounds

def parse_weights_inline(s):
    w = {}
    if not s: return w
    for pair in s.split(','):
        kv = pair.strip().strip('{}').split(':')
        if len(kv) == 2:
            try: w[kv[0].strip().strip("'\"").strip('*`')] = float(kv[1].strip().strip('%').replace('*','').replace('**',''))
            except: pass
    return w

def parse_weights_table(text):
    w = {}
    in_tbl = False
    for line in text.split('\n'):
        if '|' in line and '调整后' in line: in_tbl = True; continue
        if in_tbl and line.strip().startswith('|'):
            cells = [c.strip() for c in line.split('|') if c.strip()]
            if len(cells) >= 3:
                elem = cells[0].strip('*`')
                if elem in ('合计', 'Total'): continue
                try: w[elem] = float(cells[2].replace('*','').replace('**','').strip('%'))
                except: pass
        elif in_tbl and not line.strip(): break
    return w

def extract_timeline(run_dir, run_id):
    timeline = {}
    # day0_state
    ds = f"{run_dir}/runtime_state/day0_state.json"
    if os.path.isfile(ds):
        with open(ds) as f: d0 = json.load(f)
        timeline["day0"] = {
            "weights": d0.get("weights", {}),
            "5_axis": d0.get("5_axis", {}),
            "health": d0.get("health", 50),
            "dominant": d0.get("dominant_element", ""),
            "age": d0.get("age_stage", ""),
            "identity_code": f"{d0.get('dominant_element','')}_{d0.get('shishen','')}_{d0.get('age_stage','')}"
        }

    # Process decision files
    dec_dir = f"{run_dir}/decisions"
    if os.path.isdir(dec_dir):
        for df in sorted(os.listdir(dec_dir)):
            if not df.endswith(".md"): continue
            day_key = df.replace(".md", "")
            with open(f"{dec_dir}/{df}") as f: txt = f.read()
            entry = {}

            # Weights: try inline then table
            m = re.search(r'after:\s*\{([^}]+)\}', txt)
            if m: w = parse_weights_inline(m.group(1))
            else: w = parse_weights_table(txt)
            if not w:
                # Fallback: find element + % anywhere
                w = {}
                for elem in ['木','火','土','金','水']:
                    mm = re.search(rf'{elem}\s+(\d+)%', txt)
                    if mm: w[elem] = float(mm.group(1))
            if w: entry["weights"] = w

            # Dominant
            m = re.search(r'(?:最终\s*)?dominant[_\s]*(?:element)?[：:>\s]+(\S+)', txt)
            if m: entry["dominant"] = m.group(1).strip().rstrip('—')

            # Health
            m = re.search(r'new_health\s*=\s*\d+\s*[+\-]?.*?=\s*(\d+)', txt)
            if not m: m = re.search(r'new_health\s*=\s*(\d+)', txt)
            if m: entry["health"] = int(m.group(1))
            else:
                sec = re.split(r'##\s*(?:健康分|Health)', txt, flags=re.IGNORECASE)
                if len(sec) > 1:
                    m = re.search(r'current[\s:：]+(\d+)', sec[1])
                    if m: entry["health"] = int(m.group(1))
            if 'health' not in entry:
                m = re.search(r'(?<!previous[\s:：])current[\s:：]+(\d+)', txt)
                if m: entry["health"] = int(m.group(1))

            # 5-axis
            ax = {}
            m = re.search(r'新的 5-axis 值[：:](.*?)(?=\n##|\Z)', txt, re.DOTALL)
            if m:
                for a in ["attachment","trust","stability","energy","curiosity"]:
                    am = re.search(rf'{a}\s+([\d.]+)', m.group(1))
                    if am: ax[a] = round(float(am.group(1)), 4)
            else:
                # Try table | Axis | 前日 | Delta | 新值 |
                m2 = re.search(r'\| Axis[^|]*\|[^|]*\|[^|]*\|[^|]*\|', txt, re.IGNORECASE)
                if m2:
                    for a in ["attachment","trust","stability","energy","curiosity"]:
                        am = re.search(rf'\|?\s*{a}\s*\|[^|]*\|[^|]*\|\s*([\d.]+)', txt[m2.end():], re.IGNORECASE)
                        if am: ax[a] = round(float(am.group(1)), 4)
                else:
                    # Try | 轴 | ... | 止 |
                    m3 = re.search(r'\|\s*轴\s*\|', txt)
                    if m3:
                        for line in txt[m3.start():].split('\n'):
                            for a in ["attachment","trust","stability","energy","curiosity"]:
                                if f'| {a}' in line.lower():
                                    cells = [c.strip(' *`') for c in line.split('|') if c.strip()]
                                    if len(cells) >= 9:
                                        try: ax[a] = round(float(cells[-1]), 4)
                                        except: pass
            if ax and len(ax) >= 3: entry["5_axis"] = ax

            # Identity code
            # identity code: try colon format, then next-line format
            m = re.search(r'(?:人格码|identity_code|性格编号)\s*[：:]\s*(.+?)(?:\n|$)', txt)
            if m: entry["identity_code"] = m.group(1).strip().replace('*','')
            if not entry.get("identity_code"):
                m = re.search(r'##\s*性格编号\s*\n+\s*(.+?)\n', txt)
                if m: entry["identity_code"] = m.group(1).strip().replace('*','')

            timeline[day_key] = entry

    # Supplement from identity_history for days without decisions (e.g. run2 day6, day7)
    id_dir = f"{run_dir}/identity_history"
    if os.path.isdir(id_dir):
        for idf in sorted(os.listdir(id_dir)):
            day_key = idf.replace(".md", "")
            if day_key in timeline: continue
            with open(f"{id_dir}/{idf}") as f: idtxt = f.read()
            entry = {}
            m = re.search(r'(?:人格码|identity_code|人格码)[：:]\s*(.+?)(?:\n|$)', idtxt)
            if m: entry["identity_code"] = m.group(1).strip().replace('*','')
            # Take the LAST number from 健康分 line
            nums = re.findall(r'\d+', idtxt.split('健康')[0] if '健康' not in idtxt.split('\n')[0] else '')
            # Actually: find all numbers in the first line containing 健康
            for hl in idtxt.split('\n'):
                if '健康' in hl:
                    nums = re.findall(r'\d+', hl)
                    if nums: entry["health"] = int(nums[-1])
                    break
            # 5-axis from "attachment 0.227→0.221" pattern
            ax = {}
            for a in ["attachment","trust","stability","energy","curiosity"]:
                m = re.search(rf'{a}\s+[\d.]+\s*→\s*([\d.]+)', idtxt)
                if m: ax[a] = round(float(m.group(1)), 4)
            if ax and len(ax) >= 3: entry["5_axis"] = ax
            # weights from "**权重更新**：木39→43, 火18→18, ..."
            m = re.search(r'权重更新[^:：]*[：:]\s*(.+?)(?:\n|$)', idtxt)
            if m:
                w = {}
                raw = m.group(1)
                for part in raw.split(','):
                    part = part.strip()
                    if '→' not in part: continue
                    kv = part.split('→')
                    elem_raw = kv[0].strip()
                    elem = elem_raw[0] if elem_raw and elem_raw[0] in "木火土金水" else ""
                    try:
                        val_str = kv[1].strip().rstrip('%')
                        w[elem] = float(val_str)
                    except: pass
                if w:
                    entry["weights"] = w
            timeline[day_key] = entry

    return timeline

def main():
    output = {"runs": {}, "version": "1.0"}
    for run_id in RUNS:
        run_dir = f"{BASE}/{run_id}"
        rd = {
            "name": "正印 · 林小姐 · 木" if "zhengyin" in run_id else "食神 · 林小姐 · 木",
            "shishen": "正印" if "zhengyin" in run_id else "食神",
            "nodes": {},
            "timeline": extract_timeline(run_dir, run_id)
        }
        ndir = f"{run_dir}/nodes"
        if os.path.isdir(ndir):
            for nd in sorted(os.listdir(ndir)):
                if nd == "day0": continue
                nj = f"{ndir}/{nd}/node.json"
                if not os.path.isfile(nj): continue
                with open(nj) as f: n = json.load(f)
                beany = extract_beany_rounds(f"{ndir}/{nd}/rounds")
                au = n.get("app_ui", {})
                rd["nodes"][nd] = {
                    "event_type": n.get("event_type","unknown"),
                    "environment": n.get("environment",""),
                    "app_description": (au.get("description","") if isinstance(au,dict) else str(au)),
                    "app_emoji": (au.get("emotion_icon","") if isinstance(au,dict) else ""),
                    "5_axis": n.get("5_axis",{}),
                    "personality_delta": n.get("personality_delta",{}),
                    "dominant_element": n.get("dominant_element",""),
                    "shishen": n.get("shishen",""),
                    "age_stage": n.get("age_stage",""),
                    "round_count": len(beany),
                    "beany_rounds": beany,
                    "day": n.get("day",0),
                    "session": n.get("session",0)
                }
        output["runs"][run_id] = rd

    js = "window.BEANY_DATA = " + json.dumps(output, indent=2, ensure_ascii=False) + ";"
    with open(OUT, "w") as f: f.write(js)
    for rid in RUNS:
        r = output["runs"][rid]
        print(f"  {rid}: {len(r['nodes'])} nodes, timeline={list(r['timeline'].keys())}")

if __name__ == "__main__":
    main()
