import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/exchange-rates", (route) =>
    route.fulfill({
      json: {
        base: "USD",
        rates: { USD: 1, EUR: 0.9, AUD: 1.5 },
        source: "Frankfurter",
        status: "current",
        rateDate: new Date().toISOString().slice(0, 10),
        checkedAt: new Date().toISOString(),
      },
    }),
  );
});
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
    .selectOption("AUD");
  await expect(
    page.getByRole("combobox", { name: "Currency", exact: true }),
  ).toHaveValue("AUD");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Currency", exact: true }),
  ).toHaveValue("AUD");
});
test("a previously saved INR preference falls back to USD", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "roamly-cart-v2",
      JSON.stringify({ state: { currency: "INR", items: [] }, version: 0 }),
    ),
  );
  await page.goto("/");
  await expect(
    page.getByRole("combobox", { name: "Currency", exact: true }),
  ).toHaveValue("USD");
  await expect(page.locator('option[value="INR"]')).toHaveCount(0);
});
test("guided phone checks explain both compatibility and carrier unlock status", async ({
  page,
}) => {
  await page.goto("/compatibility");
  await page.getByRole("textbox", { name: "Search devices" }).fill("iPhone13");
  await expect(page.locator(".device-card")).toHaveCount(1);
  await expect(page.locator(".device-card")).toContainText("iPhone");
  await page
    .getByLabel("Phone you will install the eSIM on")
    .fill("iPhone 13 Pro");
  const esim = page.getByRole("group", {
    name: "Can you see Add eSIM in your phone settings?",
  });
  const unlocked = page.getByRole("group", {
    name: "Have you confirmed your phone is carrier unlocked?",
  });
  await esim.getByRole("radio", { name: "Yes", exact: true }).check();
  await unlocked.getByRole("radio", { name: "No", exact: true }).check();
  await expect(page.locator(".compat-result")).toContainText(
    "Your carrier needs to unlock your phone first.",
  );
  await unlocked.getByRole("radio", { name: "Yes", exact: true }).check();
  await expect(page.locator(".compat-result")).toContainText(
    "Your checks look ready.",
  );
  await expect(
    page
      .locator(".compat-result")
      .getByRole("link", { name: "Explore eSIM plans" }),
  ).toHaveAttribute("href", "/destinations");
  await expect(
    page.getByText("This website cannot scan your phone", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search devices" })
    .fill("unknown model 999");
  await expect(page.locator(".device-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search and filters" }).click();
  await expect(page.locator(".device-card")).toHaveCount(7);
});

test("device selection survives reload and checkout, and changing phones clears confirmations", async ({
  page,
}) => {
  // Browser-only fixture: no inventory is added to the running store or database.
  await page.addInitScript(() =>
    localStorage.setItem(
      "roamly-cart-v2",
      JSON.stringify({
        state: {
          currency: "USD",
          items: [
            {
              id: "browser-fixture-plan",
              name: "Browser fixture",
              destinationName: "Japan",
              destinationSlug: "japan",
              dataLabel: "1 GB",
              validityDays: 7,
              retailPrice: 500,
              flagEmoji: "JP",
            },
          ],
        },
        version: 0,
      }),
    ),
  );
  await page.goto("/compatibility?returnTo=checkout");
  const esim = page.getByRole("group", {
    name: "Can you see Add eSIM in your phone settings?",
  });
  const unlocked = page.getByRole("group", {
    name: "Have you confirmed your phone is carrier unlocked?",
  });
  await expect(
    esim.getByRole("radio", { name: "Yes", exact: true }),
  ).toBeDisabled();
  await page.getByRole("textbox", { name: "Search devices" }).fill("Pixel");
  await page.getByRole("button", { name: /Check this model/ }).click();
  await expect(
    page.getByLabel("Phone you will install the eSIM on"),
  ).toHaveValue(/Pixel/);
  await page
    .getByLabel("Phone you will install the eSIM on")
    .fill("Google Pixel 8");
  await esim.getByRole("radio", { name: "Yes", exact: true }).check();
  await unlocked.getByRole("radio", { name: "Yes", exact: true }).check();
  await page.reload();
  await expect(page.locator(".compat-result")).toContainText(
    "Your checks look ready.",
  );
  await page
    .getByRole("link", { name: "Return to checkout", exact: true })
    .click();
  await expect(page.locator(".checkout-device-check")).toContainText(
    "Google Pixel 8",
  );
  await expect(page.locator(".checkout-device-check")).toContainText(
    "Device checks confirmed",
  );
  await page.getByRole("link", { name: "Review or change device" }).click();
  await page
    .getByLabel("Phone you will install the eSIM on")
    .fill("Another phone");
  await expect(
    esim.getByRole("radio", { name: "Yes", exact: true }),
  ).not.toBeChecked();
  await expect(
    unlocked.getByRole("radio", { name: "Yes", exact: true }),
  ).not.toBeChecked();
  await esim.getByRole("radio", { name: "No", exact: true }).check();
  await page.goto("/checkout");
  await expect(page.locator(".checkout-device-check")).toContainText(
    "compatibility issue",
  );
  await expect(
    page.getByRole("button", { name: "Continue to secure payment" }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("account sign-in explains recovery without showing implementation instructions", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Your travels. All in one place." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "Add your Supabase environment variables",
  );
  await expect(page.locator("body")).toContainText("including guest purchases");
  await expect(
    page.getByRole("button", { name: "Send my sign-in link" }),
  ).toBeDisabled();
});
test("three currencies, readable mobile text and branded payment methods", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const selector = page.getByRole("combobox", {
    name: "Currency",
    exact: true,
  });
  await expect(selector.locator('option[value="INR"]')).toHaveCount(0);
  for (const currency of ["USD", "EUR", "AUD"]) {
    await expect(selector.locator(`option[value="${currency}"]`)).toBeEnabled();
    await selector.selectOption(currency);
    await expect(selector).toHaveValue(currency);
  }
  await page.reload();
  await expect(selector).toHaveValue("AUD");
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("img", { name: "Visa", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Mastercard", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".currency-rate-note")).toContainText(
    "Reference rates",
  );
  const tinyText = await page
    .locator("p,button,select,label,summary")
    .evaluateAll((elements) =>
      elements
        .filter(
          (element) =>
            element.getClientRects().length &&
            parseFloat(getComputedStyle(element).fontSize) < 14,
        )
        .map((element) => element.className),
    );
  expect(tinyText).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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
test("public payment wording is neutral and hosted forms use the approved gateway origins", async ({
  page,
}) => {
  for (const path of ["/", "/checkout", "/how-it-works", "/legal/privacy"]) {
    const response = await page.goto(path);
    await expect(page.locator("body")).not.toContainText("Stripe");
    await expect(page.locator("footer")).toContainText(
      "Secure, encrypted checkout",
    );
    const policy = response!.headers()["content-security-policy"];
    expect(policy).toContain(
      "form-action 'self' https://sandbox.transactworld.com https://secure.transactworld.com;",
    );
  }
});
test("removed gateway preview stays unavailable and checkout has no preview link", async ({
  page,
  request,
}) => {
  await page.goto("/checkout");
  await expect(page.locator("body")).not.toContainText(
    "Testing the gateway before launch",
  );
  await expect(
    page.getByRole("link", { name: /sandbox gateway preview/i }),
  ).toHaveCount(0);
  expect((await page.goto("/checkout/gateway-preview"))?.status()).toBe(404);
  expect(
    (
      await request.post("/api/payments/transactworld/preview", {
        data: { email: "preview@example.invalid", currency: "USD" },
      })
    ).status(),
  ).toBe(404);
});
