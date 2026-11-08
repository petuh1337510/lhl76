/** Media catalogue filtering is shared by all pages, before the bounded slice. */
export type CatalogueItem = {
  key: string; title: string; url: string; type: string; kind: string;
  date: string; datePrecision: "day" | "month"; size: number;
  usedBy: { label: string; href: string }[];
};

export function mediaPage<T extends CatalogueItem>(items: T[], params: URLSearchParams) {
  const query = (params.get("name") ?? "").trim().toLocaleLowerCase("ru");
  const minimum = params.get("minSize") ? Number(params.get("minSize")) * 1024 * 1024 : null;
  const maximum = params.get("maxSize") ? Number(params.get("maxSize")) * 1024 * 1024 : null;
  const from = params.get("dateFrom") ?? "", to = params.get("dateTo") ?? "";
  const type = params.get("type"), kind = params.get("kind"), order = params.get("order");
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" });
  const filtered = items.filter(item => {
    const day = formatter.format(new Date(item.date));
    return (!type || item.type === type) && (!kind || item.kind === kind)
      && (!query || [item.title, item.url, ...item.usedBy.map(use => use.label)].some(value => value.toLocaleLowerCase("ru").includes(query)))
      && (!from || (item.datePrecision === "month" ? day.slice(0, 7) >= from.slice(0, 7) : day >= from))
      && (!to || (item.datePrecision === "month" ? day.slice(0, 7) <= to.slice(0, 7) : day <= to))
      && (minimum === null || item.size >= minimum) && (maximum === null || item.size <= maximum);
  }).sort((a, b) => {
    const tie = a.key.localeCompare(b.key);
    if (order === "oldest") return a.date.localeCompare(b.date) || tie;
    if (order === "name") return a.title.localeCompare(b.title, "ru") || tie;
    if (order === "size-desc") return b.size - a.size || tie;
    if (order === "size-asc") return a.size - b.size || tie;
    return b.date.localeCompare(a.date) || tie;
  });
  const requested = Number(params.get("page"));
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, 100000) : 1;
  const pageSize = 24, start = (page - 1) * pageSize;
  return { items: filtered.slice(start, start + pageSize), page, pageSize, total: filtered.length, catalogueTotal: items.length, hasMore: start + pageSize < filtered.length };
}
