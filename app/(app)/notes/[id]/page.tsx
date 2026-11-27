import { notFound, redirect } from "next/navigation";
import { NoteEditor } from "@/client/components/NoteEditor";
import { loadPageContext } from "@/server/page-guards";

export const metadata = { title: "Note" };

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await loadPageContext();
  if (!ctx.configured || !ctx.user) redirect("/login");
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) notFound();
  return (
    <main id="main" className="main main-narrow">
      <NoteEditor id={id} />
    </main>
  );
}
