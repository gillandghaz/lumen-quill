import { HttpError } from "../errors";
import { cronAuthorized, purgeExpired } from "../services/retention";
import { json } from "./respond";
import { safe, type Handler } from "./kit";

/** Called once a day by Vercel Cron with `Authorization: Bearer $CRON_SECRET`. Fails closed without the secret. */
export const cleanupH: Handler = safe(async (req, deps) => {
  if (!cronAuthorized(req, process.env.CRON_SECRET)) throw new HttpError(401, "unauthorized");
  const res = await purgeExpired(deps.db, deps.now());
  console.info("cron_cleanup", JSON.stringify(res));
  return json(200, res);
});
