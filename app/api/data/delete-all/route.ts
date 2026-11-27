import { route } from "@/server/http/kit";
import { deleteAllH } from "@/server/http/data-handlers";

export const POST = route(deleteAllH);
