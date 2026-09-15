import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocalizationProvider } from "../../lib/i18n/LocalizationProvider";
import { SignupPage } from "./SignupPage";

const { config, signup, list, emailAvailable, create } = vi.hoisted(() => ({
  config: { xBlocksKey: "D08e00d1169e543c9b2c2ac64060b9358" },
  signup: vi.fn(async () => ({})),
  list: vi.fn(async () => { throw new Error("401 Unauthorized"); }),
  emailAvailable: vi.fn(async () => ({ isAvailable: true })),
  create: vi.fn(async () => ({}))
}));
vi.mock("../../lib/blocks/config", () => ({ blocksConfig: config }));
vi.mock("../../lib/blocks/client", () => ({ blocksClient: {
  auth: { signup },
  iam: { organizations: { list }, users: { emailAvailable } },
  data: { collection: () => ({ create }) },
  localization: { languages: async () => [], translations: async () => ({}) }
} }));

function renderSignup(onNavigate = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><LocalizationProvider><SignupPage onNavigate={onNavigate} /></LocalizationProvider></QueryClientProvider>);
  return onNavigate;
}

beforeEach(() => {
  vi.clearAllMocks();
  config.xBlocksKey = "D08e00d1169e543c9b2c2ac64060b9358";
});

describe("Public signup clinic selection", () => {
  it("shows all four clinics without calling the authenticated organization endpoint", async () => {
    renderSignup();
    const picker = screen.getByRole("combobox", { name: "Clinic or hospital" });
    expect(picker).toBeEnabled();
    for (const name of ["ChikitsaFollow Demo Clinic", "Evercare Hospital", "Ibn Sina Hospitals", "Popular Hospital"]) {
      expect(screen.getByRole("option", { name })).toBeInTheDocument();
    }
    await userEvent.selectOptions(picker, "7e4a824c-37ea-4956-aa55-ed160b5e8bfc");
    expect(picker).toHaveValue("7e4a824c-37ea-4956-aa55-ed160b5e8bfc");
    expect(list).not.toHaveBeenCalled();
  });

  it("submits only patient details and the selected clinic without a password", async () => {
    const user = userEvent.setup();
    const navigate = renderSignup();
    await user.type(screen.getByRole("textbox", { name: "First name" }), "Test");
    await user.type(screen.getByRole("textbox", { name: "Last name" }), "Patient");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "test@example.test");
    await user.selectOptions(screen.getByRole("combobox"), "77ee73e7-87df-4847-967e-44d5b976b5fc");
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.getByText("Ready to create your account")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(signup).toHaveBeenCalledWith({
      firstName: "Test", lastName: "Patient", email: "test@example.test",
      organizationId: "77ee73e7-87df-4847-967e-44d5b976b5fc", roleSlugs: ["patient"]
    }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login?signup=ok"));
    expect(create).not.toHaveBeenCalled();
  });

  it("does not expose another project's clinic choices", () => {
    config.xBlocksKey = "another-project";
    renderSignup();
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    expect(screen.queryByRole("option", { name: "Evercare Hospital" })).not.toBeInTheDocument();
  });
});
