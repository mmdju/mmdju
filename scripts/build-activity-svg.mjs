// Build assets/activity.svg from a GitHub contributions week array.
//   node scripts/build-activity-svg.mjs <weeks.json> <out.svg>
// weeks.json: [[count, ...7 days], ...53 weeks] oldest first.
import { readFileSync, writeFileSync } from "node:fs";

const [inPath, outPath] = process.argv.slice(2);
const weeks = JSON.parse(readFileSync(inPath, "utf8"));

// Theme matches assets/midnight-stats.svg so the two cards sit together.
const LEVEL = ["#16161A", "#0A84FF33", "#0A84FF66", "#0A84FFAA", "#0A84FF"];
const level = (n) => (n === 0 ? 0 : n <= 3 ? 1 : n <= 6 ? 2 : n <= 9 ? 3 : 4);

const CELL = 6;
const GAP = 2;
const PITCH = CELL + GAP;
const X0 = 20;
const Y0 = 78;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

const grid = weeks
  .map((days, w) =>
    days
      .map((n, d) => {
        const x = X0 + w * PITCH;
        const y = Y0 + d * PITCH;
        return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="1.5" fill="${LEVEL[level(n)]}"/>`;
      })
      .join(""),
  )
  .join("\n");

const months = weeks
  .map((days, w) => {
    const date = new Date(days.date ?? Date.UTC(2026, 0, 1 + w * 7));
    const m = date.getUTCMonth();
    const prev = w === 0 ? -1 : new Date(weeks[w - 1].date).getUTCMonth();
    if (m === prev) return "";
    return `<text x="${X0 + w * PITCH}" y="${Y0 - 8}" font-size="9.5" fill="#636366">${date.toLocaleString("en", { month: "short", timeZone: "UTC" })}</text>`;
  })
  .join("\n");

const dayLabels = DAY_LABELS.map((l, d) =>
  l
    ? `<text x="${X0 - 6}" y="${Y0 + d * PITCH + 5.5}" font-size="9" fill="#48484A" text-anchor="end">${l}</text>`
    : "",
).join("\n");

const total = weeks.flat().reduce((a, b) => a + b, 0);
const year = new Date().getUTCFullYear();
const legend = [1, 2, 3, 4]
  .map(
    (l, i) =>
      `<rect x="${X0 + i * 13}" y="172" width="9" height="9" rx="2" fill="${LEVEL[l]}"/>`,
  )
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="200" viewBox="0 0 480 200">
<style>text{font-family:'SF Pro Text','Segoe UI',Ubuntu,sans-serif}</style>
<rect x="0.5" y="0.5" width="479" height="199" rx="12" fill="#0A0A0F" stroke="#38383A"/>
<circle cx="28" cy="32" r="4" fill="#0A84FF"/>
<text x="40" y="38" font-size="16" font-weight="600" fill="#F5F5F7">Activity</text>
<text x="452" y="38" font-size="12" fill="#636366" text-anchor="end">mmdju</text>
<line x1="20" y1="52" x2="460" y2="52" stroke="#1C1C1E"/>
<text x="20" y="66" font-size="10" letter-spacing="0.09em" fill="#48484A">${total.toLocaleString("en-US")} CONTRIBUTIONS IN ${year}</text>
${months}
${dayLabels}
<g transform="translate(26,0)">${grid}</g>
${legend}
<text x="80" y="180" font-size="9.5" fill="#48484A">Less</text>
<text x="452" y="180" font-size="9.5" fill="#48484A" text-anchor="end">More</text>
</svg>
`;

writeFileSync(outPath, svg);
console.log(`wrote ${outPath} (${total} contributions across ${weeks.length} weeks)`);
