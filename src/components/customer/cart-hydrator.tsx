"use client";

import { useEffect } from "react";
import { hydrateStores } from "@/lib/stores/hydrate";

export function CartHydrator() {
  useEffect(() => {
    void hydrateStores();
  }, []);
  return null;
}
