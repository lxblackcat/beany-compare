// GET /api/stats — returns all vote counts

const KV_KEY = "beany_votes";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Try Upstash Redis
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    try {
      const getRes = await fetch(`${redisUrl}/get/${KV_KEY}`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      });
      const getData = await getRes.json();
      const votes = getData.result ? JSON.parse(getData.result) : {};
      return res.json(votes);
    } catch (e) {
      console.log("Redis error:", e.message);
    }
  }

  // Fallback
  return res.json(global.__vote_store || {});
}
