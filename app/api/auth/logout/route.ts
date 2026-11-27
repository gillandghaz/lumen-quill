import { route } from "@/server/http/kit";
import { logout } from "@/server/http/auth-handlers";

export const POST = route(logout);
