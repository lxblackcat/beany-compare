#!/usr/bin/env python3
"""
Extract run data from beany-sim-v2/runs/ into public/data.js
Run this whenever runs are updated.
"""
import json, os, re, hashlib

BASE = "/home/blackcat/.openclaw/beany-sim-v2/runs"
OUT = "public/data.js"

RUNS = [
    "run_02_p06_zhengyin",
    "run_03_p06_shishen",
]

def extract_beany_rounds(rounds_dir):
    """Return list of { file, mood, meaning, action, raw } for Beany rounds."""
    rounds = []
    if not os.path.isdir(rounds_dir):
        return rounds
    for rf in sorted(os.listdir(rounds_dir)):
        if "_Beany" not in rf and "_beany" not in rf:
            continue
        rpath = f"{rounds_dir}/{rf}"
        with open(rpath) as f:
            raw = f.read().strip()
        mood = extract_field(raw, ["心情"])
        meaning = extract_field(raw, ["意思", "meaning"])
        action = extract_field(raw, ["动作", "action"])
        rounds.append({
            "file": rf,
            "mood": mood or "",
            "meaning": meaning or "",
            "action": action or "",
            "raw": raw
        })
    return rounds

def extract_field(text, patterns):
    for p in patterns:
        m = re.search(rf'{p}[：:]\s*(.+?)(?:\n|$)', text)
        if m:
            return m.group(1).strip().rstrip('。')
    return ""

def parse_weights(s):
    """Parse '{金: 16%, 木: 30%, 水: 16%, 火: 18%, 土: 20%}'"""
    w = {}
    if not s:
        return w
    for pair in s.split(','):
        kv = pair.strip().strip('{}').split(':')
        if len(kv) == 2:
            key = kv[0].strip().strip("'\"")
            try:
                w[key] = float(kv[1].strip().strip('%'))
            except:
                pass
    return w

def extract_timeline(run_dir, run_id):
    """Build per-day aggregated state from decisions + identity_history."""
    timeline = {}

    # Start with day0_state
    ds = f"{run_dir}/runtime_state/day0_state.json"
    if os.path.isfile(ds):
        with open(ds) as f:
            d0 = json.load(f)
        timeline["day0"] = {
            "weights": d0.get("weights", {}),
            "5_axis": d0.get("5_axis", {}),
            "health": d0.get("health", 50),
            "dominant": d0.get("dominant_element", ""),
            "age": d0.get("age_stage", ""),
            "identity_code": f"{d0.get('dominant_element','')}_{d0.get('shishen','')}_{d0.get('age_stage','')}"
        }

    # Process decisions
    dec_dir = f"{run_dir}/decisions"
    if os.path.isdir(dec_dir):
        for df in sorted(os.listdir(dec_dir)):
            if not df.endswith(".md"):
                continue
            day_key = df.replace(".md", "")
            with open(f"{dec_dir}/{df}") as f:
                txt = f.read()
            
            entry = {}
            
            # weights
            m = re.search(r'before:\s*\{([^}]+)\}', txt)
            if m:
                entry["weights_before"] = parse_weights(m.group(1))
            m = re.search(r'after:\s*\{([^}]+)\}', txt)
            if m:
                entry["weights"] = parse_weights(m.group(1))
            
            # dominant
            m = re.search(r'(?:最终\s*)?dominant[_\s]*(?:element)?[：:>\s]+(\S+)', txt)
            if m:
                entry["dominant"] = m.group(1).strip().rstrip('—')
            
            # health previous
            m = re.search(r'(?:previous|起算|上一日)\s*[：:>\s]+(\d+)', txt)
            if m:
                entry["health_prev"] = int(m.group(1))
            # Parse health from decision
            # Try finding "current: N" not preceded by "previous"
            lines = txt.split('\n')
            for i, line in enumerate(lines):
                if 'health' in line.lower() or '健康' in line:
                    # Look for a number in this line or next line
                    hm = re.search(r'(?:current|new)[\s:：]+(\d+)', line, re.IGNORECASE)
                    if hm:
                        # Check previous line for "previous"
                        if i > 0 and 'previous' in lines[i-1].lower():
                            continue
                        entry["health"] = int(hm.group(1))
                        break
            
            # 5-axis from "新的 5-axis 值" section
            m = re.search(r'新的 5-axis 值[：:](.*?)(?=\n##|\Z)', txt, re.DOTALL)
            if m:
                ax = {}
                for a in ["attachment", "trust", "stability", "energy", "curiosity"]:
                    am = re.search(rf'{a}\s+([\d.]+)', m.group(1))
                    if am:
                        ax[a] = round(float(am.group(1)), 4)
                if ax:
                    entry["5_axis"] = ax
            
            # identity code
            m = re.search(r'## 性格编号\s*\n\s*(.+?)(?:\n|$)', txt)
            if m:
                entry["identity_code"] = m.group(1).strip()
            
            # age from identity_history
            id_dir = f"{run_dir}/identity_history"
            idf = f"{id_dir}/{df}"
            if os.path.isfile(idf):
                with open(idf) as f:
                    idtxt = f.read()
                m = re.search(r'(?:人格码|identity_code)[：:]\s*(.+?)(?:\n|$)', idtxt)
                if m:
                    entry["identity_code"] = m.group(1).strip()
                if "health" not in entry:
                    m = re.search(r'健康分[：:]\s*(\d+)', idtxt)
                    if m:
                        entry["health"] = int(m.group(1))
            
            timeline[day_key] = entry

    return timeline

