import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const { profile, list, create, hospitals } = vi.hoisted(() => ({
  profile: { itemId: "patient-1", roles: ["patient"] },
  list: vi.fn(), create: vi.fn(), hospitals: vi.fn()
}));
vi.mock("../../app/providers/AuthProvider", () => ({ useAuth: () => ({ status: "authenticated" }) }));
vi.mock("../refunds/privateApi", () => ({ privateApi: (...args: unknown[]) => hospitals(...args) }));
vi.mock("../../lib/blocks/client", () => ({ blocksClient: {
  iam: { me: async () => ({ data: profile }) }, localization: { languages: async () => [], translations: async () => ({}) },
  data: { collection: (schema: string) => {
    if (schema !== "Case" && schema !== "Branch") throw new Error("Unexpected schema");
    return { get: (...args: unknown[]) => list(...args), list: (...args: unknown[]) => { if (schema !== "Branch") throw new Error("Patients must not read staff cases"); return list(...args); }, create };
  } }
} }));
import { LocalizationProvider } from "../../lib/i18n/LocalizationProvider";
import { PatientComplaintPage } from "./PatientComplaintPage";
import { submitPatientComplaint } from "./patientComplaints";

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); profile.roles = ["patient"];
  list.mockResolvedValue({ data: { getBranchs: { items: [{ ItemId: "branch-1", Name: "Test Clinic", IsActive: true }], totalCount: 1 } } });
  hospitals.mockImplementation(async (path: string) => path === "/patient-complaints" ? { reference: "CF-ABCD23456789" } : { hospitals: [{ itemId: "org-1", name: "Test Clinic", selected: true, branchId: "branch-1", patientIdLast4: "1234" }], branches: [{ itemId: "branch-1", name: "Dhaka Branch" }], primaryOrganizationId: "org-1", activeOrganizationId: "org-1" });
  create.mockResolvedValue({ data: { insertCase: { acknowledged: true, itemId: "new-case" } } });
});
const valid = { requestId: "123e4567-e89b-42d3-a456-426614174000", organizationId: "org-1", branchId: "branch-1", category: "billing", subject: "Duplicate payment at reception" };
it("creates a patient complaint without staff permissions or staff case reads", async () => {
  const reference = await submitPatientComplaint(valid);
  expect(reference).toBe("CF-ABCD23456789");
  expect(create).not.toHaveBeenCalled();
  expect(list).not.toHaveBeenCalled();
  expect(hospitals).toHaveBeenCalledWith("/patient-complaints", "POST", { organizationId: "org-1", branchId: "branch-1", category: "billing", subject: valid.subject, requestId: valid.requestId, refundRequested: false });
});
it("does not confuse a hospital ID with a branch ID when routing is unconfigured", async () => {
  hospitals.mockRejectedValue(new Error("hospital_not_ready"));
  await expect(submitPatientComplaint(valid)).rejects.toThrow("hospital_not_ready");
  expect(create).not.toHaveBeenCalled();
});
it("rejects invalid branches, clinical text, and non-patient sessions before insertion", async () => {
  await expect(submitPatientComplaint({ ...valid, subject: "creatinine 1.4 mg/dL" })).rejects.toThrow("clinical_content");
  profile.roles = ["doctor"];
  await expect(submitPatientComplaint(valid)).rejects.toThrow("patient_required");
  expect(create).not.toHaveBeenCalled();
});
it("does not acknowledge a rejected gateway write", async () => {
  hospitals.mockRejectedValueOnce(new Error("Forbidden"));
  await expect(submitPatientComplaint(valid)).rejects.toThrow();
});
it("lets a patient select a clinic, submit once, and receive a reference", async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LocalizationProvider><PatientComplaintPage onNavigate={vi.fn()} /></LocalizationProvider></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Clinic or hospital" })).toHaveValue("org-1"));
  expect(screen.getByRole("combobox", { name: "Branch" })).toHaveValue("branch-1");
  expect(screen.getByRole("combobox", { name: "Branch" })).toHaveValue("branch-1");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "What is this about?" }), "billing");
  await userEvent.type(screen.getByRole("textbox", { name: "What happened?" }), valid.subject);
  await userEvent.click(screen.getByRole("button", { name: "Submit complaint" }));
  expect(await screen.findByRole("heading", { name: "Complaint submitted" })).toBeInTheDocument();
  expect(screen.getByText(/^CF-/)).toBeInTheDocument();
  expect(hospitals.mock.calls.filter(([path]) => path === "/patient-complaints")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Submit complaint" })).not.toBeInTheDocument();
});
