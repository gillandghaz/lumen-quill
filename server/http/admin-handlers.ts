import { HttpError } from "../errors";
import { requireAdmin } from "../session";
import { RULES } from "../security/rate-limit";
import { backupPage, createUser, deleteUser, listAudit, listUsers, revokeEveryone, revokeUser, securityStatus, setDisabled, stats } from "../services/admin";
import { adminCreateUserSchema, adminUpdateUserSchema, auditQuery, backupQuery, confirmSchema, retentionSchema } from "@/shared/schemas";
import { getRetention, setRetention } from "../services/app-settings";
import { purgeExpired } from "../services/retention";
import { writeAudit } from "../services/audit";
import { json } from "./respond";
import { body, query, safe, validUid, writer, type Handler } from "./kit";

/** Admin only. Role comes from the verified custom claim AND the profile, never from the request. */
export const usersH: Handler = safe(async (req, deps) => {
  await requireAdmin(req, deps);
  return json(200, { items: await listUsers(deps) });
});

export const createUserH: Handler = safe(async (req, deps) => {
  const a = await writer(req, deps, "adminChange", true);
  return json(201, await createUser(deps, a, adminCreateUserSchema.parse(await body(req, 2048))));
});

export const updateUserH: Handler = safe(async (req, deps, p) => {
  const a = await writer(req, deps, "adminChange", true);
  const { disabled } = adminUpdateUserSchema.parse(await body(req, 256));
  await setDisabled(deps, a, validUid(p["uid"]), disabled);
  return json(200, { ok: true });
});

export const revokeUserH: Handler = safe(async (req, deps, p) => {
  const a = await writer(req, deps, "adminChange", true);
  await revokeUser(deps, a, validUid(p["uid"]));
  return json(200, { ok: true });
});

export const deleteUserH: Handler = safe(async (req, deps, p) => {
  const a = await writer(req, deps, "destructive", true);
  const uid = validUid(p["uid"]);
  const { confirm } = confirmSchema.parse(await body(req, 256));
  if (confirm !== "DELETE") throw new HttpError(400, "confirmation_mismatch");
  return json(200, await deleteUser(deps, a, uid));
});

export const revokeAllH: Handler = safe(async (req, deps) => {
  const a = await writer(req, deps, "destructive", true);
  const { confirm } = confirmSchema.parse(await body(req, 256));
  if (confirm !== "SIGN OUT ALL") throw new HttpError(400, "confirmation_mismatch");
  return json(200, { accounts: await revokeEveryone(deps, a) });
});

export const auditH: Handler = safe(async (req, deps) => {
  await requireAdmin(req, deps);
  return json(200, await listAudit(deps, auditQuery.parse(query(req)).cursor));
});

export const statsH: Handler = safe(async (req, deps) => {
  const a = await requireAdmin(req, deps);
  await deps.limiter.hit("heavy-read", a.identity.uid, RULES.heavyRead);
  return json(200, await stats(deps));
});

export const securityH: Handler = safe(async (req, deps) => {
  await requireAdmin(req, deps);
  return json(200, await securityStatus(deps));
});

export const backupH: Handler = safe(async (req, deps) => {
  const a = await requireAdmin(req, deps);
  await deps.limiter.hit("backup", a.identity.uid, RULES.backup);
  return json(200, await backupPage(deps, a, backupQuery.parse(query(req))));
});

export const getRetentionH: Handler = safe(async (req, deps) => {
  await requireAdmin(req, deps);
  return json(200, await getRetention(deps.db));
});

/** Change how long Statistics (activity) and Audit log data are kept; old data is purged right away. */
export const putRetentionH: Handler = safe(async (req, deps) => {
  const a = await writer(req, deps, "adminChange", true);
  const next = await setRetention(deps.db, retentionSchema.parse(await body(req, 256)));
  await writeAudit(deps.db, { action: "admin.retention", actorUid: a.identity.uid, details: { statsDays: next.statsDays, auditDays: next.auditDays } }, deps.now());
  const purged = await purgeExpired(deps.db, deps.now());
  return json(200, { ...next, purged });
});
