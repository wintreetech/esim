import { describe, it, expect } from "vitest";
import { z } from "zod";
import { jsonBody, sameOrigin } from "@/lib/http";
describe("sensitive request boundaries", () => {
  it("limits streamed bodies even without a Content-Length header", async () => {
    await expect(
      jsonBody(
        new Request("http://localhost:3000/api/checkout", {
          method: "POST",
          body: JSON.stringify({ data: "x".repeat(17000) }),
        }),
        z.object({ data: z.string() }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects cross-origin mutations", () => {
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3000/api/checkout", {
          headers: { origin: "https://somewhere-else.example" },
        }),
      ),
    ).toThrow("not allowed");
  });
});
