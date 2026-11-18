import type { Club } from "./data";

// Keep provider IDs stable for fixture joins; use one German display name everywhere.
const aliases: Readonly<Record<string, string>> = {
  "Bayern Munich": "Bayern München",
  "M'gladbach": "Borussia Mönchengladbach",
  "FC Koln": "1. FC Köln",
  "Greuther Furth": "SpVgg Greuther Fürth",
  "Union Berlin": "1. FC Union Berlin",
  Mainz: "1. FSV Mainz 05",
  Darmstadt: "SV Darmstadt 98",
};
export function canonicalClubs(clubs: Club[]): Club[] {
  return clubs.map((club) => ({
    ...club,
    name: (aliases[club.id] ?? club.name).normalize("NFC"),
  }));
}
