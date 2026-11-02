// Generates the illustrated product art (assets/products/*.svg) and hero art in the Crux brand style:
// ink outlines, flat fills from the Beta mascot palette. Run: node tools/gen-art.mjs
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(join(root, "data/catalog.json"), "utf8"));
const C = { ink: "#1a1f27", cream: "#f6eddc", white: "#fffaf0", navy: "#1f2f55", orange: "#e5672b", red: "#d63a2b", blue: "#2f8fd6", green: "#3d7a4a", sand: "#d4c9b2" };
const PANEL = { "ropes-soft-goods": "#cfe5f5", "carabiners-belay": "#f9dcc7", protection: "#d9e8d3", shoes: "#f2d3cf", harnesses: "#d6dcea", "other-gear": "#efe3c8" };

const p = (d, fill, w = 6, extra = "") => `<path d="${d}" fill="${fill}" stroke="${C.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const circle = (x, y, r, fill, w = 6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${C.ink}" stroke-width="${w}"/>`;
const ell = (x, y, rx, ry, fill, w = 6) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${C.ink}" stroke-width="${w}"/>`;
const line = (d, w = 5, col = C.ink, extra = "") => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const rope = (d, c, w = 14, c2) => line(d, w + 8) + line(d, w, c) + (c2 ? line(d, w / 2.4, c2, 'stroke-dasharray="5 13"') : "");

