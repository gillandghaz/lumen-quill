import { route } from "@/server/http/kit";
import { deleteNoteH, getNoteH, renameNoteH } from "@/server/http/notes-handlers";

export const GET = route(getNoteH);
export const PATCH = route(renameNoteH);
export const DELETE = route(deleteNoteH);
