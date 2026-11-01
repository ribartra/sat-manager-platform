/**
 * Browser-side helpers for "Report a problem" (components/sat/issue-reporter.tsx): describe the clicked
 * element or the dragged area (selector, tag, classes, data-* and aria attributes, HTML, ancestors),
 * the block it belongs to, recent JS errors, and a viewport screenshot. Ported from the mockup's
 * feedback.js (ui-referencias/public_html/corregida/assets/feedback.js).
 */
import type { IssueElement, IssueTarget } from "@/lib/issue-report";

/** Marks the reporter's own UI: never selectable, never in the screenshot. */
export const REPORTER_ATTR = "data-issue-reporter";
export const isReporterUi = (el: Element | null) => !!el?.closest?.(`[${REPORTER_ATTR}]`);

// ---------------------------------------------------------------- recent JS errors
const recentErrors: string[] = [];
let errorsHooked = false;
/** Keeps the last 10 page errors so a report can say what broke. Safe to call many times. */
export function hookPageErrors() {
  if (errorsHooked || typeof window === "undefined") return;
  errorsHooked = true;
  const push = (msg: string) => {
    recentErrors.push(`${new Date().toISOString().slice(11, 19)} ${msg}`.slice(0, 500));
    if (recentErrors.length > 10) recentErrors.shift();
  };
  window.addEventListener("error", (e) => push(`${e.message}${e.filename ? ` (${e.filename}:${e.lineno})` : ""}`));
  window.addEventListener("unhandledrejection", (e) => push(`Unhandled rejection: ${String((e.reason as Error)?.message ?? e.reason)}`));
}

// ---------------------------------------------------------------- element description
const text = (el: Element) =>
  ((el as HTMLElement).innerText || (el as HTMLInputElement).value || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ");

function classList(el: Element) {
  const raw = typeof el.className === "string" ? el.className : el.getAttribute("class") ?? "";
  return raw.split(/\s+/).filter(Boolean);
}

/** CSS path from the nearest ancestor with an id (feedback.js selectorOf). */
export function selectorOf(start: Element): string {
  const parts: string[] = [];
  let el: Element | null = start;
  while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
    if (el.id) {
      parts.unshift(`#${CSS.escape(el.id)}`);
      break;
    }
    let i = 1;
    let sib = el.previousElementSibling;
    for (; sib; sib = sib.previousElementSibling) if (sib.tagName === el.tagName) i++;
    parts.unshift(`${el.tagName.toLowerCase()}:nth-of-type(${i})`);
    el = el.parentElement;
  }
  return parts.join(" > ") || "body";
}

