import { route } from "@/server/http/kit";
import { updateUsernameH } from "@/server/http/account-handlers";

export const PUT = route(updateUsernameH);
