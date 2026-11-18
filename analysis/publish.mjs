import "../server/public-access.js";
import { readFile } from "node:fs/promises";
import supabase from "../api/db-client.js";
for (const year of ["2021", "2022", "2023", "2024", "2025"]) {
  const body = await readFile(`public/data/${year}.json`, "utf8");
  const { data, error } = await supabase
    .from("bundeslens_seasons")
    .update({ payload: { body }, updated_at: new Date().toISOString() })
    .eq("year", year + "-research")
    .select("year,label");
  if (error) throw error;
  console.log(
    "Published",
    data[0]?.label || "already sealed",
    JSON.parse(body).matches.length,
    "fixtures",
  );
}
