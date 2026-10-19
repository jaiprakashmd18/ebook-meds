import { expect, test, type Page } from "@playwright/test";

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("public site (demo mode)", () => {
  test("homepage explains the product and shows a real note excerpt", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Big concepts. Simple explanations." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore Study Notes" })).toBeVisible();
    await expect(page.getByText("Real excerpt from a free note")).toBeVisible();
    await expect(page.getByText(/Demo mode/)).toBeVisible();
    // No fabricated ratings when there are no reviews.
    await expect(page.locator("[aria-label^='Rated']")).toHaveCount(0);
    await noHorizontalOverflow(page);
  });

  test("explore filters to free notes", async ({ page }) => {
    await page.goto("/explore?price=free");
    await expect(page.getByRole("heading", { level: 1, name: "Free study notes" })).toBeVisible();
    const cards = page.locator("main a[href^='/notes/']");
    await expect(cards.first()).toBeVisible();
    for (const text of await cards.allInnerTexts()) expect(text).toContain("Free");
    await noHorizontalOverflow(page);
  });

  test("search finds notes by tag and shows an empty state", async ({ page }) => {
    await page.goto("/search?q=nernst");
    await expect(page.getByText("1 result")).toBeVisible();
    await expect(page.getByRole("link", { name: /Resting Membrane Potential/ }).first()).toBeVisible();
    await page.goto("/search?q=qqqzzz");
    await expect(page.getByRole("heading", { name: "No results" })).toBeVisible();
  });

  test("subject page lists a learning path", async ({ page }) => {
    await page.goto("/subjects/histology");
    await expect(page.getByRole("heading", { level: 1, name: "Histology" })).toBeVisible();
    await expect(page.getByText("Beginner-friendly learning path")).toBeVisible();
  });

  test("paid product page offers a preview and is honest about unavailable checkout", async ({ page }) => {
    await page.goto("/notes/glycolysis-step-by-step");
    await expect(page.getByRole("heading", { level: 1, name: "Glycolysis: Step by Step" })).toBeVisible();
    await expect(page.getByText("₹149").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Purchases unavailable/ })).toBeDisabled();
    await expect(page.getByText(/not yet been independently reviewed/)).toBeVisible();
    await page.getByRole("link", { name: /Read free preview/ }).click();
    await expect(page).toHaveURL(/\/preview\/glycolysis-step-by-step/);
  });

  test("preview never contains locked sections", async ({ page }) => {
    await page.goto("/preview/glycolysis-step-by-step");
    await expect(page.getByRole("heading", { name: "Unlock the full notes" })).toBeVisible();
    const body = await page.locator("main").innerText();
    expect(body).not.toContain("Phosphoglycerate kinase");
    expect(body).not.toContain("Answer key");
  });

  test("structured data and canonical URL on product pages", async ({ page }) => {
    await page.goto("/notes/epithelial-tissue-classification");
    const ld = JSON.parse((await page.locator("script[type='application/ld+json']").textContent()) ?? "{}");
    expect(ld["@type"]).toBe("Book");
    expect(ld.aggregateRating).toBeUndefined();
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", /\/notes\/epithelial-tissue-classification$/);
  });

  test("robots and sitemap are served", async ({ request }) => {
    expect((await request.get("/robots.txt")).status()).toBe(200);
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("/notes/glycolysis-step-by-step");
  });
});

test.describe("reader", () => {
  test("free notes open without an account, with navigation, themes and search", async ({ page }) => {
    await page.goto("/reader/epithelial-tissue-classification");
    await expect(page.getByRole("heading", { level: 2, name: "What makes a tissue epithelial?" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("heading", { level: 2, name: "Classification from first principles" })).toBeVisible();
    // Desktop shows swatches, mobile shows labelled pills; click whichever is visible.
    await page.getByRole("radio", { name: /^Dark/ }).filter({ visible: true }).first().click();
    await expect(page.locator("[data-reader-theme='dark']")).toHaveCount(1);
    await page.keyboard.press("/");
    await page.getByLabel("Search text").fill("transitional");
    await expect(page.getByText(/match/).first()).toBeVisible();
    await page.getByRole("complementary", { name: "Search in document" }).getByRole("button", { name: /Types and where to find them/ }).first().click();
    await expect(page.getByRole("heading", { level: 2, name: "Types and where to find them" })).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test("paid notes show only the preview and a paywall in the reader", async ({ page }) => {
    await page.goto("/reader/glycolysis-step-by-step");
    await expect(page.getByText("Free preview").first()).toBeVisible();
    // Locked chapters are listed by title only.
    await expect(page.locator("nav[aria-label='Table of contents']")).toContainText("The ten steps");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("heading", { name: "Unlock the full notes" })).toBeVisible();
  });
});

test.describe("access control", () => {
  for (const path of ["/dashboard", "/library", "/orders", "/account", "/admin", "/admin/content", "/checkout/glycolysis-step-by-step"]) {
    test(`redirects ${path} to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/auth\/login\?next=/);
    });
  }

  test("PDF downloads are refused without configuration or access", async ({ request }) => {
    const res = await request.get("/api/downloads/glycolysis-step-by-step", { maxRedirects: 0 });
    expect([401, 403, 404, 503]).toContain(res.status());
  });

  test("webhooks reject unsigned requests", async ({ request }) => {
    for (const provider of ["stripe", "razorpay", "dev"]) {
      const res = await request.post(`/api/webhooks/${provider}`, { data: { type: "checkout.session.completed" } });
      expect(res.status(), provider).toBeGreaterThanOrEqual(400);
    }
  });

  test("auth forms explain demo mode instead of pretending to work", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByText("Accounts are disabled in demo mode")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });
});
