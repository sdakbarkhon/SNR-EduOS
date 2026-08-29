/**
 * DemoSessionContext — признак «идёт показ демонстрации».
 *
 * ЧТО ИЗМЕНИЛОСЬ 29.08.2026. Признаком была АРЕНДА ДЕМО-МЕСТА: кнопка «Демо»
 * ходила на /api/demo/claim-parent, сервер входил настоящим родителем
 * демо-школы и отдавал пару токенов Supabase плюс ключ аренды. Ключ лежал
 * здесь и продлевался раз в пять минут. Демонстрация держалась сразу на трёх
 * внешних вещах — сети, живой сессии Supabase и свободном месте в
 * demo_leases — и отваливалась от любой из них: аренда протухала посреди
 * показа, и разделы на глазах у зрителя переставали быть демонстрацией.
 *
 * Теперь признак ЛОКАЛЬНЫЙ: один ключ в защищённом хранилище телефона.
 * Ни сети, ни базы, ни аренды. Содержимое разделов целиком даёт слой
 * заготовок (src/data).
 *
 * ЧТО ОСТАЛОСЬ В БАЗЕ НЕТРОНУТЫМ. Маршрут /api/demo/claim-parent, функция
 * claim_demo_slot и таблица demo_leases никуда не делись и не менялись — на
 * них держится демо-вход учеников и учителей в вебе. Мобильное приложение
 * просто перестало их звать. По той же причине остаются в базе родитель
 * Исмаилов и ученик Шерзод: они нужны демо-школе, мы лишь отвязали их от
 * этой кнопки.
 *
 * ПОЧЕМУ SecureStore, А НЕ AsyncStorage. Хранится один булев признак, секрета
 * в нём нет — но expo-secure-store уже в зависимостях, а @react-native-async-
 * storage пришлось бы заводить. Новая зависимость ради одного флага не
 * окупается.
 *
 * ФОРМА КОНТЕКСТА СОХРАНЕНА НАМЕРЕННО: isDemo — то же поле того же хука, и
 * demoOr со всеми экранами, которые его читают, не тронуты ни строкой.
 * Изменилось только то, ЧТО стоит за этим полем.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

/** Признак показа. Значение — константа ниже; важен сам факт наличия ключа. */
const STORAGE_KEY = "snr_demo_mode";
const ON = "1";

/**
 * Ключ прежнего механизма — ключ аренды демо-места.
 *
 * Признаком он больше не является, но на телефонах, где показ шёл до этого
 * обновления, он лежит в хранилище. Стираем при первом же запуске, чтобы не
 * оставался мёртвым грузом. Освобождать саму аренду нечем и незачем: без
 * продления сервер снимает её сам через четверть часа.
 *
 * ПЕРЕНОСА НЕТ НАМЕРЕННО. Заманчиво было бы считать наличие старого ключа
 * за «показ шёл, пусть продолжается», но старый ключ переживал и выход на
 * онбординг (гасился он только при выходе и при настоящем входе). Человек,
 * стоящий на экране входа, после обновления оказался бы сразу внутри
 * демонстрации. Один раз начать с онбординга предсказуемее.
 */
const LEGACY_KEY = "snr_demo_session_token";

interface DemoSessionState {
  /** Идёт ли показ. Тот же смысл и то же имя, что и до 29.08.2026. */
  isDemo: boolean;
  /**
   * Прочитан ли ключ с диска.
   *
   * Нужен ровно одному месту — восстановлению входа при запуске
   * (AuthSessionContext). Без него порядок такой: провайдеры смонтировались,
   * isDemo ещё false, восстановление успевает решить «сессии нет, показываем
   * онбординг» и больше не запускается — а ключ приезжает следующим кадром,
   * и показ не переживал бы перезапуск.
   */
  demoReady: boolean;
  /** Включить показ: ключ на диск, флаг в состояние. Ни сети, ни базы. */
  enterDemo: () => Promise<void>;
  /** Погасить показ: ключ с диска, флаг из состояния. */
  clearDemoSession: () => Promise<void>;
}

const DemoSessionContext = createContext<DemoSessionState | null>(null);

export function useDemoSession(): DemoSessionState {
  const ctx = useContext(DemoSessionContext);
  if (!ctx) throw new Error("useDemoSession must be inside DemoSessionProvider");
  return ctx;
}

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(false);
  const [demoReady, setDemoReady] = useState(false);

  // Один раз при запуске: шёл ли показ, когда приложение закрыли.
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored === ON) setIsDemo(true);
        await SecureStore.deleteItemAsync(LEGACY_KEY);
      } catch (e) {
        // Хранилище недоступно — считаем, что показа нет. Ошибка не молчит:
        // это единственная причина, по которой показ мог бы не восстановиться.
        console.error("[DemoSession] чтение признака показа не удалось:", e);
      } finally {
        // В finally, а не в try: восстановление входа ждёт этого флага, и
        // сбой чтения не должен оставить приложение на пустом экране.
        setDemoReady(true);
      }
    })();
  }, []);

  const enterDemo = useCallback(async () => {
    // Сначала на диск, потом в состояние. В обратном порядке экран успел бы
    // показать демонстрацию, которую перезапуск уже не нашёл бы.
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, ON);
    } catch (e) {
      // Показ всё равно включаем: не переживёт перезапуск — полбеды, а не
      // открыться по кнопке вовсе — беда.
      console.error("[DemoSession] не удалось запомнить признак показа:", e);
    }
    setIsDemo(true);
  }, []);

  const clearDemoSession = useCallback(async () => {
    // Здесь порядок обратный: сначала гасим на экране. Признак демонстрации
    // обязан исчезнуть немедленно, даже если хранилище откажет — иначе
    // настоящий родитель увидел бы выдуманные разделы как свои.
    setIsDemo(false);
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch (e) {
      console.error("[DemoSession] не удалось стереть признак показа:", e);
    }
  }, []);

  const value = useMemo<DemoSessionState>(
    () => ({ isDemo, demoReady, enterDemo, clearDemoSession }),
    [isDemo, demoReady, enterDemo, clearDemoSession],
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}
