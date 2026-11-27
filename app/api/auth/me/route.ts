import { route } from "@/server/http/kit";
import { me } from "@/server/http/auth-handlers";

export const GET = route(me);
