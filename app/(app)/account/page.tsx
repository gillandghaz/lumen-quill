import { redirect } from "next/navigation";
import { AccountPanel } from "@/client/components/AccountPanel";
import { loadPageContext } from "@/server/page-guards";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const ctx = await loadPageContext();
  if (!ctx.configured || !ctx.user) redirect("/login");
  return (
    <main id="main" className="main">
      <AccountPanel user={ctx.user} />
    </main>
  );
}