def main():
    output = {"runs": {}, "version": "1.0", "last_updated": ""}

    for run_id in RUNS:
        run_dir = f"{BASE}/{run_id}"
        run_data = {
            "name": "正印 · 林小姐 · 木" if "zhengyin" in run_id else "食神 · 林小姐 · 木",
            "shishen": "正印" if "zhengyin" in run_id else "食神",
            "nodes": {},
            "timeline": extract_timeline(run_dir, run_id)
        }

        nodes_dir = f"{run_dir}/nodes"
        if not os.path.isdir(nodes_dir):
            output["runs"][run_id] = run_data
            continue

        for nd in sorted(os.listdir(nodes_dir)):
            if nd == "day0":
                continue
            ndir = f"{nodes_dir}/{nd}"
            nj = f"{ndir}/node.json"
            if not os.path.isfile(nj):
                continue
            with open(nj) as f:
                n = json.load(f)

            rounds_dir = f"{ndir}/rounds"
            beany = extract_beany_rounds(rounds_dir)

            # App UI
            app_ui = n.get("app_ui", {})
            if isinstance(app_ui, dict):
                app_desc = app_ui.get("description", "")
                app_emoji = app_ui.get("emotion_icon", "")
            else:
                app_desc = str(app_ui)
                app_emoji = ""

            run_data["nodes"][nd] = {
                "event_type": n.get("event_type", "unknown"),
                "environment": n.get("environment", ""),
                "app_description": app_desc,
                "app_emoji": app_emoji,
                "5_axis": n.get("5_axis", {}),
                "personality_delta": n.get("personality_delta", {}),
                "dominant_element": n.get("dominant_element", ""),
                "shishen": n.get("shishen", ""),
                "age_stage": n.get("age_stage", ""),
                "importance_score": n.get("importance_score", 0),
                "round_count": len([r for r in beany]),
                "beany_rounds": beany,
                "day": n.get("day", 0),
                "session": n.get("session", 0)
            }

        output["runs"][run_id] = run_data

    # Write
    js = "// Auto-generated by extract_data.py\n"
    js += "// Run: python3 extract_data.py to regenerate\n\n"
    js += "window.BEANY_DATA = " + json.dumps(output, indent=2, ensure_ascii=False) + ";"

    with open(OUT, "w") as f:
        f.write(js)

    # stats
    r2 = len(output["runs"].get("run_02_p06_zhengyin", {}).get("nodes", {}))
    r3 = len(output["runs"].get("run_03_p06_shishen", {}).get("nodes", {}))
    print(f"✅ Extracted: run2={r2} nodes, run3={r3} nodes → {OUT}")

if __name__ == "__main__":
    main()
