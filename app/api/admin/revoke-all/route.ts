import { route } from "@/server/http/kit";
import { revokeAllH } from "@/server/http/admin-handlers";

export const POST = route(revokeAllH);