const art = {
  rope: (c, c2) => [100, 78, 56, 34].map((r, i) => rope(`M${200 - r} 200 A${r} ${r * 0.9} 0 1 1 ${200 + r} 200 A${r} ${r * 0.9} 0 1 1 ${200 - r} 200`, i % 2 ? c2 || c : c, 15, i % 2 ? c : c2)).join("") + rope("M290 250 C330 280 335 320 372 336", c, 15, c2),
  static: () => art.rope(C.sand, C.navy).replace(/<\/g>$/, "") + p("M150 330 h100 v34 h-100z", C.white, 5) + `<text x="200" y="355" text-anchor="middle" font-family="Georgia,serif" font-size="22" font-weight="700" fill="${C.ink}">HAUL</text>`,
  webbing: () => rope("M80 110 H300 Q345 110 345 150 Q345 190 300 190 H100 Q55 190 55 230 Q55 270 100 270 H320", C.orange, 30, C.cream),
  autoblock: () => p("M105 150 Q105 105 160 105 H250 Q300 105 300 160 V240 Q300 295 250 295 H160 Q105 295 105 240Z", C.navy) + p("M105 150 Q105 105 160 105 H190 V295 H160 Q105 295 105 240Z", C.orange) + ell(250, 200, 34, 52, C.cream) + circle(150, 200, 22, C.white) + line("M230 150 Q270 200 230 250", 7, C.blue),
  tube: () => p("M120 130 H280 V290 H120Z", C.blue, 6) + ell(200, 130, 80, 24, "#8cc4ec") + ell(200, 290, 80, 24, C.blue) + ell(165, 130, 20, 9, C.ink, 3) + ell(235, 130, 20, 9, C.ink, 3) + line("M160 190 H240 M160 235 H240", 6, C.cream),
  hms: () => p("M170 70 C260 70 290 150 262 240 C248 295 150 295 138 240 C118 170 135 70 170 70Z", C.cream, 7) + p("M185 112 C235 112 250 160 236 225 C228 255 172 255 164 225 C152 175 158 112 185 112Z", C.white, 5) + line("M255 150 L282 235", 9, C.red) + circle(268, 192, 10, C.orange, 5),
  wire: () => [[150, 190, -12], [250, 210, 14]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r})">` + p("M-45 -85 H20 Q60 -85 60 -40 V40 Q60 85 20 85 H-25 Q-60 85 -60 40 V-40 Q-60 -85 -45 -85Z", C.cream, 7) + p("M-28 -62 H15 Q36 -62 36 -38 V38 Q36 62 15 62 H-18 Q-36 62 -36 38 V-38 Q-36 -62 -28 -62Z", C.white, 4) + line("M60 -30 V30", 9, C.orange) + "</g>").join(""),
  draw: (n) => {
    const bi = (y, col) => `<g transform="translate(200 ${y})">` + p("M-34 -50 H14 Q44 -50 44 -20 V28 Q44 54 14 54 H-24 Q-44 54 -44 28 V-20 Q-44 -50 -34 -50Z", C.cream, 6) + p("M-20 -32 H8 Q24 -32 24 -16 V24 Q24 38 8 38 H-14 Q-24 38 -24 24 V-16 Q-24 -32 -20 -32Z", C.white, 4) + line("M44 -10 V24", 8, col) + "</g>";
    return rope("M200 130 V270", C.red, 26, C.cream) + bi(100, C.orange) + bi(300, C.blue) + circle(330, 90, 36, C.orange) + `<text x="330" y="102" text-anchor="middle" font-family="Georgia,serif" font-size="${n > 9 ? 34 : 40}" font-weight="700" fill="${C.white}">${n}</text>`;
  },
  cam: () => line("M200 260 V345", 12) + line("M200 260 V345", 6, C.orange) + p("M190 345 h20 v14 h-20z", C.red, 4) + [[-1, 0], [1, 0]].map(([s]) => p(`M200 205 C${200 + s * 20} 150 ${200 + s * 85} 120 ${200 + s * 110} 160 C${200 + s * 125} 190 ${200 + s * 90} 230 ${200 + s * 40} 245Z`, s < 0 ? C.orange : C.red, 6)).join("") + [[-1], [1]].map(([s]) => circle(200 + s * 66, 175, 12, C.cream, 4)).join("") + p("M170 245 H230 V270 H170Z", C.navy, 6) + line("M200 270 V245", 4),
  nuts: () => [[110, 150, 54, C.orange], [210, 120, 44, C.blue], [290, 200, 36, C.green]].map(([x, y, s, col]) => line(`M${x} ${y + s / 2} C${x} ${y + 120} ${x + 20} ${y + 150} ${x + 60} ${y + 170}`, 5) + p(`M${x - s / 2} ${y - s / 2} L${x + s / 2} ${y - s / 2 + 8} L${x + s / 3} ${y + s / 2} L${x - s / 3} ${y + s / 2 - 6}Z`, col, 6)).join("") + rope("M60 330 Q200 250 340 330", C.cream, 10, C.orange),
  shoe: (kind, col) => {
    const upper = kind === "approach"
      ? p("M70 260 L72 100 Q72 84 90 84 H152 L160 150 Q190 152 208 178 Q232 206 292 216 Q342 224 342 256 V276 H70Z", col)
      : p("M70 260 L70 170 Q70 140 100 140 L160 150 Q190 150 208 176 Q232 206 292 214 Q342 222 342 256 V276 H70Z", col);
    const sole = p("M66 276 H346 V304 Q346 318 332 318 H80 Q66 318 66 304Z", C.cream, 6) + line("M80 296 H332", 6, C.orange);
    const lace = kind === "slipper" ? p("M150 160 Q230 160 262 214 L230 222 Q200 190 150 190Z", C.cream, 5) + line("M168 176 H228", 5, C.orange) : line("M160 150 L200 190 M175 160 L215 198 M190 170 L228 206", 6, C.cream) + (kind === "approach" ? line("M90 120 H150 M90 150 H152", 5, C.cream) : "");
    const toe = kind === "slipper" ? p("M292 214 Q342 222 342 256 V276 H280 Q300 250 292 214Z", C.red, 5) : p("M300 232 Q342 238 342 262 V276 H296Z", C.cream, 5);
    return upper + toe + sole + lace + (kind === "trad" ? line("M72 200 H110", 8, C.orange) : "");
  },
  harness: (col, size) => rope("M95 150 Q200 120 305 150 Q330 190 305 230 Q200 262 95 230 Q70 190 95 150Z", col, 30) + [130, 270].map((x) => rope(`M${x} 235 Q${x - 18} 305 ${x} 350 Q${x + 36} 360 ${x + 40} 320 Q${x + 36} 270 ${x + 30} 240`, col, 22)).join("") + p("M185 160 H215 V200 H185z", C.orange, 5) + line("M150 140 q0 -26 20 -26 M250 140 q0 -26 -20 -26", 7, C.cream) + [118, 282].map((x) => line(`M${x} 140 v-40`, 6, C.red)).join("") + `<text x="200" y="395" text-anchor="middle" font-family="Georgia,serif" font-size="20" font-weight="700" fill="${C.ink}">${size}</text>`,
  helmet: (col) => p("M70 240 Q70 100 200 100 Q330 100 330 240Z", col, 7) + p("M62 240 H338 Q346 240 346 252 Q346 262 336 262 H64 Q54 262 54 252 Q54 240 62 240Z", C.navy, 6) + [[140, 140], [200, 125], [260, 140]].map(([x, y]) => p(`M${x - 14} ${y} q14 -18 28 0 v32 h-28z`, C.cream, 4)).join("") + line("M120 262 Q200 330 280 262", 7, C.orange) + circle(200, 300, 10, C.cream, 4),
  chalk: () => p("M130 120 Q200 80 270 120 L300 300 Q200 340 100 300Z", C.orange, 7) + p("M130 120 Q200 150 270 120 Q200 80 130 120Z", C.cream, 6) + line("M138 128 Q200 160 262 128", 6, C.ink) + rope("M120 250 Q200 280 280 250", C.navy, 12) + circle(200, 215, 30, C.cream, 5) + `<text x="200" y="226" text-anchor="middle" font-family="Georgia,serif" font-size="30" font-weight="700" fill="${C.red}">C</text>` + line("M270 120 Q330 100 340 60", 7),
  pad: () => p("M80 120 H320 V300 H80Z", C.navy, 7) + p("M80 210 H320 V300 H80Z", C.blue, 7) + line("M200 120 V300", 5, C.cream, 'stroke-dasharray="3 12"') + rope("M110 120 V70 H290 V120", C.orange, 12) + circle(200, 210, 38, C.cream, 6) + `<text x="200" y="224" text-anchor="middle" font-family="Georgia,serif" font-size="40" font-weight="700" fill="${C.red}">C</text>`,
  jacket: (col) => p("M135 100 Q200 130 265 100 L330 150 L300 290 L270 280 L270 330 H130 V280 L100 290 L70 150Z", col, 7) + line("M200 125 V330", 7, C.cream) + p("M135 100 Q200 150 265 100 L255 84 Q200 110 145 84Z", C.navy, 6) + [[140, 210], [260, 210]].map(([x, y]) => line(`M${x} ${y} h30`, 8, C.cream)).join("") + line("M96 270 L130 262 M304 270 L270 262", 8, C.navy),
};

