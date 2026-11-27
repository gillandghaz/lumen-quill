import { route } from "@/server/http/kit";
import { revokeUserH } from "@/server/http/admin-handlers";

export const POST = route(revokeUserH);
