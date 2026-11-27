import { route } from "@/server/http/kit";
import { setPasswordH } from "@/server/http/account-handlers";

export const POST = route(setPasswordH);
