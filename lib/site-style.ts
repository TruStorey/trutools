/**
 * The site's switchable visual styles. Purely cosmetic: every style renders
 * the same tools with the same behaviour, over the same background.
 *
 * Kept free of React so the pre-paint script in app/layout.tsx can inline the
 * list and the storage key without importing a client module.
 */
export const SITE_STYLES = [
  { id: "glass", label: "Glass", description: "Liquid-glass cards" },
  { id: "spotlight", label: "Spotlight", description: "Cursor-lit cards" },
  { id: "clay", label: "Clay", description: "Soft, raised and rounded" },
  { id: "terminal", label: "Terminal", description: "Green phosphor CRT" },
  { id: "tinted", label: "Tinted", description: "A hue per section" },
  { id: "blueprint", label: "Blueprint", description: "Grid paper and drafting lines" },
  { id: "swiss", label: "Swiss", description: "Black, white and one red" },
  { id: "vapor", label: "Vapor", description: "Vaporwave pink and cyan" },
  { id: "glitch", label: "Glitch", description: "RGB split on hover" },
  { id: "sticky", label: "Sticky", description: "Sticky notes on a board" },
] as const;

export type SiteStyle = (typeof SITE_STYLES)[number]["id"];

export const DEFAULT_STYLE: SiteStyle = "glass";

export const SITE_STYLE_STORAGE_KEY = "trutools:style";

const IDS = SITE_STYLES.map((style) => style.id) as readonly string[];

export function isSiteStyle(value: unknown): value is SiteStyle {
  return typeof value === "string" && IDS.includes(value);
}

/**
 * Runs in <head> before first paint, so a returning visitor's surfaces and
 * hero never flash the default style. Anything it cannot read falls back to
 * the server-rendered default already on <html>.
 */
export const SITE_STYLE_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  SITE_STYLE_STORAGE_KEY,
)});if(${JSON.stringify(IDS)}.indexOf(s)>-1)document.documentElement.setAttribute("data-style",s)}catch(e){}})()`;
