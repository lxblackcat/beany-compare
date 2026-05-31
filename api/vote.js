// POST /api/vote
// Body: { "node_id": "day1_N1", "preference": "left" }
// Increments vote counter for the given preference

const KV_KEY = "beany_votes";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { node_id, preference } = req.body || {};

  if (!node_id || !preference || !["left", "right"].includes(preference)) {
    return res.status(400).json({ error: "node_id and preference (left|right) required" });
  }

  if (!process.env.BEANY_KV) {
    // Try @vercel/kv
    try {
      const { kv } = await import("@vercel/kv");
      let votes = await kv.get(KV_KEY) || {};
      if (!votes[node_id]) votes[node_id] = { left: 0, right: 0 };
      votes[node_id][preference]++;
      await kv.set(KV_KEY, votes);
      return res.json({ ok: true, votes: votes[node_id] });
    } catch (e) {
      // Fallback: in-memory for dev
      console.log("KV unavailable, using memory fallback", e.message);
    }
  }

  // Fallback: in-memory (dev without KV)
  if (!global.__vote_store) global.__vote_store = {};
  if (!global.__vote_store[node_id]) global.__vote_store[node_id] = { left: 0, right: 0 };
  global.__vote_store[node_id][preference]++;

  return res.json({
    ok: true,
    votes: global.__vote_store[node_id],
    warning: "in-memory (not persisted)"
  });
}