const pick = {
  "ROPE-60": art.rope(C.orange, C.cream), "ROPE-DRY": art.rope(C.blue, C.cream), "STATIC-10": art.static(), "WEB-TUBE": art.webbing(),
  AUTOBLOCK: art.autoblock(), "TUBE-BELAY": art.tube(), "CARAB-HMS": art.hms(), "CARAB-WIRE": art.wire(),
  "QUICKDRAW-6": art.draw(6), "QUICKDRAW-12": art.draw(12), "ALPINE-RACK": art.cam(), "NUT-SET": art.nuts(),
  "TALON-MID": art.shoe("approach", C.green), "EDGE-LV": art.shoe("lace", C.blue), "PIVOT-SLIP": art.shoe("slipper", C.orange), "CRACK-TRAD": art.shoe("trad", C.navy),
  "VERTEX-LT": art.harness(C.navy, "M"), "GYM-CINDER": art.harness(C.blue, "S"), "SUMMIT-ALP": art.harness(C.green, "L"), "WALL-HAUL": art.harness(C.orange, "XL"),
  "HELMET-CX": art.helmet(C.red), "CHALK-BAG": art.chalk(), "BOULDER-PRO": art.pad(), "BELAY-JKT": art.jacket(C.orange),
};
// harness art should not carry a size letter on the product page; strip the label text
for (const k of ["VERTEX-LT", "GYM-CINDER", "SUMMIT-ALP", "WALL-HAUL"]) pick[k] = pick[k].replace(/<text[^>]*>[^<]*<\/text>/, "");

