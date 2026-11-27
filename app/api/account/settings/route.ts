import { route } from "@/server/http/kit";
import { updateSettingsH } from "@/server/http/account-handlers";

export const PUT = route(updateSettingsH);
