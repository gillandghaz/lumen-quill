import { route } from "@/server/http/kit";
import { getAvatarH } from "@/server/http/account-handlers";

export const GET = route(getAvatarH);
