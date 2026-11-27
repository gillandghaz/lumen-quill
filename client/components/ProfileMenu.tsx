"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { ConfirmDialog } from "./Modal";
import { logout } from "@/client/auth/actions";
import { confirmLeave } from "@/client/lib/unsaved";

export interface MenuUser { uid: string; username: string; email: string; admin: boolean; avatarVersion: number | null }

/** Top-right profile photo. Opens: Home, Settings, Sign out (with confirmation). */
export function ProfileMenu({ user }: { user: MenuUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(user.avatarVersion);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // The Account tab announces a new / removed photo so the menu updates without a reload.
    const onAvatar = (e: Event) => setAvatarVersion((e as CustomEvent<number | null>).detail);
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("lq:avatar", onAvatar);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("lq:avatar", onAvatar);
    };
  }, []);

  function go(href: string) {
    setOpen(false);
    if (confirmLeave()) router.push(href);
  }

  return (
    <div className="profile" ref={wrap}>
      <button type="button" className="profile-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((v) => !v)}>
        <Avatar uid={user.uid} version={avatarVersion} name={user.username} size={36} />
      </button>
      <div className={`menu${open ? " is-open" : ""}`} role="menu" aria-hidden={!open}>
        <div className="menu-head">
          <Avatar uid={user.uid} version={avatarVersion} name={user.username} size={40} />
          <div className="menu-id">
            <strong className="trunc">{user.username}</strong>
            <span className="trunc faint">{user.email}</span>
          </div>
          {user.admin && <span className="badge">admin</span>}
        </div>
        <button type="button" className="menu-item" role="menuitem" tabIndex={open ? 0 : -1} onClick={() => go("/home")}>Home</button>
        <button type="button" className="menu-item" role="menuitem" tabIndex={open ? 0 : -1} onClick={() => go("/settings")}>Settings</button>
        <button type="button" className="menu-item menu-item-danger" role="menuitem" tabIndex={open ? 0 : -1} onClick={() => { setOpen(false); setConfirming(true); }}>Sign out</button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Sign out?"
        confirmLabel="Sign out"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          if (!confirmLeave()) return;
          setBusy(true);
          await logout();
          window.location.replace("/");
        }}
      >
        You will need to sign in again to open your notes.
      </ConfirmDialog>
    </div>
  );
}
