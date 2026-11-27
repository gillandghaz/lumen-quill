import { route } from "@/server/http/kit";
import { createSession } from "@/server/http/auth-handlers";

export const POST = route(createSession);
