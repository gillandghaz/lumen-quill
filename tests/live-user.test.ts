import { describe, expect, it } from "vitest";
import { clearLiveUser, liveSetting, mergeLive, updateLiveUser, type LiveSettings } from "@/client/lib/live-user";

const settings: LiveSettings = { mode: "sonata", timeZone: "Asia/Jakarta", nextDay: "ask", fontScale: 1, homeTab: "overview" };
const server = { uid: "u1", username: "sample", avatarVersion: null as number | null, settings };

describe("live user (fresh values after a change, over briefly cached server data)", () => {
  it("leaves the server user alone when nothing changed", () => {
    expect(mergeLive(server, {})).toBe(server);
  });

  it("applies a newer mode, username and photo over the server values", () => {
    const u = mergeLive(server, { at: 1, settings: { mode: "palace" }, username: "quill", avatarVersion: 7 });
    expect(u.settings).toEqual({ ...settings, mode: "palace" });
    expect(u.username).toBe("quill");
    expect(u.avatarVersion).toBe(7);
    expect(u.uid).toBe("u1");
  });

  it("keeps a removed photo removed", () => {
    expect(mergeLive({ ...server, avatarVersion: 3 }, { at: 1, avatarVersion: null }).avatarVersion).toBeNull();
  });

  it("records changes, merges them, and forgets them on sign-out", () => {
    clearLiveUser();
    expect(liveSetting("mode")).toBeUndefined();
    updateLiveUser({ settings: { mode: "palace" } });
    updateLiveUser({ settings: { nextDay: "new" } });
    expect(liveSetting("mode")).toBe("palace");
    expect(liveSetting("nextDay")).toBe("new");
    clearLiveUser();
    expect(liveSetting("mode")).toBeUndefined();
  });
});
