"use client";
import { useEffect } from "react";
import { useCart } from "@/lib/cart";
export function ClearPaidCart() {
  useEffect(() => {
    useCart.getState().clear();
  }, []);
  return null;
}
