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
export const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    n,
  );
export const number = (n: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(n);
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
