import "../server/public-access.js";
import supabase from "./db-client.js";
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Read-only dataset" });
  const year = String(req.query.year || "2025");
  if (!["2021", "2022", "2023", "2024", "2025"].includes(year))
    return res.status(400).json({ error: "Unsupported season" });
  try {
    const { data, error } = await supabase
      .from("bundeslens_seasons")
      .select("payload")
      .eq("year", year + "-research")
      .single();
    if (error) throw error;
    if (!data?.payload) throw new Error("Missing snapshot");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    return res
      .status(200)
      .json(data.payload.body ? JSON.parse(data.payload.body) : data.payload);
  } catch (error) {
    console.error("Season snapshot unavailable", error.message);
    return res.status(503).json({
      error:
        "Season service temporarily unavailable. Use the archived snapshot.",
    });
  }
}
