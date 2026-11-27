import { route } from "@/server/http/kit";
import { getRetentionH, putRetentionH } from "@/server/http/admin-handlers";

export const GET = route(getRetentionH);
export const PUT = route(putRetentionH);
