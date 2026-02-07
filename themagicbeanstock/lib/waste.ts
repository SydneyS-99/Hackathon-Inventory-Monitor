// lib/waste.ts
export function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

// Parse "YYYY-MM-DD" as LOCAL midnight (prevents timezone off-by-one bugs)
export function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysToExpireFromIso(isoDate: string | null | undefined) {
  if (!isoDate) return null;

  const today = new Date();
  const todayLocalMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expLocalMidnight = parseLocalDate(isoDate);

  const ms = expLocalMidnight.getTime() - todayLocalMidnight.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Waste risk logic using ONLY inventory fields you already have:
 * - currentStock
 * - avgDailyUsage
 * - estimatedExpirationDate
 * - wastePctHistorical
 * - pricePerUnitUSD
 *
 * "At risk" means:
 * - we have excess inventory beyond what we can consume before expiry
 * - AND expires within RISK_WINDOW_DAYS
 */
export function enrichInventoryWithWaste(invRows: any[], RISK_WINDOW_DAYS = 7) {
  const enriched = invRows.map((it) => {
    const stock = Number(it.currentStock ?? 0);
    const avgDaily = Number(it.avgDailyUsage ?? 0);

    const daysToExpire = daysToExpireFromIso(it.estimatedExpirationDate);

    const usableBeforeExpire =
      daysToExpire === null ? null : avgDaily * daysToExpire;

    const excessAtRisk =
      usableBeforeExpire === null ? 0 : Math.max(0, stock - usableBeforeExpire);

    const wasteRate = Number(it.wastePctHistorical ?? 10) / 100; // % -> decimal
    const estimatedWaste = excessAtRisk * wasteRate;

    const price = Number(it.pricePerUnitUSD ?? 0);
    const wasteValueUSD = estimatedWaste * price;

    const atRisk =
      excessAtRisk > 0.0001 &&
      daysToExpire !== null &&
      daysToExpire <= RISK_WINDOW_DAYS;

    return {
      ...it,
      daysToExpire,
      usableBeforeExpire: usableBeforeExpire === null ? null : round(usableBeforeExpire),
      excessAtRisk: round(excessAtRisk),
      estimatedWaste: round(estimatedWaste),
      wasteValueUSD: round(wasteValueUSD),
      atRisk,
      riskWindowDays: RISK_WINDOW_DAYS,
    };
  });

  const atRiskItems = enriched.filter((x) => x.atRisk);
  const expiringSoon = enriched.filter((x) => x.daysToExpire !== null && x.daysToExpire <= 3);
  const lowStock = enriched.filter((x) => Number(x.currentStock ?? 0) < Number(x.reorderPoint ?? 0));
  const totalWasteValue = atRiskItems.reduce((s, x) => s + Number(x.wasteValueUSD ?? 0), 0);

  const stats = {
    totalItems: enriched.length,
    atRiskCount: atRiskItems.length,
    expiringSoonCount: expiringSoon.length,
    lowStockCount: lowStock.length,
    wasteValueUSD: round(totalWasteValue),
  };

  return { enriched, stats };
}
