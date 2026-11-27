import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { forgetProfile, getProfileCached } from "@/server/services/profile";

/** A fake Firestore whose profile reads can be held open, to replay a read racing a change. */
function fakeDb() {
  let mode = "sonata";
  let hold: Promise<void> | null = null;
  const db = {
    collection: () => ({
      doc: () => ({
        get: async () => {
          const seen = mode; // the value at the moment the read starts
          if (hold) await hold;
          return { exists: true, data: () => ({ username: "sample", settings: { mode: seen } }) };
        },
      }),
    }),
  } as unknown as Firestore;
  return {
    db,
    set: (m: string) => { mode = m; },
    holdReads: () => { let release!: () => void; hold = new Promise((r) => { release = r; }); return () => { hold = null; release(); }; },
  };
}

describe("profile cache", () => {
  it("serves a cached profile until it is changed", async () => {
    const f = fakeDb();
    const uid = "cache-a";
    expect((await getProfileCached(f.db, uid))?.settings.mode).toBe("sonata");
    f.set("palace");
    expect((await getProfileCached(f.db, uid))?.settings.mode).toBe("sonata"); // still cached
    forgetProfile(uid);
    expect((await getProfileCached(f.db, uid))?.settings.mode).toBe("palace");
  });

  it("does not cache a read that started before a change", async () => {
    const f = fakeDb();
    const uid = "cache-b";
    const release = f.holdReads();
    const slow = getProfileCached(f.db, uid); // starts reading "sonata"
    f.set("palace");
    forgetProfile(uid); // the change lands while the read is still open
    release();
    expect((await slow)?.settings.mode).toBe("sonata");
    expect((await getProfileCached(f.db, uid))?.settings.mode).toBe("palace"); // the stale read was not kept
  });
});
