#!/usr/bin/env node
// Переиспользуемый скрипт применения ОДНОЙ SQL-миграции к hosted Supabase
// напрямую через pg (не Supabase CLI, не Management API — прямое
// подключение к Postgres через SUPABASE_DB_URL из apps/web/.env.local).
//
// node apps/web/scripts/apply-migration.mjs supabase/migrations/162_xxx.sql
//
// Поведение:
//   1) читает SUPABASE_DB_URL из apps/web/.env.local (fs + regex, без dotenv —
//      тот же паттерн, что apps/web/scripts/_backfill-shared.mjs::loadEnvLocal);
//   2) извлекает версию из имени файла — ведущие цифры до первого "_"
//      (тот же формат, что supabase_migrations.schema_migrations.version:
//      сверено живым SELECT — "99", "161", "20260707000070" и т.п.);
//   3) ДО применения — SELECT version FROM schema_migrations WHERE version=X.
//      Если строка уже есть — лог "уже применена, пропускаю", exit 0;
//   4) иначе — BEGIN, выполняет весь файл целиком (см. ниже про BEGIN/COMMIT
//      внутри самого файла), внутри той же транзакции добавляет запись в
//      schema_migrations, COMMIT. Любая ошибка на любом шаге — ROLLBACK,
//      exit 1, вывод текста ошибки, БД без изменений.
//
// Про schema_migrations.version/name/statements — реальная структура таблицы
// (проверено живым SELECT ПЕРЕД написанием этого скрипта, не выдумано):
// ровно три колонки, version text / statements text[] / name text. Колонки
// даты/времени НЕТ вообще (ни inserted_at, ни created_at) — так что "дата
// применения" для уже существующих строк недоступна физически, не только в
// этом скрипте. Существующие строки (97-99 и далее) хранят statements=NULL —
// повторяем этот же паттерн, а не пытаемся реконструировать массив стейтментов
// заново (это отдельная, more involved задача, не нужная для цели скрипта).
//
// Про BEGIN/COMMIT внутри самого файла миграции: некоторые файлы (например
// 164) уже сами оборачивают себя в BEGIN;...COMMIT;, другие (например 162,
// 163) — нет, это просто последовательность top-level стейтментов. Чтобы
// единообразно управлять транзакцией из этого скрипта независимо от стиля
// файла, вырезаем СТРОГО построчные "BEGIN;"/"COMMIT;" (полное совпадение
// строки после trim, без учёта регистра) перед оборачиванием — это НЕ
// затрагивает BEGIN как ключевое слово внутри тела PL/pgSQL-функций
// (`AS $$ BEGIN ... END; $$`), потому что там после BEGIN никогда не идёт
// точка с запятой на той же строке.
//
// Регистрация в schema_migrations делается ВНУТРИ той же транзакции, что и
// сам SQL миграции (перед нашим COMMIT), а не отдельным запросом после —
// это сильнее, чем буквально просили ("после COMMIT"), но правильнее:
// гарантирует, что миграция и её регистрация коммитятся атомарно вместе,
// не могут разойтись, если что-то упадёт между ними.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(WEB_ROOT, ".env.local");
  const text = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function extractVersionAndName(sqlFilePath) {
  const base = path.basename(sqlFilePath, ".sql");
  const m = base.match(/^(\d+)/);
  if (!m) {
    throw new Error(`Не удалось извлечь версию из имени файла "${base}" — ожидались ведущие цифры (формат NNN_description.sql).`);
  }
  return { version: m[1], name: base };
}

// Вырезает построчные top-level "BEGIN;"/"COMMIT;"/"ROLLBACK;", чтобы
// однозначно управлять транзакцией самим скриптом, независимо от того,
// обернул ли автор файл в них сам.
function stripOwnTransactionControl(sql) {
  return sql
    .split("\n")
    .filter((line) => !/^(BEGIN|COMMIT|ROLLBACK);\s*$/i.test(line.trim()))
    .join("\n");
}

async function main() {
  const startedAt = Date.now();
  const sqlFileArg = process.argv[2];
  if (!sqlFileArg) {
    console.error("Использование: node apps/web/scripts/apply-migration.mjs <путь до .sql файла миграции>");
    process.exit(1);
  }

  const sqlFilePath = path.resolve(process.cwd(), sqlFileArg);
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`Файл не найден: ${sqlFilePath}`);
    process.exit(1);
  }

  const { version, name } = extractVersionAndName(sqlFilePath);
  console.log(`[apply-migration] старт: файл=${sqlFilePath} версия=${version} name=${name}`);

  const env = loadEnvLocal();
  if (!env.SUPABASE_DB_URL) {
    console.error("SUPABASE_DB_URL отсутствует в apps/web/.env.local — останавливаюсь.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const existing = await client.query(
      "SELECT version, name FROM supabase_migrations.schema_migrations WHERE version = $1",
      [version],
    );
    if (existing.rows.length > 0) {
      const durationMs = Date.now() - startedAt;
      console.log(
        `[apply-migration] миграция ${version} уже применена (name=${existing.rows[0].name}; дата применения недоступна — в schema_migrations нет колонки времени), пропускаю. (${durationMs} мс)`,
      );
      await client.end();
      process.exit(0);
    }

    const rawSql = fs.readFileSync(sqlFilePath, "utf8");
    const body = stripOwnTransactionControl(rawSql);

    await client.query("BEGIN");
    try {
      await client.query(body);
      await client.query(
        "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ($1, $2, NULL)",
        [version, name],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    }

    const durationMs = Date.now() - startedAt;
    console.log(`[apply-migration] миграция ${version} применена успешно, БД изменена, запись в schema_migrations добавлена. (${durationMs} мс)`);
    await client.end();
    process.exit(0);
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    console.error(`[apply-migration] ОШИБКА при применении миграции ${version} — ROLLBACK выполнен, БД БЕЗ ИЗМЕНЕНИЙ. (${durationMs} мс)`);
    console.error(err.message);
    if (err.detail) console.error("detail:", err.detail);
    if (err.hint) console.error("hint:", err.hint);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

main();
