export const PEN_COLORS = [
  "#1a1a1a",
  "#374151",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#db2777",
] as const;

export const HIGHLIGHT_COLORS = [
  "#fef08a",
  "#bbf7d0",
  "#bfdbfe",
  "#fecaca",
  "#fed7aa",
  "#e9d5ff",
  "#99f6e4",
] as const;

export const PEN_SIZES = [
  { label: "XS", value: 1 },
  { label: "S", value: 2 },
  { label: "M", value: 4 },
  { label: "L", value: 7 },
  { label: "XL", value: 12 },
] as const;

export const HIGHLIGHT_SIZES = [
  { label: "S", value: 12 },
  { label: "M", value: 20 },
  { label: "L", value: 32 },
] as const;