const topo = (id) => `<defs><pattern id="${id}" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M0 40 Q20 10 40 40 T80 40 M0 70 Q20 40 40 70 T80 70 M0 10 Q20 -20 40 10 T80 10" fill="none" stroke="#1f2f55" stroke-opacity=".09" stroke-width="2"/></pattern></defs>`;
mkdirSync(join(root, "assets/products"), { recursive: true });
for (const prod of catalog.products) {
  const body = pick[prod.sku];
  if (!body) throw new Error("no art for " + prod.sku);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${prod.name}">${topo("t")}<rect width="400" height="400" fill="${PANEL[prod.category]}"/><rect width="400" height="400" fill="url(#t)"/><g>${body}</g></svg>\n`;
  writeFileSync(join(root, "assets/products", prod.sku + ".svg"), svg);
}

// Hero: layered peaks, sun and a rope line, in the same palette
const hero = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mountain ridge with a climbing rope">
<rect width="1200" height="520" fill="#cfe5f5"/>${topo("h")}<rect width="1200" height="520" fill="url(#h)"/>
<circle cx="930" cy="140" r="64" fill="#f6eddc" stroke="${C.ink}" stroke-width="6"/>
<path d="M0 420 L180 250 L280 330 L430 160 L610 360 L760 230 L960 400 L1100 300 L1200 380 V520 H0Z" fill="${C.blue}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
<path d="M0 470 L150 330 L260 400 L430 260 L600 430 L800 300 L1000 450 L1200 340 V520 H0Z" fill="${C.navy}" stroke="${C.ink}" stroke-width="6" stroke-linejoin="round"/>
<path d="M0 520 V490 Q200 440 360 480 T700 470 T1200 480 V520Z" fill="${C.green}" stroke="${C.ink}" stroke-width="6"/>
<path d="M430 160 L395 205 L430 195 L465 215Z" fill="#fffaf0" stroke="${C.ink}" stroke-width="5" stroke-linejoin="round"/>
<path d="M430 160 C470 230 380 260 430 330 S520 400 470 470" fill="none" stroke="${C.ink}" stroke-width="16" stroke-linecap="round"/><path d="M430 160 C470 230 380 260 430 330 S520 400 470 470" fill="none" stroke="${C.orange}" stroke-width="9" stroke-linecap="round"/>
</svg>\n`;
mkdirSync(join(root, "assets/brand"), { recursive: true });
writeFileSync(join(root, "assets/brand/hero.svg"), hero);

const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Crux Outdoor Co."><circle cx="32" cy="32" r="28" fill="${C.cream}" stroke="${C.ink}" stroke-width="4"/><path d="M44 20 A17 17 0 1 0 44 44" fill="none" stroke="${C.ink}" stroke-width="12" stroke-linecap="round"/><path d="M44 20 A17 17 0 1 0 44 44" fill="none" stroke="${C.orange}" stroke-width="7" stroke-linecap="round"/><path d="M24 40 L32 24 L36 32 L40 27 L46 40Z" fill="${C.navy}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/></svg>\n`;
writeFileSync(join(root, "assets/brand/logo.svg"), logo);
console.log(`wrote ${catalog.products.length} product SVGs, hero.svg, logo.svg`);
