import { route } from "@/server/http/kit";
import { deleteEntryH, saveEntryH } from "@/server/http/notes-handlers";

export const PUT = route(saveEntryH);
export const DELETE = route(deleteEntryH);
