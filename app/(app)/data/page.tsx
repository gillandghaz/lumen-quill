import { redirect } from "next/navigation";
import { DataPanel } from "@/client/components/DataPanel";
import { loadPageContext } from "@/server/page-guards";

export const metadata = { title: "Data" };

export default async function DataPage() {
  const ctx = await loadPageContext();
  if (!ctx.configured || !ctx.user) redirect("/login");
  return (
    <main id="main" className="main">
      <DataPanel user={ctx.user} />
    </main>
  );
}
