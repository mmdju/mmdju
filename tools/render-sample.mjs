// Render a README sample the way GitHub does: GitHub-flavoured Markdown,
// no external CSS/JS. Used to preview samples before they land in the repo.
//   node tools/render-sample.mjs samples/a-showcase.md out.html
import { readFileSync, writeFileSync } from "node:fs";

const md = readFileSync(process.argv[2], "utf8");

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ESC[c]);
const inline = (s) =>
  esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${u}" alt="${a}" class="img">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, a, u) => `<a href="${u}">${a}</a>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");

// HTML passthrough: keep tags, convert only Markdown constructs that are safe
// to expand inside a cell (images, links, bold, code).
function inlineHtml(src) {
  return src
    .replace(/^(\s*)<table>/, "$1<table>")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${u}" alt="${a}" class="img">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, a, u) => `<a href="${u}">${a}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/&amp;/g, "&amp;");
}

function cells(row) {
  return row
    .split("\n")
    .join(" ")
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

function renderTable(src) {
  // A row may span several physical lines (HTML cells with <br> inside).
  const raw = src.split("\n").map((r) => r.trim());
  const rows = [];
  for (const line of raw) {
    if (!line || !line.startsWith("|")) continue;
    if (/^\|[\s:|-]+\|$/.test(line)) continue; // separator row
    if (line.includes("</td>") && rows.length) rows[rows.length - 1] += " " + line;
    else rows.push(line);
  }
  const head = cells(rows[0] ?? "");
  const rest = rows.slice(1).map(cells);
  return (
    "<table><thead><tr>" +
    head.map((h) => `<th>${inline(h)}</th>`).join("") +
    "</tr></thead><tbody>" +
    rest
      .map(
        (r) =>
          "<tr>" +
          r
            .map((c) => {
              const al = /align="(center|right|left)"/.exec(c);
              const style = al ? ` style="text-align:${al[1]}"` : "";
              return `<td${style}>${inline(c.replace(/align="[a-z]+"/, ""))}</td>`;
            })
            .join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table>"
  );
}

function render(md) {
  const out = [];
  const lines = md.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^<table>/.test(line.trim())) {
      let depth = 0;
      const buf = [];
      for (; i < lines.length; i++) {
        buf.push(lines[i]);
        if (/<table>/.test(lines[i])) depth++;
        if (/<\/table>/.test(lines[i])) {
          depth--;
          if (depth === 0) break;
        }
      }
      i++;
      // The block is already valid HTML. Pass it through and only convert the
      // Markdown that lives inside the cells, so tags survive untouched.
      out.push(inlineHtml(buf.join("\n")));
      continue;
    }

    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(
        `<pre><code class="lang-${esc(lang)}">${esc(buf.join("\n"))}</code></pre>`,
      );
      continue;
    }

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    if (/^\|/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\|/.test(lines[i])) buf.push(lines[i++]);
      out.push(renderTable(buf.join("\n")));
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      const n = /^#+/.exec(line)[0].length;
      out.push(`<h${n}>${inline(line.replace(/^#+\s*/, ""))}</h${n}>`);
      i++;
      continue;
    }

    if (/<div align="center">/.test(line)) {
      i++;
      continue;
    }
    if (/^<\/div>/.test(line)) {
      out.push('<p style="text-align:center;margin:0"></p>');
      i++;
      continue;
    }

    if (/^\s*[-*]\s/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) buf.push(lines[i++]);
      out.push(
        "<ul>" +
          buf.map((b) => `<li>${inline(b.replace(/^\s*[-*]\s*/, ""))}</li>`).join("") +
          "</ul>",
      );
      continue;
    }

    // paragraph: collect until blank / block start
    const buf = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6}\s|---+$|```|>|\||<div|<\/div>|\s*[-*]\s)/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    if (buf.length) out.push(`<p>${inline(buf.join(" "))}</p>`);
    else i++;
  }
  return out.filter((x) => x !== '<p style="text-align:center;margin:0"></p>').join("\n");
}

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>mmdju — GitHub render preview</title>
<style>
  /* GitHub's light + dark theme variables, close enough to judge layout. */
  :root{color-scheme:light dark}
  body{margin:0;background:#ffffff;color:#1f2328;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif}
  @media (prefers-color-scheme:dark){
    body{background:#0d1117;color:#e6edf3}
    hr{border-color:#30363d}
    h1,h2,h3{border-color:#30363d}
    a{color:#4493f8}
    code{background:#151b23;color:#e6edf3}
    pre{background:#151b23;border-color:#30363d}
    table tr{border-color:#30363d}
    th,td{border-color:#30363d}
    blockquote{border-color:#3d444d;color:#9198a1}
  }
  .page{max-width:1012px;margin:0 auto;padding:32px 32px 64px}
  .img{max-width:100%;vertical-align:middle}
  h1,h2,h3{margin:24px 0 16px;font-weight:600;line-height:1.25}
  h1{font-size:2em;padding-bottom:.3em;border-bottom:1px solid #d1d9e0}
  h2{font-size:1.5em;padding-bottom:.3em;border-bottom:1px solid #d1d9e0}
  h3{font-size:1.25em}
  p{margin:0 0 16px}
  hr{height:.25em;background:#d1d9e0;border:0;margin:24px 0}
  table{border-collapse:collapse;display:block;width:max-content;max-width:100%;overflow:auto;margin:0 0 16px}
  th,td{padding:6px 13px;border:1px solid #d1d9e0}
  th{font-weight:600;background:#f6f8fa}
  img[src^="http"]{max-width:100%}
  blockquote{padding:0 1em;margin:0 0 16px;border-left:.25em solid #d1d9e0;color:#59636e}
  pre{padding:16px;overflow:auto;border-radius:6px;font-size:85%;line-height:1.45;margin:0 0 16px}
  code{font:85% ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;padding:.2em .4em;border-radius:6px}
  pre code{padding:0;background:transparent}
  a{color:#0969da;text-decoration:none}
  a:hover{text-decoration:underline}
</style>
<div class="page">
${render(md)}
</div>
`;

writeFileSync(process.argv[3], html);
console.log("wrote " + process.argv[3]);
