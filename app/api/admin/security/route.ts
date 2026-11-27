import { route } from "@/server/http/kit";
import { securityH } from "@/server/http/admin-handlers";

export const GET = route(securityH);
