import { route } from "@/server/http/kit";
import { deleteAvatarH, putAvatarH } from "@/server/http/account-handlers";

export const PUT = route(putAvatarH);
export const DELETE = route(deleteAvatarH);
