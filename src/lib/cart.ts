"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PublicPlan } from "./catalog";
import type { Currency } from "./currency";
type Cart = {
  items: PublicPlan[];
  currency: Currency;
  add: (plan: PublicPlan) => void;
  remove: (id: string) => void;
  clear: () => void;
  setCurrency: (currency: Currency) => void;
};
export const useCart = create<Cart>()(
  persist(
    (set) => ({
      items: [],
      currency: "USD",
      add: (plan) =>
        set((s) => ({
          items: s.items.some((p) => p.id === plan.id)
            ? s.items
            : [...s.items, plan].slice(0, 5),
        })),
      remove: (id) =>
        set((s) => ({ items: s.items.filter((p) => p.id !== id) })),
      clear: () => set({ items: [] }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: "roamly-cart-v2",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
