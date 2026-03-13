import { createRoot } from "solid-js";
import { getFeedsFriends, type GetFeedsFriends } from "~/api/requests/feeds/friends";
import auth from "./auth";
import { createStore, reconcile } from "solid-js/store";
import { BaseDirectory, exists, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export default createRoot(() => {
  const STORAGE_KEY = "feeds_friends";
  const INITIAL_DATA = localStorage.getItem(STORAGE_KEY);

  const [get, _set] = createStore({
    value: INITIAL_DATA ? <GetFeedsFriends>JSON.parse(INITIAL_DATA) : null
  });

  const refetch = () => getFeedsFriends().then(set);

  const set = (value: GetFeedsFriends): void => {
    try {
      // We don't want to preserve the data in demo mode.
      if (!auth.isDemo()) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch { /** NO-OP */}

    // Yeah, we're doing a deep copy in demo mode
    // because references kinda messes up the
    // reactivity system.
    if (auth.isDemo()) value = structuredClone(value);

    _set("value", reconcile(value));
  };

  const clear = (): void => {
    localStorage.removeItem(STORAGE_KEY);
    _set("value", null);
  };

  const archiveFeed = async (): Promise<number> => {
    const data = await getFeedsFriends();
    const friendsPosts = data.friendsPosts ?? [];
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const baseOpt = { baseDir: BaseDirectory.Picture };
    let savedCount = 0;
    for (const overview of friendsPosts) {
      const username = overview.user.username;
      const dir = `stayreal-archive/${dateStr}/${username}`;
      await mkdir(dir, { ...baseOpt, recursive: true });
      for (const post of overview.posts) {
        let postSaved = false;
        const primaryPath = `${dir}/${post.id}-primary.jpg`;
        const secondaryPath = `${dir}/${post.id}-secondary.jpg`;
        if (!(await exists(primaryPath, baseOpt))) {
          const res = await tauriFetch(post.primary.url);
          if (!res.ok) throw new Error(`Primary image failed: ${res.status}`);
          const buf = await res.arrayBuffer();
          await writeFile(primaryPath, new Uint8Array(buf), baseOpt);
          postSaved = true;
        }
        if (!(await exists(secondaryPath, baseOpt))) {
          const res = await tauriFetch(post.secondary.url);
          if (!res.ok) throw new Error(`Secondary image failed: ${res.status}`);
          const buf = await res.arrayBuffer();
          await writeFile(secondaryPath, new Uint8Array(buf), baseOpt);
          postSaved = true;
        }
        if (postSaved) savedCount++;
      }
    }
    return savedCount;
  };

  return { get: () => get.value, set, clear, refetch, archiveFeed };
});
