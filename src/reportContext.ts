import {
  createContext,
  useContext,
  useImperativeHandle,
  type RefObject,
} from "react";
import { seasonLabel, type Season } from "./data";
export type Report = {
  rows: (string | number)[][];
  meta: Record<string, string | number>;
};
export const ReportContext = createContext<RefObject<
  (() => Report) | null
> | null>(null);
// Export from the visible view's data model, including its local filters.
export function useReport(build: () => Report) {
  useImperativeHandle(useContext(ReportContext), () => build, [build]);
}
export function provenance(data: Season, view: string) {
  return {
    Report: view,
    Season: seasonLabel(data.year),
    "Archive through": data.updated,
    Sources: "Football-Data.co.uk · FBref · Understat · OpenLigaDB",
  };
}
