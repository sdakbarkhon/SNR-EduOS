import * as SecureStore from "expo-secure-store";

/**
 * Промт МОБ-5/МОБ-6: ТЗ просило "AsyncStorage" для персистентных mock-данных
 * (оплаты, настройки, способы оплаты и т.д.), но
 * @react-native-async-storage/async-storage — нативный модуль, которого нет
 * в уже собранном APK/Expo Go рантайме этого приложения (см. package.json —
 * ни его, ни expo-local-authentication тут никогда не было), а публикация в
 * этой задаче идёт ТОЛЬКО через OTA (без новой сборки). Поэтому вместо
 * AsyncStorage используем expo-secure-store — тот же native-модуль, что уже
 * несёт сессию Supabase (см. secureStorageAdapter.ts), уже скомпилирован в
 * бинарник и полностью JS-совместим по семантике get/set/remove JSON.
 * Раскрыто в отчёте как осознанное отклонение от буквального ТЗ.
 *
 * SecureStore ограничивает значение ~2КБ на Android — мок-массивы из этого
 * промта (4-6 записей) укладываются с запасом.
 */
export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`[mockStorage] getJSON(${key}) failed to parse, treating as empty:`, e);
    return null;
  }
}

export async function setJSON<T>(key: string, value: T): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export async function removeItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

/** Читает ключ; если пусто — сидирует значением по умолчанию и возвращает его. */
export async function getOrSeed<T>(key: string, seed: T): Promise<T> {
  const existing = await getJSON<T>(key);
  if (existing != null) return existing;
  await setJSON(key, seed);
  return seed;
}
