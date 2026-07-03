export const pct = (value, digits = 1) =>
  value === null || value === undefined ? "–" : `${(value * 100).toFixed(digits)}%`;

export const pct0 = (value) => pct(value, 0);

export const signedPts = (value) =>
  value === null || value === undefined
    ? "–"
    : `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`;

export const record = (r) => `${r.wins}–${r.losses}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const dateLabel = (iso) => {
  if (!iso) return "–";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

export const monthYear = (iso) => {
  if (!iso) return "–";
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export const WIN_TYPE_LABELS = {
  regulation: "regulation",
  early_8: "early 8",
  scratch_on_8: "scratch on 8",
  wrong_pocket: "wrong pocket",
  win_on_break: "win on break",
};

/* Fixed slot order for win types: color follows the entity, never the rank. */
export const WIN_TYPE_ORDER = ["regulation", "early_8", "scratch_on_8", "wrong_pocket", "win_on_break"];

export const WIN_TYPE_COLORS = {
  regulation: "var(--ball-2)",
  early_8: "var(--ball-1)",
  scratch_on_8: "var(--ball-5)",
  wrong_pocket: "var(--ball-4)",
  win_on_break: "var(--ball-6)",
};
