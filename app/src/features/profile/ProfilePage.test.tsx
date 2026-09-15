import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const { updateMe, profile } = vi.hoisted(() => ({ updateMe: vi.fn<() => Promise<Record<string, unknown>>>(async () => ({})), profile: { itemId: "patient-1", firstName: "Test", lastName: "Patient", email: "patient@example.test", roles: ["patient"] } }));
vi.mock("../../app/providers/AuthProvider", () => ({ useAuth: () => ({ status: "authenticated", logout: vi.fn() }) }));
vi.mock("../../lib/blocks/client", () => ({ blocksClient: { iam: { me: async () => ({ data: profile }), updateMe }, localization: { languages: async () => [], translations: async () => ({}) } } }));
import { LocalizationProvider } from "../../lib/i18n/LocalizationProvider";
import { ProfilePage } from "./ProfilePage";
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); profile.roles = ["patient"]; updateMe.mockResolvedValue({}); });

it.each(["front_desk", "branch_manager", "quality_lead"])("supports the %s profile and reports rejected saves", async role => {
  profile.roles = [role];
  updateMe.mockResolvedValue({ isSuccess: false, errors: ["rejected"] });
  render(<QueryClientProvider client={new QueryClient()}><LocalizationProvider><ProfilePage /></LocalizationProvider></QueryClientProvider>);
  expect(await screen.findByText("Workplace access")).toBeInTheDocument();
  expect(screen.queryByText("Refund destination")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Edit details" }));
  await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
  await waitFor(() => expect(updateMe).toHaveBeenCalled());
  expect(await screen.findByText("Your profile could not be saved. Please try again.")).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /^Save$/ })).toBeInTheDocument();
  expect(screen.queryByText("Your profile has been updated.")).not.toBeInTheDocument();
});
it("edits only the signed-in user's name, without sending user ID or changing email", async () => {
  render(<QueryClientProvider client={new QueryClient()}><LocalizationProvider><ProfilePage /></LocalizationProvider></QueryClientProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "Edit details" }));
  await userEvent.clear(screen.getByRole("textbox", { name: "First name" }));
  await userEvent.type(screen.getByRole("textbox", { name: "First name" }), "New");
  await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
  await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ firstName: "New", lastName: "Patient" }));
  expect(screen.queryByText("Tenant id (x-blocks-key)")).not.toBeInTheDocument();
  expect(screen.queryByText("View raw response")).not.toBeInTheDocument();
});
