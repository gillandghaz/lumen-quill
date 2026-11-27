import { route } from "@/server/http/kit";
import { overviewH } from "@/server/http/notes-handlers";

export const GET = route(overviewH);
