import { redirect } from "next/navigation";
import { Archive } from "@/client/components/Archive";
import { loadPageContext } from "@/server/page-guards";

export const metadata = { title: "Archive" };

export default async function ArchivePage() {
  const ctx = await loadPageContext();
  if (!ctx.configured || !ctx.user) redirect("/login");
  return (
    <main id="main" className="main">
      <Archive username={ctx.user.username} />
    </main>
  );
}
