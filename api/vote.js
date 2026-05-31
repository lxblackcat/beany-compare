// POST /api/vote
// Body: { "node_id": "day1_N1", "preference": "left" }

const KV_KEY = "beany_votes";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { node_id, preference } = req.body || {};
  if (!node_id || !["left", "right"].includes(preference)) {
    return res.status(400).json({ error: "node_id and preference (left|right) required" });
  }

  // Try Upstash Redis (via KV_REST_API_URL + TOKEN env vars)
  const redisUrl = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;
  if (redisUrl && redisToken) {
    try {
      // Read current votes
      const getRes = await fetch(`${redisUrl}/get/${KV_KEY}`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      });
      const getData = await getRes.json();
      let votes = getData.result ? JSON.parse(getData.result) : {};
      if (!votes[node_id]) votes[node_id] = { left: 0, right: 0 };
      votes[node_id][preference]++;
      // Write back
      await fetch(`${redisUrl}/set/${KV_KEY}`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(votes)
      });
      return res.json({ ok: true, votes: votes[node_id] });
    } catch (e) {
      console.log("Redis error:", e.message);
    }
  }

  // Fallback: in-memory
  if (!global.__vote_store) global.__vote_store = {};
  if (!global.__vote_store[node_id]) global.__vote_store[node_id] = { left: 0, right: 0 };
  global.__vote_store[node_id][preference]++;
  return res.json({
    ok: true,
    votes: global.__vote_store[node_id],
    warning: "in-memory (not persisted — add Upstash Redis)"
  });
}
