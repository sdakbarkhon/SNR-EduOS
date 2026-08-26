// ПОДТВЕРЖДЕНИЕ С ЖИВОЙ КЛАВИАТУРЫ. 26.08.2026.
//
// ЗАЧЕМ. Флаг вроде --confirm защищает от опечатки, но не от привычки: он
// дописывается в конец команды один раз и потом ездит вверх по истории
// вместе с ней. Для по-настоящему необратимых действий нужен ввод, который
// нельзя приготовить заранее.
//
// ПОЧЕМУ ПРОВЕРЯЕМ, ЧТО ВВОД ЖИВОЙ. Без проверки подтверждение обходится
// одной строкой: `echo ПЕРЕСОЗДАТЬ ДЕМО ПОЛНОСТЬЮ | node scripts/...`. Тогда
// вся защита сводится к более длинному флагу. Поэтому если ввод не с
// терминала — выход, ничего не делая.

import readline from "node:readline";

/**
 * Просит напечатать точную фразу. Возвращает только при точном совпадении,
 * иначе завершает процесс без единого действия.
 *
 * @param {string} phrase фраза, которую надо напечатать целиком
 */
export async function requireTypedPhrase(phrase) {
  if (!process.stdin.isTTY) {
    console.error(
      "\nОСТАНОВЛЕНО: подтверждение должно вводиться с клавиатуры.\n" +
        "Ввод сейчас идёт не с терминала (конвейер, файл или задание по расписанию),\n" +
        "а такое подтверждение можно заготовить заранее — значит, оно ничего не защищает.\n" +
        "Запустите скрипт вручную в терминале.\n",
    );
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(`\nЧтобы продолжить, напечатайте целиком:  ${phrase}\n> `, (a) => {
      rl.close();
      resolve(a);
    });
  });

  if (answer.trim() !== phrase) {
    console.error("\nОТМЕНЕНО: фраза не совпала. Ничего не изменено.\n");
    process.exit(0);
  }
  console.log("");
}

/**
 * Просит подтвердить действие словом «да». Для обратимых, но заметных
 * операций — применения миграции, пересъёмки снимка.
 *
 * @param {string} question вопрос, который увидит человек
 */
export async function requireYes(question) {
  if (!process.stdin.isTTY) {
    console.error(
      "\nОСТАНОВЛЕНО: нужно подтверждение с клавиатуры, а ввод идёт не с терминала.\n" +
        "Запустите вручную в терминале.\n",
    );
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(`\n${question} (напечатайте «да» для продолжения)\n> `, (a) => {
      rl.close();
      resolve(a);
    });
  });

  const ok = ["да", "yes", "y"].includes(answer.trim().toLowerCase());
  if (!ok) {
    console.error("\nОТМЕНЕНО. Ничего не изменено.\n");
    process.exit(0);
  }
  console.log("");
}
