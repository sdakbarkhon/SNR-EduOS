// ОБЯЗАТЕЛЬНОЕ УКАЗАНИЕ ШКОЛЫ ДЛЯ СКРИПТОВ. 26.08.2026.
//
// ЗАЧЕМ. Все скрипты в этой папке писались под демо-школу и держали её
// идентификатор внутри себя константой. Пока школа была одна, это работало.
// Теперь их две, и скрипт, запущенный по привычке, молча правит ту, что
// вписана в его текст, — а не ту, которую имел в виду человек.
//
// ПРАВИЛО. Ни один пишущий или удаляющий скрипт не запускается без явного
// указания школы:
//
//   node --env-file=.env.local scripts/имя.mjs --school=<uuid> [--confirm]
//
// Что происходит без него — выход с подсказкой, ни одного обращения к базе.
//
// ЧЕТЫРЕ ПРОВЕРКИ:
//   1. аргумент есть? нет — выход;
//   2. похоже на идентификатор? нет — выход;
//   3. такая школа есть в базе? нет — выход (assertSchoolExists);
//   4. скрипт был жёстко привязан к другой школе? — выход С ОШИБКОЙ, а не
//      тихое использование вписанной. Это главное: раньше расхождение между
//      «что я имел в виду» и «что вписано в файле» ничем не всплывало.
//
// ОДИН МОДУЛЬ, А НЕ КОПИЯ В КАЖДОМ ФАЙЛЕ. Копии в этом проекте расходились
// уже не раз — среднее арифметическое жило в трёх местах, опознание демо-школы
// в четырёх. Здесь проверка одна, и меняется она в одном месте.

/** Идентификаторы школ, известные на 26.08.2026 — только для подсказки. */
const KNOWN = {
  "a0a0a0a0-0000-0000-0000-000000000001": "SNR Demo School (демо, витрина)",
  "b0b0b0b0-0000-0000-0000-000000000001": "SNR School (боевая)",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bail(lines) {
  console.error("\n" + lines.join("\n") + "\n");
  process.exit(1);
}

function usage(extra = []) {
  return [
    "ОСТАНОВЛЕНО: не указана школа.",
    "",
    "Запускать так:",
    "  node --env-file=.env.local scripts/<имя>.mjs --school=<идентификатор школы>",
    "",
    "Известные школы:",
    ...Object.entries(KNOWN).map(([id, name]) => `  ${id}  — ${name}`),
    "",
    ...extra,
  ];
}

/**
 * Разбирает --school из аргументов. Синхронно, без обращения к базе.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.pinned] идентификатор, который был вписан в скрипт
 *   жёстко. Если передан и не совпадает с --school — выход с ошибкой.
 * @returns {string} идентификатор школы
 */
export function resolveSchoolId(opts = {}) {
  const argv = process.argv.slice(2);
  let value = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--school=")) { value = a.slice("--school=".length); break; }
    if (a === "--school") { value = argv[i + 1] ?? null; break; }
  }

  if (!value) bail(usage());
  if (!UUID_RE.test(value)) {
    bail([
      `ОСТАНОВЛЕНО: «${value}» не похоже на идентификатор школы.`,
      "Ожидается uuid вида a0a0a0a0-0000-0000-0000-000000000001.",
      "",
      "Известные школы:",
      ...Object.entries(KNOWN).map(([id, name]) => `  ${id}  — ${name}`),
    ]);
  }

  const pinned = opts.pinned ?? null;
  if (pinned && pinned.toLowerCase() !== value.toLowerCase()) {
    bail([
      "ОСТАНОВЛЕНО: расхождение между указанной школой и вписанной в скрипт.",
      "",
      `  указано в --school : ${value}  ${KNOWN[value.toLowerCase()] ? "— " + KNOWN[value.toLowerCase()] : ""}`,
      `  вписано в файле    : ${pinned}  ${KNOWN[pinned.toLowerCase()] ? "— " + KNOWN[pinned.toLowerCase()] : ""}`,
      "",
      "Скрипт написан под вписанную школу: в нём могут быть завязки на её",
      "группы, логины и даты. Молча применить его к другой школе — значит",
      "получить правдоподобный мусор вместо ошибки.",
      "",
      "Что делать: либо укажите ту же школу, либо сначала выясните, что",
      "именно в скрипте привязано к вписанной.",
    ]);
  }

  return value;
}

/**
 * Проверяет, что такая школа в базе действительно есть.
 *
 * Отдельно от разбора, потому что требует клиента: разбор должен работать
 * и до подключения, чтобы «забыл аргумент» стоило ноль обращений к базе.
 *
 * @param {*} db клиент supabase-js ИЛИ узел pg (определяется по наличию .from)
 * @param {string} schoolId
 * @returns {Promise<{id: string, name: string, is_demo: boolean}>}
 */
export async function assertSchoolExists(db, schoolId) {
  let row = null;
  if (db && typeof db.from === "function") {
    const { data, error } = await db.from("schools").select("id, name, is_demo").eq("id", schoolId).maybeSingle();
    if (error) bail([`ОСТАНОВЛЕНО: не удалось проверить школу — ${error.message}`]);
    row = data ?? null;
  } else if (db && typeof db.query === "function") {
    const res = await db.query("SELECT id, name, is_demo FROM public.schools WHERE id = $1", [schoolId]);
    row = res.rows[0] ?? null;
  } else {
    bail(["ОСТАНОВЛЕНО: assertSchoolExists получил неизвестный клиент базы."]);
  }

  if (!row) {
    bail([
      `ОСТАНОВЛЕНО: школы ${schoolId} в базе нет.`,
      "",
      "Известные школы:",
      ...Object.entries(KNOWN).map(([id, name]) => `  ${id}  — ${name}`),
    ]);
  }

  console.log(`Школа: ${row.name} (${row.is_demo ? "демо" : "БОЕВАЯ"}), ${row.id}\n`);
  return row;
}

/** Разбор и проверка одним вызовом — для скриптов, у которых клиент уже есть. */
export async function requireSchool(db, opts = {}) {
  const id = resolveSchoolId(opts);
  await assertSchoolExists(db, id);
  return id;
}
