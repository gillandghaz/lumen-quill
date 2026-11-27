import { route } from "@/server/http/kit";
import { backupH } from "@/server/http/admin-handlers";

export const GET = route(backupH);
