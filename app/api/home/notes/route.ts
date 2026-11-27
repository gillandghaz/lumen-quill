import { route } from "@/server/http/kit";
import { timelineH } from "@/server/http/notes-handlers";

export const GET = route(timelineH);
