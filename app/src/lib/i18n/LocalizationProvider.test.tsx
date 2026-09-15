import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const { translations } = vi.hoisted(() => ({ translations: vi.fn(async (_module: string, _language: string): Promise<Record<string, string>> => ({})) }));
vi.mock("../blocks/client", () => ({ blocksClient: { localization: { languages: async () => [], translations } } }));
import { LocalizationProvider, useT } from "./LocalizationProvider";
import { defaultDictionary } from "./dictionary";
import { bengaliDictionary } from "./locales";
function Screen() {
  const { t, setLanguage } = useT();
  return <><h1>{t("profile.personal")}</h1><h2>{t("app.name")}</h2><button onClick={() => setLanguage("bn-BD")}>Bangla</button><button onClick={() => setLanguage("de-DE")}>German</button><button onClick={() => setLanguage("en-US")}>English</button></>;
}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); translations.mockResolvedValue({}); });
it("localizes the brand and browser title even with an older Blocks dictionary", async () => {
  translations.mockResolvedValue({ "app.name": "ChikitsaFollow" });
  render(<QueryClientProvider client={new QueryClient()}><LocalizationProvider><Screen /></LocalizationProvider></QueryClientProvider>);
  for (const [button, name] of [["Bangla", "চিকিৎসা ফলো"], ["German", "Chikitsa Nachsorge"], ["English", "Chikitsa Follow"]]) {
    await userEvent.click(screen.getByRole("button", { name: button }));
    expect(await screen.findByRole("heading", { name })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe(name));
  }
});
it("has Bangla translations for every default key with matching placeholders", () => {
  for (const [key, value] of Object.entries(defaultDictionary)) {
    const bn = bengaliDictionary[key as keyof typeof defaultDictionary];
    expect(bn, key).toBeTruthy();
    expect(bn?.match(/\{\w+\}/g) ?? [], key).toEqual(value.match(/\{\w+\}/g) ?? []);
  }
});
it("switches instantly offline, persists the culture, and loads Blocks dictionaries with correct argument order", async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LocalizationProvider><Screen /></LocalizationProvider></QueryClientProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Bangla" }));
  expect(await screen.findByRole("heading", { name: "ব্যক্তিগত তথ্য" })).toBeInTheDocument();
  expect(localStorage.getItem("blocks-app:language")).toBe("bn-BD");
  expect(document.documentElement.lang).toBe("bn-BD");
  await waitFor(() => expect(translations).toHaveBeenCalledWith("common", "bn-BD"));
});
