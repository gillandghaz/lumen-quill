import { route } from "@/server/http/kit";
import { createPasswordH, passwordStatusH } from "@/server/http/account-handlers";

export const GET = route(passwordStatusH);
export const POST = route(createPasswordH);
