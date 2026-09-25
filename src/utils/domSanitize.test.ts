// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { escapeHtml, sanitizeHtml } from "./domSanitize";

describe("sanitizeHtml", () => {
  it("removes script tags", () => {
    const result = sanitizeHtml("<p>hola</p><script>alert(1)</script>");
    expect(result).not.toContain("script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>hola</p>");
  });

  it("strips event handler attributes", () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert(1)");
  });

  it("strips javascript: URLs in hrefs and iframes", () => {
    const result = sanitizeHtml(
      '<a href="javascript:alert(1)">link</a><iframe srcdoc="<script>alert(2)</script>"></iframe>',
    );
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("iframe");
  });

  it("removes style tags and inline style attributes", () => {
    const result = sanitizeHtml(
      '<p style="position:fixed">texto</p><style>body{display:none}</style>',
    );
    expect(result).not.toContain("position:fixed");
    expect(result).not.toContain("<style");
  });

  it("keeps safe rich text tags", () => {
    const result = sanitizeHtml(
      "<h1>Título</h1><p><strong>negrita</strong> <em>cursiva</em></p><ul><li>item</li></ul>",
    );
    expect(result).toContain("<h1>Título</h1>");
    expect(result).toContain("<strong>negrita</strong>");
    expect(result).toContain("<li>item</li>");
  });
});

describe("escapeHtml", () => {
  it("escapes angle brackets, quotes and ampersands", () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'> & "q"`)).toBe(
      "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt; &amp; &quot;q&quot;",
    );
  });
});