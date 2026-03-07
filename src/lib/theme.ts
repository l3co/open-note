export interface AccentPalette {
  name: string;
  hex: string;
  hover: string;
  subtle: string;
  text: string;
}

export const ACCENT_PALETTES: AccentPalette[] = [
  {
    name: "Blue",
    hex: "#3b82f6",
    hover: "#2563eb",
    subtle: "rgba(59, 130, 246, 0.1)",
    text: "#ffffff",
  },
  {
    name: "Indigo",
    hex: "#6366f1",
    hover: "#4f46e5",
    subtle: "rgba(99, 102, 241, 0.1)",
    text: "#ffffff",
  },
  {
    name: "Purple",
    hex: "#8b5cf6",
    hover: "#7c3aed",
    subtle: "rgba(139, 92, 246, 0.1)",
    text: "#ffffff",
  },
  {
    name: "Berry",
    hex: "#ec4899",
    hover: "#db2777",
    subtle: "rgba(236, 72, 153, 0.1)",
    text: "#ffffff",
  },
  {
    name: "Red",
    hex: "#ef4444",
    hover: "#dc2626",
    subtle: "rgba(239, 68, 68, 0.1)",
    text: "#ffffff",
  },
  {
    name: "Orange",
    hex: "#f97316",
    hover: "#ea580c",
    subtle: "rgba(249, 115, 22, 0.1)",
    text: "#ffffff",
  },
  {
    name: "Amber",
    hex: "#f59e0b",
    hover: "#d97706",
    subtle: "rgba(245, 158, 11, 0.1)",
    text: "#1a1a1a",
  },
  {
    name: "Green",
    hex: "#22c55e",
    hover: "#16a34a",
    subtle: "rgba(34, 197, 94, 0.1)",
    text: "#ffffff",
  },
  {
    name: "Teal",
    hex: "#14b8a6",
    hover: "#0d9488",
    subtle: "rgba(20, 184, 166, 0.1)",
    text: "#ffffff",
  },
  {
    name: "Graphite",
    hex: "#64748b",
    hover: "#475569",
    subtle: "rgba(100, 116, 139, 0.1)",
    text: "#ffffff",
  },
];

export function getAccentPalette(name: string): AccentPalette {
  return (
    ACCENT_PALETTES.find((p) => p.name === name) ?? ACCENT_PALETTES[0]!
  );
}

export function applyAccentColor(palette: AccentPalette): void {
  const root = document.documentElement;
  root.style.setProperty("--accent", palette.hex);
  root.style.setProperty("--accent-hover", palette.hover);
  root.style.setProperty("--accent-subtle", palette.subtle);
  root.style.setProperty("--accent-text", palette.text);
}

export function applyBaseTheme(theme: string): void {
  const root = document.documentElement;
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", isDark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export function applyChromeTint(tint: string): void {
  document.documentElement.setAttribute("data-chrome", tint);
}

export function listenSystemTheme(callback: (isDark: boolean) => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
