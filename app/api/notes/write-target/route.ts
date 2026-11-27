import { route } from "@/server/http/kit";
import { writeTargetH } from "@/server/http/notes-handlers";

export const GET = route(writeTargetH);
