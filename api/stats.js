// GET /api/stats
// Returns all vote counts

const KV_KEY = "beany_votes";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Try Vercel KV
  if (process.env.BEANY_KV) {
    try {
      const { kv } = await import("@vercel/kv");
      const votes = await kv.get(KV_KEY) || {};
      return res.json(votes);
    } catch (e) {
      console.log("KV read failed", e.message);
    }
  }

  // Fallback: in-memory
  const votes = global.__vote_store || {};
  return res.json(votes);
}
