import { route } from "@/server/http/kit";
import { cleanupH } from "@/server/http/cron-handlers";

export const GET = route(cleanupH);
