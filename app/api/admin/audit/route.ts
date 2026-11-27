import { route } from "@/server/http/kit";
import { auditH } from "@/server/http/admin-handlers";

export const GET = route(auditH);
