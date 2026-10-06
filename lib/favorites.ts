"use client";

import { useCallback, useEffect, useState } from "react";

/** Favourite routes ("SDG_UGX") are kept on the visitor's own device —
 *  no account needed. Components stay in sync through a window event. */
const KEY = "masterdigital:favorites";
const EVENT = "master:favorites";

function read(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(read());
    const sync = () => setFavorites(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((key: string) => {
    const cur = read();
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage unavailable (private mode) — the star just won't persist
    }
    setFavorites(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { favorites, toggle, isFavorite: (key: string) => favorites.includes(key) };
}
