import type { Group } from "@snr/core";

/** Extracts a short class label ("7А") from group names, e.g. "Математика 7А". */
export function getClassLabel(groups: Group[]): string {
  if (!groups.length) return "";
  const extract = (name: string) => {
    const m = name.match(/(\d+\s*[А-ЯA-Z][а-яa-z]?)$/);
    return m?.[1]?.replace(/\s+/, "") ?? null;
  };
  const labels = [...new Set(groups.map((g) => extract(g.name)).filter(Boolean))];
  return labels.length === 1 ? (labels[0] as string) : (extract(groups[0]?.name ?? "") ?? "");
}
