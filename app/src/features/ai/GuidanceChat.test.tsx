import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GuidanceChat } from "./GuidanceChat";

vi.mock("../../lib/i18n/LocalizationProvider", () => ({ useT: () => ({ t: (key: string) => key, language: "en-US" }), tx: (key: string) => key }));
vi.mock("../profile/useCurrentUser", () => ({ useCurrentUser: () => ({ data: undefined }) }));
vi.mock("./RobotMascot", () => ({ default: () => <span>Robot</span> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("requests AI by default without sending the typed question and preserves minimized messages", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ mode: "ai" }) })
    .mockResolvedValue({ ok: true, json: async () => ({ text: "Account guidance", source: "ai" }) });
  vi.stubGlobal("fetch", fetcher);
  render(<GuidanceChat />);
  fireEvent.click(screen.getByRole("button", { name: "help.title" }));
  expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("false");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "my login question" } });
  fireEvent.click(screen.getByRole("button", { name: "help.send" }));
  await screen.findByText("Account guidance");
  expect(JSON.parse(fetcher.mock.calls[1]![1]!.body)).toEqual({ topic: "account", language: "en-US", useAi: true });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "help.title" }));
  expect(screen.getByText("Account guidance")).toBeTruthy();
});

it("shows reviewed fallback and a visible failure notice when the server fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<GuidanceChat />);
  fireEvent.click(screen.getByRole("button", { name: "help.title" }));
  fireEvent.click(screen.getByRole("button", { name: "help.topic.billing" }));
  await screen.findByText("help.unavailable");
  expect(screen.getByText(/Ask the front desk to record/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "help.clear" }));
  await waitFor(() => expect(screen.queryByText("help.unavailable")).toBeNull());
});
