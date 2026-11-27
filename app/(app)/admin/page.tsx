import { notFound, redirect } from "next/navigation";
import { AdminPanel } from "@/client/components/AdminPanel";
import { loadPageContext } from "@/server/page-guards";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const ctx = await loadPageContext();
  if (!ctx.configured || !ctx.user) redirect("/login");
  if (!ctx.user.admin) notFound();
  return (
    <main id="main" className="main">
      <AdminPanel user={ctx.user} />
    </main>
  );
}
