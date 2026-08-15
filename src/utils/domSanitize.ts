import DOMPurify from "dompurify";

const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: [
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "link",
    "meta",
  ],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "ondblclick",
    "onmousedown",
    "onmouseup",
    "onmouseover",
    "onmouseout",
    "onmousemove",
    "onfocus",
    "onblur",
    "onchange",
    "onkeydown",
    "onkeyup",
    "onkeypress",
    "onsubmit",
    "oninput",
    "style",
    "srcdoc",
  ],
};

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG) as unknown as string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}