function shortName(el: Element) {
  const cls = classList(el).slice(0, 4).map((c) => `.${c}`).join("");
  return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls}`;
}

const KEPT_ATTRS = /^(data-|aria-|role$|href$|name$|type$|title$|alt$|src$|for$|placeholder$|disabled$)/;

/** HTML of the element with form values removed (a student's typed answer stays out of the email). */
function cleanHtml(el: Element, max: number) {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll?.("input, textarea").forEach((f) => {
    f.removeAttribute("value");
    if (f.tagName === "TEXTAREA") f.textContent = "";
  });
  clone.querySelectorAll?.("svg path").forEach((p) => p.removeAttribute("d"));
  const html = clone.outerHTML;
  return html.length > max ? `${html.slice(0, max)}… (${html.length} chars)` : html;
}

export function describeElement(el: Element, full = true): IssueElement {
  const r = el.getBoundingClientRect();
  const out: IssueElement = { selector: selectorOf(el), tag: el.tagName.toLowerCase() };
  if (el.id) out.id = el.id;
  const classes = classList(el);
  if (classes.length) out.classes = classes;
  const t = text(el);
  if (t) out.text = t.slice(0, full ? 200 : 100);
  if (!full) return out;
  const attributes: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) if (KEPT_ATTRS.test(a.name) && a.name !== REPORTER_ATTR) attributes[a.name] = a.value.slice(0, 200);
  if (Object.keys(attributes).length) out.attributes = attributes;
  out.html = cleanHtml(el, 4000);
  const ancestors: string[] = [];
  for (let p = el.parentElement; p && p !== document.body && ancestors.length < 6; p = p.parentElement) ancestors.push(shortName(p));
  if (ancestors.length) out.ancestors = ancestors;
  out.rect = { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  return out;
}

/** Closest heading before the element: the block it belongs to (feedback.js contextOf). */
export function contextOf(el: Element) {
  const headings = Array.from(document.querySelectorAll("h1,h2,h3")).filter((h) => !isReporterUi(h) && text(h));
  let best: Element | null = null;
  for (const h of headings) {
    if (h === el || h.contains(el) || h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = h;
    else break;
  }
  return best ? text(best).slice(0, 120) : document.title;
}

function base(): Pick<IssueTarget, "devicePixelRatio" | "scroll" | "errors"> {
  return {
    devicePixelRatio: window.devicePixelRatio,
    scroll: { x: Math.round(window.scrollX), y: Math.round(window.scrollY) },
    errors: recentErrors.length ? [...recentErrors] : undefined,
  };
}

export function targetForElement(el: Element): IssueTarget {
  return { kind: "element", context: contextOf(el), element: describeElement(el), ...base() };
}

export function targetForPage(): IssueTarget {
  return { kind: "page", context: `Whole screen (${document.title})`, ...base() };
}

export type Box = { left: number; top: number; right: number; bottom: number };

/** Dragged area: the smallest element containing it, table columns and the elements inside. */
export function targetForArea(B: Box): IssueTarget {
  const all = Array.from(document.body.querySelectorAll("*")).filter((el) => !isReporterUi(el) && !/^(SCRIPT|STYLE|svg|path|NOSCRIPT)$/i.test(el.tagName));
  const inside = all.filter((el) => {
    const r = el.getBoundingClientRect();
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    return r.width && r.height && cx >= B.left && cx <= B.right && cy >= B.top && cy <= B.bottom;
  });
  const contains = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.left <= B.left + 1 && r.right >= B.right - 1 && r.top <= B.top + 1 && r.bottom >= B.bottom - 1;
  };
  let anchor: Element | null = document.elementFromPoint((B.left + B.right) / 2, (B.top + B.bottom) / 2);
  while (anchor && anchor !== document.body && (isReporterUi(anchor) || !contains(anchor))) anchor = anchor.parentElement;
  anchor = anchor ?? document.body;

  const columns: string[] = [];
  document.querySelectorAll("table").forEach((table) => {
    const tr = table.getBoundingClientRect();
    if (tr.bottom < B.top || tr.top > B.bottom) return;
    table.querySelectorAll("thead th").forEach((th) => {
      const r = th.getBoundingClientRect();
      const mid = (r.left + r.right) / 2;
      if (mid >= B.left && mid <= B.right && text(th)) columns.push(text(th));
    });
  });
  const leaves = inside.filter((el) => !el.children.length && text(el)).slice(0, 25);
  const first = inside.find((el) => text(el)) ?? anchor;
  return {
    kind: "area",
    context: contextOf(first) + (columns.length ? " (table)" : ""),
    element: describeElement(anchor),
    area: { x: Math.round(B.left), y: Math.round(B.top), width: Math.round(B.right - B.left), height: Math.round(B.bottom - B.top) },
    columns: columns.length ? columns : undefined,
    inside: leaves.map((el) => describeElement(el, false)),
    ...base(),
  };
}

// ---------------------------------------------------------------- screenshot
const POS_ATTR = "data-ir-pos";

/**
 * JPEG of what the user sees (viewport), with the selection outlined. The page is rendered from the
 * DOM (modern-screenshot), so fixed and sticky elements (sidebar, player bars) are moved to where they
 * are on screen before cropping to the scrolled viewport. Returns null if the browser cannot render it.
 */
export async function captureViewport(highlight?: { x: number; y: number; width: number; height: number }): Promise<Blob | null> {
  const { domToCanvas } = await import("modern-screenshot");
  const sx = window.scrollX;
  const sy = window.scrollY;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const marked: Element[] = [];
  try {
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (isReporterUi(el)) continue;
      const pos = getComputedStyle(el).position;
      if (pos !== "fixed" && pos !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      let style: string;
      if (pos === "fixed") {
        style = `position:absolute;top:${r.top + sy}px;left:${r.left + sx}px;width:${r.width}px;height:${r.height}px;right:auto;bottom:auto;transform:none;margin:0`;
      } else {
        // Where it would sit unstuck (the clone is rendered unscrolled), then shift it to where it is now.
        const h = el as HTMLElement;
        const prev = h.style.position;
        h.style.position = "relative";
        const natural = h.getBoundingClientRect();
        h.style.position = prev;
        style = `position:relative;top:0;transform:translate(${r.left - natural.left}px,${r.top - natural.top}px)`;
      }
      el.setAttribute(POS_ATTR, style);
      marked.push(el);
    }
    const canvas = await domToCanvas(document.documentElement, {
      scale: 1,
      backgroundColor: "#ffffff",
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      // Drop the reporter's overlay/dialog and toasts; keep its trigger button so the layout stays as seen.
      filter: (node) => !(node instanceof Element) || ((node.tagName === "BUTTON" || !node.hasAttribute(REPORTER_ATTR)) && !node.hasAttribute("data-sonner-toaster")),
      onCloneEachNode: (cloned) => {
        if (!(cloned instanceof Element)) return;
        const style = cloned.getAttribute(POS_ATTR);
        if (!style) return;
        cloned.removeAttribute(POS_ATTR);
        for (const decl of style.split(";")) {
          const [prop, value] = decl.split(":");
          if (prop && value) (cloned as HTMLElement).style.setProperty(prop, value, "important");
        }
      },
    });
    const out = document.createElement("canvas");
    out.width = vw;
    out.height = vh;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(canvas, sx, sy, vw, vh, 0, 0, vw, vh);
    if (highlight) {
      ctx.strokeStyle = "#7c3aed";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 5]);
      ctx.fillStyle = "rgba(124,58,237,0.10)";
      ctx.fillRect(highlight.x - 3, highlight.y - 3, highlight.width + 6, highlight.height + 6);
      ctx.strokeRect(highlight.x - 3, highlight.y - 3, highlight.width + 6, highlight.height + 6);
    }
    for (const quality of [0.85, 0.65, 0.45]) {
      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 1.9 * 1024 * 1024) return blob;
    }
    return null;
  } catch {
    return null;
  } finally {
    for (const el of marked) el.removeAttribute(POS_ATTR);
  }
}
