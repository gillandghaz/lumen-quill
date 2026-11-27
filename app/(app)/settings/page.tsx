import { redirect } from "next/navigation";
import { SettingsShell, type SettingsTab } from "@/client/components/settings/SettingsShell";
import { loadPageContext } from "@/server/page-guards";

export const metadata = { title: "Settings" };

const TABS: SettingsTab[] = ["account", "preferences", "data", "admin"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await loadPageContext();
  if (!ctx.configured || !ctx.user) redirect("/login");
  const wanted = (await searchParams)["tab"];
  const tab = TABS.includes(wanted as SettingsTab) && (wanted !== "admin" || ctx.user.admin) ? (wanted as SettingsTab) : "account";
  return (
    <main id="main" className="main">
      <SettingsShell user={ctx.user} initialTab={tab} />
    </main>
  );
}
