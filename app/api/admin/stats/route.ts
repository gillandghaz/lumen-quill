import { route } from "@/server/http/kit";
import { statsH } from "@/server/http/admin-handlers";

export const GET = route(statsH);
