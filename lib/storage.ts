import { isHouse, type House } from "@/lib/house/types";

const STORAGE_KEY = "house-vision:model";

export function saveHouse(house: House) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(house));
}

export function loadHouse(): House | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isHouse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
