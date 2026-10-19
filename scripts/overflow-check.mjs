import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
await page.goto(process.argv[2], { waitUntil: "load" });
const r = await page.evaluate(() => [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 8).map(e => `${e.tagName}.${String(e.className).slice(0,80)} right=${Math.round(e.getBoundingClientRect().right)}`));
console.log(r.join("\n"));
await browser.close();
