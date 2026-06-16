import * as SecureStore from "expo-secure-store";
import type { SessionStorage } from "@snr/core";

/**
 * Хранилище сессии Supabase поверх expo-secure-store.
 * SecureStore ограничивает значение ~2КБ, а JWT-сессия может быть длиннее —
 * поэтому длинные значения чанкуются по нескольким ключам.
 */
const CHUNK_SIZE = 2000;
const chunkCountKey = (key: string) => `${key}__chunks`;

export const secureStorageAdapter: SessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(chunkCountKey(key));
    if (countRaw == null) {
      return SecureStore.getItemAsync(key);
    }
    const count = parseInt(countRaw, 10);
    let value = "";
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}__${i}`);
      if (part == null) return null;
      value += part;
    }
    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.deleteItemAsync(chunkCountKey(key));
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        `${key}__${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
    await SecureStore.setItemAsync(chunkCountKey(key), String(count));
  },

  async removeItem(key: string): Promise<void> {
    const countRaw = await SecureStore.getItemAsync(chunkCountKey(key));
    if (countRaw != null) {
      const count = parseInt(countRaw, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}__${i}`);
      }
      await SecureStore.deleteItemAsync(chunkCountKey(key));
    }
    await SecureStore.deleteItemAsync(key);
  },
};
