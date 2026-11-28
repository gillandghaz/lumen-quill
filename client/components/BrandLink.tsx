"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "./BrandMark";
import { confirmLeave, goHome } from "@/client/lib/unsaved";

/** Brand in the top bar. Inside the app it guards unsaved notes before navigating. */
export function BrandLink({ href = "/" }: { href?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      prefetch={false}
      className="brand"
      onClick={(e) => {
        e.preventDefault();
        if (href === "/home") goHome(router);
        else if (confirmLeave()) router.push(href);
      }}
    >
      <BrandMark />
      <span>Lumen Quill</span>
    </Link>
  );
}
