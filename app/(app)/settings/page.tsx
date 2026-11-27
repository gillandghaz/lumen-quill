import { redirect } from "next/navigation";
import { SettingsPanel } from "@/client/components/SettingsPanel";
import { loadPageContext } from "@/server/page-guards";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await loadPageContext();
  if (!ctx.configured || !ctx.user) redirect("/login");
  return (
    <main id="main" className="main">
      <SettingsPanel user={ctx.user} />
    </main>
  );
}
