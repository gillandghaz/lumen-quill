"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/client/auth/actions";

export function AppNav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/archive", label: "Archive" },
    { href: "/account", label: "Account" },
    { href: "/settings", label: "Settings" },
    { href: "/data", label: "Data" },
    ...(admin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <nav className="nav" aria-label="Main">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={path === i.href || (i.href === "/archive" && path.startsWith("/notes")) ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
      <a
        href="/"
        onClick={async (e) => {
          e.preventDefault();
          await logout();
          window.location.replace("/");
        }}
      >
        Sign out
      </a>
    </nav>
  );
}
