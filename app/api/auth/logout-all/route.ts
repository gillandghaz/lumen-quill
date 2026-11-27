import { route } from "@/server/http/kit";
import { logoutAll } from "@/server/http/auth-handlers";

export const POST = route(logoutAll);
