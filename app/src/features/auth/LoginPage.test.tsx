import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultDictionary } from "../../lib/i18n/dictionary";
import { LoginPage } from "./LoginPage";

const { login, configured } = vi.hoisted(() => ({ login: vi.fn(), configured: vi.fn(() => true) }));
vi.mock("../../app/providers/AuthProvider", () => ({ useAuth: () => ({ login }) }));
vi.mock("../../lib/blocks/config", () => ({ isLoginConfigured: configured }));
vi.mock("../../lib/i18n/LocalizationProvider", () => ({ useT: () => ({ language: "en-US", languages: [], setLanguage: vi.fn(), t: (key: keyof typeof defaultDictionary) => defaultDictionary[key] }) }));
vi.mock("./LoginScene", () => ({ default: () => <div data-testid="scene" /> }));

beforeEach(() => { vi.clearAllMocks(); configured.mockReturnValue(true); });

describe("Login entry", () => {
  it("preserves the destination and disables actions while redirecting", async () => {
    login.mockReturnValue(new Promise(() => undefined));
    render(<LoginPage returnTo="/cases/123" />);
    await userEvent.click(screen.getByRole("button", { name: "Continue with Blocks" }));
    expect(login).toHaveBeenCalledWith("/cases/123");
    expect(screen.getByRole("button", { name: "Redirecting..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create an account" })).toBeDisabled();
  });

  it("allows retry when the hosted login cannot start", async () => {
    login.mockRejectedValue(new Error("Sign-in unavailable. Please try again."));
    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: "Continue with Blocks" }));
    await screen.findByText("Sign-in unavailable. Please try again.");
    expect(screen.getByRole("button", { name: "Continue with Blocks" })).toBeEnabled();
  });

  it("keeps login disabled when configuration is missing", () => {
    configured.mockReturnValue(false);
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: "Continue with Blocks" })).toBeDisabled();
    expect(screen.getByText(defaultDictionary["auth.loginUnavailable"])).toBeInTheDocument();
  });

  it("preserves the destination when opening signup and shows the activation confirmation", async () => {
    render(<LoginPage returnTo="/cases/123" signupSuccess />);
    expect(screen.getByText(defaultDictionary["auth.signup.checkInbox"])).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));
    await waitFor(() => expect(window.location.pathname).toBe("/signup"));
    expect(new URLSearchParams(window.location.search).get("returnTo")).toBe("/cases/123");
    window.history.replaceState({}, "", "/");
  });
});
