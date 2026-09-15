import { Router } from "express";
import { z } from "zod";
import type { BlocksUser } from "@seliseblocks/client";
import { PrivateStore } from "./privateStore";
import { roles } from "./blocksRuntime";
import { signupClinicCatalog } from "../src/features/organizations/signupClinicCatalog";

export const hospitalPatientId = z.string().trim().min(2).max(64).regex(/^[a-zA-Z0-9][a-zA-Z0-9./_-]+$/);
export function hospitalBranchMap() {
  const mapping = z.record(z.string(), z.string().min(1)).parse(JSON.parse(process.env.HOSPITAL_BRANCH_MAP || "{}"));
  if (new Set(Object.values(mapping)).size !== Object.values(mapping).length) throw new Error("Each hospital needs a distinct complaint branch");
  return mapping;
}
export function patientIdentity(store: PrivateStore, owner: string, organizationId: string) {
  const row = store.db.prepare("SELECT encrypted FROM patient_hospital_ids WHERE owner=? AND organization_id=?").get(owner, organizationId);
  return row ? store.unseal<string>(String(row.encrypted), `hospital-id:${owner}:${organizationId}`) : undefined;
}
export function snapshotPatientIdentity(store: PrivateStore, caseId: string, owner: string, organizationId: string, patientId: string) {
  store.db.prepare("INSERT INTO case_patient_identity VALUES(?,?,?,?)").run(caseId, owner, organizationId, store.seal(patientId, `case-patient:${caseId}:${owner}:${organizationId}`));
}
export function organizationForCase(store: PrivateStore, row: Record<string, unknown>) {
  const snapshot = store.db.prepare("SELECT organization_id FROM case_patient_identity WHERE case_id=?").get(String(row.ItemId ?? row.itemId));
  return snapshot?.organization_id ?? Object.entries(hospitalBranchMap()).find(([, branch]) => branch === row.BranchId)?.[0];
}

// Patient destinations are preferences, not IAM grants or staff branch access.
export function patientHospitalRoutes(store: PrivateStore) {
  const router = Router();
  const clinics = signupClinicCatalog.clinics;
  store.db.exec("CREATE TABLE IF NOT EXISTS patient_hospitals(owner TEXT NOT NULL, organization_id TEXT NOT NULL, source TEXT NOT NULL, PRIMARY KEY(owner,organization_id))");
  function owner(user: BlocksUser) {
    if (!user.itemId || !roles(user).includes("patient") || roles(user).some(role => ["front_desk", "branch_manager", "quality_lead", "admin", "clouduser"].includes(role))) return undefined;
    return user.itemId;
  }
  function selected(user: BlocksUser) {
    const ids = Array.isArray(user.organizationIds) ? user.organizationIds.filter((id): id is string => typeof id === "string") : [];
    if (typeof user.organizationId === "string") ids.push(user.organizationId);
    for (const id of ids) if (clinics.some(clinic => clinic.itemId === id)) {
      store.db.prepare("INSERT OR IGNORE INTO patient_hospitals VALUES(?,?,?)").run(user.itemId!, id, "signup");
    }
    return store.db.prepare("SELECT organization_id,source FROM patient_hospitals WHERE owner=? ORDER BY rowid").all(user.itemId!);
  }
  router.get("/patient-hospitals", (_req, res) => {
    const user = res.locals.user as BlocksUser;
    if (!owner(user)) { res.status(403).json({ error: "patient_required" }); return; }
    const saved = selected(user);
    // Mapping is administrator-controlled; never equate unrelated IAM and Branch IDs.
    const mapping = hospitalBranchMap();
    const active = store.db.prepare("SELECT organization_id FROM patient_active_hospital WHERE owner=?").get(user.itemId!);
    res.json({ hospitals: clinics.map(clinic => {
      const patientId = patientIdentity(store, user.itemId!, clinic.itemId);
      return { ...clinic, selected: saved.some(row => row.organization_id === clinic.itemId), branchId: mapping[clinic.itemId] ?? null, patientIdLast4: patientId?.slice(-4) ?? null, patientIdVerified: false };
    }), primaryOrganizationId: saved[0]?.organization_id ?? null, activeOrganizationId: active?.organization_id ?? saved[0]?.organization_id ?? null });
  });
  router.post("/patient-hospitals", (req, res) => {
    const user = res.locals.user as BlocksUser, id = owner(user);
    if (!id) { res.status(403).json({ error: "patient_required" }); return; }
    const input = z.object({ organizationId: z.string(), patientId: hospitalPatientId }).strict().parse(req.body);
    if (!clinics.some(clinic => clinic.itemId === input.organizationId)) { res.status(400).json({ error: "invalid_hospital" }); return; }
    selected(user);
    const result = store.db.prepare("INSERT OR IGNORE INTO patient_hospitals VALUES(?,?,?)").run(id, input.organizationId, "patient");
    store.db.prepare("INSERT INTO patient_hospital_ids VALUES(?,?,?) ON CONFLICT(owner,organization_id) DO UPDATE SET encrypted=excluded.encrypted").run(id, input.organizationId, store.seal(input.patientId, `hospital-id:${id}:${input.organizationId}`));
    store.audit(id, "hospital_patient_id_saved", input.organizationId);
    if (result.changes) store.audit(id, "patient_hospital_added", input.organizationId);
    res.json({ saved: true });
  });
  router.post("/patient-hospitals/active", (req, res) => {
    const user = res.locals.user as BlocksUser, id = owner(user);
    if (!id) { res.status(403).json({ error: "patient_required" }); return; }
    const { organizationId } = z.object({ organizationId: z.string() }).strict().parse(req.body);
    if (!selected(user).some(row => row.organization_id === organizationId)) { res.status(403).json({ error: "hospital_not_selected" }); return; }
    store.db.prepare("INSERT INTO patient_active_hospital VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET organization_id=excluded.organization_id").run(id, organizationId);
    res.json({ activeOrganizationId: organizationId });
  });
  return router;
}
