import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Block any accidental network calls. Tests should mock blocksClient and
// anything else that would touch the cloud.
if (typeof globalThis.fetch === "undefined") {
  globalThis.fetch = vi.fn(async () => new Response("", { status: 200 })) as unknown as typeof fetch;
}
