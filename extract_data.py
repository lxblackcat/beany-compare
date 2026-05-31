#!/usr/bin/env python3
"""
Extract run data from beany-sim-v2/runs/ into public/data.js
Handles both run2 and run3 decision format variations.
"""
import json, os, re

BASE = "/home/blackcat/.openclaw/beany-sim-v2/runs"
OUT = "public/data.js"

RUNS = [
    "run_02_p06_zhengyin",
    "run_03_p06_shishen",
]

def extract_beany_rounds(rounds_dir):
    rounds = []
    if not os.path.isdir(rounds_dir):
        return rounds
    for rf in sorted(os.listdir(rounds_dir)):
        if "_Beany" not in rf and "_beany" not in rf:
            continue
        rpath = f"{rounds_dir}/{rf}"
        with open(rpath) as f:
            raw = f.read().strip()
        mood = _extract_field(raw, ["心情"])
        meaning = _extract_field(raw, ["意思", "meaning"])
        action = _extract_field(raw, ["动作", "action"])
        rounds.append({
            "file": rf,
            "mood": mood or "",
            "meaning": meaning or "",
            "action": action or "",
            "raw": raw
        })
    return rounds

def _extract_field(text, patterns):
    for p in patterns:
        m = re.search(rf'{p}[：:]\s*(.+?)(?:\n|$)', text)
        if m:
            return m.group(1).strip().rstrip('。')
    return ""

def parse_weights_inline(s):
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

