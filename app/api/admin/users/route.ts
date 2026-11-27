import { route } from "@/server/http/kit";
import { createUserH, usersH } from "@/server/http/admin-handlers";

export const GET = route(usersH);
export const POST = route(createUserH);
