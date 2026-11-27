import { redirect } from "next/navigation";
import { Home } from "@/client/components/home/Home";
import { loadPageContext } from "@/server/page-guards";
import { isHomeTab } from "@/shared/limits";

export const metadata = { title: "Home" };

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await loadPageContext();
  if (!ctx.configured || !ctx.user) redirect("/login");
  const wanted = (await searchParams)["tab"];
  const tab = isHomeTab(wanted) ? wanted : ctx.user.settings.homeTab;
  return (
    <main id="main" className="main">
      <Home username={ctx.user.username} initialTab={tab} />
    </main>
  );
}
