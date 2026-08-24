"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { assertPageCount, countPdfPages } = require("../tools/export_pdf");

function fakePdf(pageCount) {
  return Buffer.from(
    ["%PDF-1.7", "/Type /Pages"]
      .concat(Array.from({ length: pageCount }, () => "/Type /Page"))
      .join("\n"),
    "latin1"
  );
}

test("countPdfPages counts page objects but not the page tree", () => {
  assert.equal(countPdfPages(fakePdf(3)), 3);
});

test("assertPageCount returns the detected page count", () => {
  assert.equal(assertPageCount(fakePdf(5), 5), 5);
});

test("assertPageCount rejects truncated output", () => {
  assert.throws(
    () => assertPageCount(fakePdf(2), 3),
    /2 页，要求至少 3 页/
  );
});

test("assertPageCount rejects an invalid minimum", () => {
  assert.throws(() => assertPageCount(fakePdf(2), 0), /必须是正整数/);
});

test("PDF preprocessing forces paper theme and recolors charts", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "tools", "export_pdf.js"),
    "utf8"
  );
  assert.match(source, /document\.documentElement\.dataset\.theme = "paper"/);
  assert.match(source, /themeMenu\.hidden = true/);
  assert.match(source, /themeButton\.setAttribute\("aria-expanded", "false"\)/);
  assert.match(source, /window\.__ah_recolorCharts\(false\)/);
});

test("PDF preprocessing removes all auxiliary navigation", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "tools", "export_pdf.js"),
    "utf8"
  );
  for (const selector of [
    ".nav-dropdown",
    ".chapter-outline",
    ".mobile-book-nav",
    ".mobile-outline",
  ]) {
    assert.ok(source.includes(selector), `missing PDF cleanup selector ${selector}`);
  }
});
