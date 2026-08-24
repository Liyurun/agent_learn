#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "agent-learning-handbook.html");
const OUTPUT = path.join(ROOT, "Agent学习与面试宝典.pdf");
const TEMP = path.join(ROOT, `.handbook-${process.pid}.pdf`);
const MIN_PDF_PAGES = Number.parseInt(process.env.PDF_MIN_PAGES || "250", 10);
const DYNAMIC_TIMEOUT_MS = Number.parseInt(process.env.PDF_RENDER_TIMEOUT_MS || "120000", 10);

function executable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return file;
  } catch (_) {
    return null;
  }
}

function findCachedChrome() {
  const bases = [
    process.env.PUPPETEER_CACHE_DIR,
    path.join(os.homedir(), ".cache", "puppeteer"),
  ].filter(Boolean);
  const names = new Set(["chrome", "chromium", "chrome.exe"]);
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    const queue = [base];
    while (queue.length) {
      const current = queue.shift();
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch (_) {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isFile() && names.has(entry.name) && executable(full)) return full;
        if (entry.isDirectory() && queue.length < 200) queue.push(full);
      }
    }
  }
  return null;
}

function findChrome(puppeteer) {
  if (process.env.CHROME_PATH) {
    const configured = executable(process.env.CHROME_PATH);
    if (!configured) throw new Error(`CHROME_PATH 不可执行: ${process.env.CHROME_PATH}`);
    return configured;
  }
  if (puppeteer && typeof puppeteer.executablePath === "function") {
    try {
      const bundled = executable(puppeteer.executablePath());
      if (bundled) return bundled;
    } catch (_) {}
  }
  const cached = findCachedChrome();
  if (cached) return cached;
  for (const command of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    const result = spawnSync("which", [command], { encoding: "utf8" });
    if (result.status === 0) {
      const found = executable(result.stdout.trim());
      if (found) return found;
    }
  }
  throw new Error(
    "未找到 Chromium。请设置 CHROME_PATH，或运行 npm install 让 Puppeteer 使用缓存浏览器。"
  );
}

function countPdfPages(pdf) {
  const matches = Buffer.from(pdf).toString("latin1").match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}

function assertPageCount(pdf, minimum = MIN_PDF_PAGES) {
  const pages = countPdfPages(pdf);
  if (!Number.isInteger(minimum) || minimum < 1) {
    throw new Error(`PDF_MIN_PAGES 必须是正整数: ${minimum}`);
  }
  if (pages < minimum) {
    throw new Error(`生成的 PDF 页数异常: ${pages} 页，要求至少 ${minimum} 页`);
  }
  return pages;
}

async function waitForDynamicContent(page) {
  await page.waitForFunction(
    () => {
      const mermaidReady = [...document.querySelectorAll("pre.mermaid")].every(
        (node) => node.dataset.processed === "true" || Boolean(node.querySelector("svg"))
      );
      const chartsReady = ["chart-stars", "chart-position"].every((id) => {
        const node = document.getElementById(id);
        return !node || Boolean(node.querySelector("svg,canvas"));
      });
      const panelsReady = [
        ...document.querySelectorAll(".interactive[id],.interactive-mini[id]"),
      ].every((node) => node.childElementCount > 0 || node.textContent.trim().length > 0);
      return mermaidReady && chartsReady && panelsReady;
    },
    { timeout: DYNAMIC_TIMEOUT_MS, polling: 100 }
  );
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
  });
}

async function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`HTML 不存在: ${INPUT}`);
  let puppeteer;
  try {
    puppeteer = require("puppeteer-core");
  } catch (_) {
    try {
      puppeteer = require("puppeteer");
    } catch (_) {
      throw new Error("缺少 Puppeteer；请先运行 npm install");
    }
  }
  const executablePath = findChrome(puppeteer);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(INPUT).href, { waitUntil: "networkidle0", timeout: 120000 });
    await waitForDynamicContent(page);
    await page.evaluate(async () => {
      document.documentElement.dataset.theme = "paper";
      const themeMenu = document.getElementById("themeMenu");
      const themeButton = document.getElementById("themeToggle");
      if (themeMenu) themeMenu.hidden = true;
      if (themeButton) themeButton.setAttribute("aria-expanded", "false");
      if (window.__ah_recolorCharts) window.__ah_recolorCharts(false);
      document.querySelectorAll("details").forEach((node) => { node.open = true; });
      document.querySelectorAll(".quiz-exp").forEach((node) => {
        node.classList.add("show");
        node.style.display = "block";
      });
      document.querySelectorAll(
        ".nav-dropdown,.chapter-outline,.mobile-book-nav,.mobile-outline"
      ).forEach((node) => node.remove());
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      document.querySelectorAll(
        ".topnav,.progress-bar,.to-top,.copy-btn,.mobile-book-toggle,.outline-toggle"
      ).forEach((node) => node.remove());
    });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "14mm", right: "12mm", bottom: "16mm", left: "12mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:8px;color:#777;width:100%;text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
    const size = pdf.byteLength;
    if (size < 1024) throw new Error(`生成的 PDF 异常小: ${size} bytes`);
    const pages = assertPageCount(pdf);
    fs.writeFileSync(TEMP, pdf);
    fs.renameSync(TEMP, OUTPUT);
    console.log(`[PASS] 已导出 ${OUTPUT}（${pages} 页，${size.toLocaleString()} bytes）`);
  } finally {
    await browser.close();
    if (fs.existsSync(TEMP)) fs.unlinkSync(TEMP);
  }
}

if (require.main === module) {
  main().catch((error) => {
    if (fs.existsSync(TEMP)) fs.unlinkSync(TEMP);
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
  });
}

module.exports = { assertPageCount, countPdfPages, findChrome, waitForDynamicContent };
