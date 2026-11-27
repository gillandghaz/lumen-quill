import { route } from "@/server/http/kit";
import { exportH } from "@/server/http/data-handlers";

export const GET = route(exportH);
