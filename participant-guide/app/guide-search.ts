export type GuideSearchItem = {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly keywords: string;
};

export function normalizeGuideQuery(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{Letter}\p{Number}/]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchGuideItems(items: readonly GuideSearchItem[], query: string) {
  const normalizedQuery = normalizeGuideQuery(query);
  if (!normalizedQuery) return [];

  const terms = normalizedQuery.split(" ");
  return items.filter((item) => {
    const haystack = normalizeGuideQuery(`${item.label} ${item.summary} ${item.keywords}`);
    return terms.every((term) => haystack.includes(term));
  });
}
