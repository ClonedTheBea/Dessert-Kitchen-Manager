import type { Channel } from "./businessTypes";
export function orderedChannels(channels: Channel[]) {
  const rate = (c: Channel) =>
    (c.commissionConfigured ?? c.commissionPercent !== 0)
      ? c.commissionPercent
      : 0;
  return [...channels].sort(
    (a, b) => rate(b) - rate(a) || a.name.localeCompare(b.name, "en"),
  );
}
