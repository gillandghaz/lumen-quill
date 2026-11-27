import { route } from "@/server/http/kit";
import { deleteUserH, updateUserH } from "@/server/http/admin-handlers";

export const PATCH = route(updateUserH);
export const DELETE = route(deleteUserH);
