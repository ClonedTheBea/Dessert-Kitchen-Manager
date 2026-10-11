export async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch("/api" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "X-Kitchen-Request": "1" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error:
        response.status === 429
          ? "Too many login attempts. Try again in one minute."
          : "The server could not process this request.",
    }));
    if (response.status === 401 && !path.startsWith("/auth"))
      window.dispatchEvent(new Event("kitchen-session-expired"));
    throw new Error(error.error || "Please check your entries and try again.");
  }
  return response.status === 204 ||
    response.headers.get("content-length") === "0"
    ? (undefined as T)
    : response.json();
}
export const money = (n: number | null | undefined) =>
  n == null
    ? "Unknown"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(n);
export const number = (n: number) =>
  new Intl.NumberFormat(
    "en-GB",
    n !== 0 && Math.abs(n) < 0.01
      ? { maximumSignificantDigits: 3 }
      : { maximumFractionDigits: 2 },
  ).format(n);
export const date = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

// Display conversion only: stored prices and all authoritative costing remain unrounded.
export const unitPrice = (cost: number | null | undefined, unit: string) => {
  if (cost == null) return "Cost unknown";
  if (unit === "g" || unit === "ml")
    return `${money(cost * 1000)}/${unit === "g" ? "kg" : "litre"} · ${number(cost * 100 * 100)}p/100${unit}`;
  return `${money(cost)}/${unit}`;
};
