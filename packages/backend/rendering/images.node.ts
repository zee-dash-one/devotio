"use node";
import { create } from "fontkit";
import { renderAsync } from "@resvg/resvg-js";
import { fontBase64 } from "./font.data";
import { backgroundSvg, backgrounds } from "./backgrounds.node";
import { imageContentSchema, imageSizes, imageStyles, IMAGE_MAX_PAGES, IMAGE_PUBLIC_URL, type ImageContent } from "../../domain/devotional-images";
const font = create(Buffer.from(fontBase64, "base64"));
if (!("layout" in font)) throw new Error("Expected a single font");
const face = font;
function width(text: string, size: number) { return face.layout(text).positions.reduce((sum, p) => sum + p.xAdvance, 0) * size / face.unitsPerEm; }
function wrap(text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (width(line ? line + " " + word : word, size) <= maxWidth) { line += (line ? " " : "") + word; continue; }
      if (line) { lines.push(line); line = ""; }
      // Split unusually long words by grapheme, preserving every character.
      for (const { segment } of new Intl.Segmenter("pt", { granularity: "grapheme" }).segment(word)) {
        if (line && width(line + segment, size) > maxWidth) { lines.push(line); line = ""; }
        line += segment;
      }
    }
    lines.push(line);
  }
  return lines;
}
function textSvg(text: string, size: number, x: number, y: number, fill: string): string {
  const run = face.layout(text), scale = size / face.unitsPerEm;
  let cursor = x;
  return run.glyphs.map((glyph, i) => {
    if (!glyph.id && text.trim()) throw new Error("A fonte da arte não cobre um caractere do texto. Revise o conteúdo ou a fonte.");
    const pos = run.positions[i];
    const path = '<path fill="'+fill+'" transform="translate('+(cursor+pos.xOffset*scale)+' '+(y-pos.yOffset*scale)+') scale('+scale+' '+(-scale)+')" d="'+glyph.path.toSVG()+'"/>';
    cursor += pos.xAdvance * scale; return path;
  }).join("");
}
export interface RenderedPage { variant: string; page: number; pages: number; width: number; height: number; png: Uint8Array }
export async function* renderImages(input: ImageContent): AsyncGenerator<RenderedPage> {
  const content = imageContentSchema.parse(input);
  for (const size of imageSizes) {
    const reference = wrap(content.reference, 42, 900);
    const top = 185 + reference.length * 54;
    const linesPerPage = Math.floor((size.height - top - 150) / 55);
    if (linesPerPage < 4) throw new Error("A referência é longa demais para a arte.");
    const lines = ["MEDITAR", ...wrap(content.reflection, 38, 900), "", "ORAÇÃO", ...wrap(content.prayerSuggestion, 38, 900)];
    const pages: string[][] = [];
    for (let offset = 0; offset < lines.length;) {
      while (lines[offset] === "") offset++;
      let end = Math.min(offset + linesPerPage, lines.length);
      if (end < lines.length && ["MEDITAR", "ORAÇÃO"].includes(lines[end-1])) end--;
      const pageLines = lines.slice(offset, end);
      while (pageLines.at(-1) === "") pageLines.pop();
      if (pageLines.length) pages.push(pageLines);
      offset = end;
    }
    const total = pages.length;
    if (total > IMAGE_MAX_PAGES) throw new Error("O texto excede dez páginas por formato. Revise o conteúdo editorial.");
    for (const style of imageStyles) for (let page = 0; page < total; page++) {
      const c = backgrounds[style.id];
      let svg = backgroundSvg(style.id, size.width, size.height);
      svg += textSvg("DEVOTIO", 28, 90, 105, c.foreground);
      svg += textSvg(content.date.split("-").reverse().join("/"), 28, 700, 105, c.foreground);
      reference.forEach((line, i) => { svg += textSvg(line, 42, 90, 175 + i * 54, c.foreground); });
      pages[page].forEach((line, i) => { svg += textSvg(line, 38, 90, top + 40 + i * 55, c.foreground); });
      svg += textSvg(IMAGE_PUBLIC_URL, 22, 90, size.height - 80, c.foreground);
      svg += textSvg((page + 1) + " / " + total, 24, 875, size.height - 80, c.foreground);
      const renderer = await renderAsync('<svg xmlns="http://www.w3.org/2000/svg" width="'+size.width+'" height="'+size.height+'">'+svg+'</svg>', { font: { loadSystemFonts: false } });
      const png = renderer.asPng();
      yield { variant: size.id + "-" + style.id, page: page + 1, pages: total, width: size.width, height: size.height, png };
    }
  }
}
