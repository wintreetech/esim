"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { deviceCheckSchema, type DeviceCheck } from "./compatibility";

type DeviceStore = {
  check: DeviceCheck | null;
  selectModel: (model: string) => void;
  answer: (question: "esim" | "unlocked", answer: DeviceCheck["esim"]) => void;
  reset: () => void;
};
const useDeviceStore = create<DeviceStore>()(
  persist(
    (set) => ({
      check: null,
      selectModel: (model) =>
        set({
          check: {
            model: model.slice(0, 120),
            esim: "",
            unlocked: "",
            checkedAt: new Date().toISOString(),
          },
        }),
      answer: (question, answer) =>
        set((state) =>
          state.check
            ? {
                check: {
                  ...state.check,
                  [question]: answer,
                  checkedAt: new Date().toISOString(),
                },
              }
            : {},
        ),
      reset: () => set({ check: null }),
    }),
    {
      name: "roamly-device-check-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ check: state.check }),
      merge: (persisted, current) => {
        const saved = (persisted as { check?: unknown } | null)?.check;
        const parsed = deviceCheckSchema.safeParse(saved);
        return { ...current, check: parsed.success ? parsed.data : null };
      },
    },
  ),
);

export function useDeviceCheck() {
  const store = useDeviceStore();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void Promise.resolve(useDeviceStore.persist.rehydrate()).then(() =>
      setHydrated(true),
    );
  }, []);
  return { ...store, hydrated };
}
