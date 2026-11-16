import { test, expect } from "@playwright/test";
test("search and device filtering without fabricated inventory", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Go somewhere. Stay connected." }),
  ).toBeVisible();
  const search = page.getByRole("combobox", { name: "Search destinations" });
  await search.fill("Japan");
  await page
    .locator("#destination-results")
    .getByRole("link", { name: /Japan/ })
    .click();
  await expect(page).toHaveURL(/esim\/japan/);
  await expect(
    page.getByText(
      "No active plans for this destination yet. Please check back soon.",
    ),
  ).toBeVisible();
  await expect(page.locator(".plan-card")).toHaveCount(0);
  await page.goto("/checkout");
  await expect(
    page.getByRole("heading", { name: "Your next adventure starts here." }),
  ).toBeVisible();
  await page.goto("/compatibility");
  await page.getByRole("textbox", { name: "Search devices" }).fill("Pixel");
  await expect(page.locator(".device-card")).toHaveCount(1);
  await expect(page.locator(".device-card")).toContainText("Google");
  expect(errors).toEqual([]);
});
test("destination filters and currency work", async ({ page }) => {
  await page.goto("/destinations");
  await expect(page.locator(".destination-card")).toHaveCount(10);
  await page.getByRole("button", { name: "Regional", exact: true }).click();
  await expect(page.locator(".destination-card")).toHaveCount(1);
  await expect(page.locator(".destination-card")).toContainText(
    "Europe Regional",
  );
  await page
    .getByRole("combobox", { name: "Currency", exact: true })
    .selectOption("INR");
  await expect(
    page.getByRole("combobox", { name: "Currency", exact: true }),
  ).toHaveValue("INR");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Currency", exact: true }),
  ).toHaveValue("INR");
});
test("private routes redirect without exposing data", async ({
  page,
  request,
}) => {
  for (const route of ["/admin/plans", "/admin/customers", "/account/orders"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/login/);
    await expect(page.locator("body")).not.toContainText(
      "Supplier costs are private",
    );
  }
  const response = await request.get("/api/esim/plans");
  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).not.toMatch(
    /wholesalePrice|supplierPlanId|ESIM_PROVIDER_API_KEY/,
  );
});
test("mobile menu and layout never advertise a missing plan", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Destinations", exact: true })
    .click();
  await expect(page).toHaveURL(/destinations/);
  for (const route of [
    "/",
    "/destinations",
    "/esim/thailand",
    "/checkout",
    "/compatibility",
    "/faq",
  ]) {
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/esim/thailand");
  await expect(page.locator(".mobile-buy")).toHaveCount(0);
});
test("original travel imagery loads on desktop and mobile", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.locator("img").evaluateAll(async (images) => {
      await Promise.all(
        images.map(async (img) => {
          const image = img as HTMLImageElement;
          image.loading = "eager";
          await image.decode();
        }),
      );
    });
    await expect(page.locator(".hero-photo img")).toBeVisible();
    expect(
      await page
        .locator(".hero-photo img")
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/home-${width}.png`,
      fullPage: true,
    });
  }
});