def parse_weights_table(text):
    """Parse markdown table weights:
    | 元素 | 调整前 | 调整后 |
    | 金 | 16% | 21% |
    """
    w = {}
    # Find the first table with element rows
    lines = text.split('\n')
    in_table = False
    header_found = False
    for i, line in enumerate(lines):
        if '|' in line and ('元素' in line or '金' in line) and '调整后' in line:
            in_table = True
            header_found = True
            continue
        if in_table and line.strip().startswith('|'):
            cells = [c.strip() for c in line.split('|') if c.strip()]
            if len(cells) >= 3:
                elem = cells[0].strip('*`')
                # Skip 合计/sum rows
                if elem in ('合计', '合计', 'Total'):
                    continue
                after_val = cells[2].replace('*','').replace('`','').strip('%')
                try:
                    w[elem] = float(after_val)
                except:
                    pass
        elif in_table and not line.strip():
            break
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
    if not os.path.isdir(dec_dir):
        return timeline

    for df in sorted(os.listdir(dec_dir)):
        if not df.endswith(".md"):
            continue
        day_key = df.replace(".md", "")
        with open(f"{dec_dir}/{df}") as f:
            txt = f.read()

        entry = {}

        # --- Weights: try inline format first ---
        m = re.search(r'after:\s*\{([^}]+)\}', txt)
        if m:
            w = parse_weights_inline(m.group(1))
            if w:
                entry["weights"] = w
        else:
            # Try table format
            w = parse_weights_table(txt)
            if w:
                entry["weights"] = w

        m = re.search(r'before:\s*\{([^}]+)\}', txt)
        if m:
            entry["weights_before"] = parse_weights_inline(m.group(1))

        # --- Dominant ---
        m = re.search(r'(?:最终\s*)?dominant[_\s]*(?:element)?[：:>\s]+(\S+)', txt)
        if m:
            entry["dominant"] = m.group(1).strip().rstrip('—')

        # --- Health ---
        # Try each pattern in order of reliability
        # 1. new_health = N (run3 format)
        m = re.search(r'new_health\s*=\s*\d+\s*[+\-]?.*?=\s*(\d+)', txt)
        if m:
            entry["health"] = int(m.group(1))
        else:
            m = re.search(r'new_health\s*=\s*(\d+)', txt)
            if m:
                entry["health"] = int(m.group(1))
        if 'health' not in entry:
            # 2. Look for 'current: N' that appears AFTER '健康分' or 'health' header
            # This handles both 'current: 55' standalone and after 'previous:'
            sections = re.split(r'##\s+(?:健康分|Health)', txt, flags=re.IGNORECASE)
            if len(sections) > 1:
                m = re.search(r'current[\s:：]+(\d+)', sections[1])
                if m:
                    entry["health"] = int(m.group(1))
        if 'health' not in entry:
            # 3. Final fallback: find any 'current: N' not part of 'previous'
            m = re.search(r'(?<!previous[\s:：])current[\s:：]+(\d+)', txt)
            if m:
                entry["health"] = int(m.group(1))

        # health previous
        m = re.search(r'(?:previous|起算|上一日)\s*[：:>\s]+(\d+)', txt)
        if m:
            entry["health_prev"] = int(m.group(1))

        # --- 5-axis ---
        ax = {}
        # Strategy A: "新的 5-axis 值" section (run2 inline)
        m = re.search(r'新的 5-axis 值[：:](.*?)(?=\n##|\Z)', txt, re.DOTALL)
        if m:
            for a in ["attachment", "trust", "stability", "energy", "curiosity"]:
                am = re.search(rf'{a}\s+([\d.]+)', m.group(1))
                if am:
                    ax[a] = round(float(am.group(1)), 4)
        # Strategy B: run3 table (| Axis | 前日 | Delta | 新值 |)
        if not ax:
            m = re.search(r'\| Axis[^|]*\|[^|]*\|[^|]*\|[^|]*\|', txt, re.IGNORECASE)
            if m:
                ax_section = txt[m.end():]
                for a in ["attachment", "trust", "stability", "energy", "curiosity"]:
                    am = re.search(rf'\|?\s*{a}\s*\|[^|]*\|[^|]*\|\s*([\d.]+)', ax_section, re.IGNORECASE)
                    if am:
                        ax[a] = round(float(am.group(1)), 4)
        # Strategy C: run2 multi-column table: | 轴 | wood | fire | earth | metal | water | δ | 起 | 止 |
        if not ax:
            # Find a table where header has 止 or 止
            m = re.search(r'\|\s*轴\s*\|', txt)
            if m:
                # Find the table start and scan rows
                lines = txt[m.start():].split('\n')
                for line in lines:
                    line_lower = line.lower()
                    for a in ["attachment", "trust", "stability", "energy", "curiosity"]:
                        if f'| {a}' in line_lower:
                            cells = [c.strip(' *`') for c in line.split('|') if c.strip()]
                            if len(cells) >= 9:
                                axis_name = cells[0].lower()
                                try:
                                    ax[axis_name] = round(float(cells[-1]), 4)
                                except:
                                    pass
        if ax and len(ax) >= 3:
            entry["5_axis"] = ax

        # --- Identity code ---
        m = re.search(r'(?:人格码|identity_code|性格编号)\s*[：:]\s*(.+?)(?:\n|$)', txt)
        if m:
            entry["identity_code"] = m.group(1).strip().replace('*','').replace('**','')
        else:
            # Check identity_history
            id_dir = f"{run_dir}/identity_history"
            idf = f"{id_dir}/{df}"
            if os.path.isfile(idf):
                with open(idf) as f:
                    idtxt = f.read()
                m = re.search(r'(?:人格码|identity_code)[：:]\s*(.+?)(?:\n|$)', idtxt)
                if m:
                    entry["identity_code"] = m.group(1).strip().replace('*','')

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

    # Write JS
    js = "// Auto-generated by extract_data.py\n"
    js += "window.BEANY_DATA = " + json.dumps(output, indent=2, ensure_ascii=False) + ";"
    with open(OUT, "w") as f:
        f.write(js)

    # Stats
    r2 = len(output["runs"].get("run_02_p06_zhengyin", {}).get("nodes", {}))
    r3 = len(output["runs"].get("run_03_p06_shishen", {}).get("nodes", {}))
    print(f"✅ Extracted: run2={r2} nodes, run3={r3} nodes → {OUT}")

    # Verify timeline data
    for rid in RUNS:
        r = output["runs"][rid]
        has_weights = sum(1 for v in r["timeline"].values() if "weights" in v)
        has_5axis = sum(1 for v in r["timeline"].values() if "5_axis" in v)
        has_health = sum(1 for v in r["timeline"].values() if "health" in v)
        print(f"   {rid}: weights_in_timeline={has_weights}, 5axis={has_5axis}, health={has_health}")

if __name__ == "__main__":
    main()
