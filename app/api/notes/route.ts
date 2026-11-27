import { route } from "@/server/http/kit";
import { createNoteH, listNotesH } from "@/server/http/notes-handlers";

export const GET = route(listNotesH);
export const POST = route(createNoteH);
