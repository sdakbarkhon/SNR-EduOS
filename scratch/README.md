# Scratch на своём хостинге — snr-scratch.vercel.app

Официальная сборка [scratch-gui](https://github.com/scratchfoundation/scratch-gui)
5.3.0, развёрнутая отдельным проектом Vercel (`snr-scratch`). Встроена в
платформу как карточка песочницы (всем классам) и как тип этапа урока
(только 1-5 классы, миграция 177).

Почему своя сборка, а не `scratch.mit.edu`: их сервер запрещает показ
редактора в рамке на чужом домене. Из-за этого Scratch в проекте уже
переименовывали в TurboWarp (миграции 68, 69), а потом убрали совсем
(миграция 90).

## Что изменено относительно upstream

Три правки, все — про адрес медиа и лицензию. Логика редактора не тронута.
Точный диф: [`snr-changes.patch`](snr-changes.patch), базовый коммит upstream —
в [`upstream-commit.txt`](upstream-commit.txt).

| Файл | Что и зачем |
|---|---|
| `src/lib/storage.js` | `getAssetGetConfig` отдаёт `${assetHost}/library-assets/<md5>.<ext>` вместо `${assetHost}/internalapi/asset/<md5>.<ext>/get/`. Путь плоский: статика Vercel не отдаёт адрес с хвостовым слэшем. |
| `src/lib/project-fetcher-hoc.jsx` | `assetHost` по умолчанию `/static` вместо `https://assets.scratch.mit.edu`. Путь относительный — работает на любом домене, адрес нигде не зашит. |
| `src/containers/library-item.jsx` | Миниатюры галереи берутся оттуда же. Это ВТОРАЯ точка обращения к CDN Scratch: `assetHost` её не покрывает, ссылка была прописана прямо в компоненте. |
| `src/playground/index.ejs` | Ссылка на исходный код в левом нижнем углу — требование AGPL-3.0 при размещении по сети. |

## Медиа библиотек

1331 файл (786 SVG, 355 WAV, 190 PNG), **53.4 МБ** — спрайты, костюмы, фоны и
звуки. Лежат в `static/library-assets/`, попадают в сборку как есть.

Список хешей собирается из метаданных библиотек в исходниках
(`src/lib/libraries/{sprites,costumes,backdrops,sounds}.json`): у каждой записи
поле `md5ext`, у спрайтов дополнительно вложенные `costumes[]` и `sounds[]`.
Дубли между библиотеками сняты по хешу — отсюда 1331 файл, а не сумма записей.

## Как пересобрать

```bash
git clone --depth 1 --branch develop https://github.com/scratchfoundation/scratch-gui.git
cd scratch-gui
git apply /path/to/snr-changes.patch
# положить медиа в static/library-assets/ (см. выше, список из src/lib/libraries/*.json)
npm install
NODE_ENV=production npm run build
find build -name "*.map" -delete   # 90 МБ карт исходников в проде не нужны
npx vercel deploy --prod           # проект snr-scratch
```

Сборка: ~2 минуты на webpack, итог ~196 МБ (139 МБ код и статика Scratch плюс
53 МБ медиа), 2994 файла. Самый крупный файл — `gui.js`, 17.5 МБ.

## Что важно помнить

- **Защита доступа Vercel.** Новым проектам Vercel включает `ssoProtection` по
  умолчанию — с ней редактор требует вход и не встраивается в рамку. Снята
  через API; при пересоздании проекта снять заново.
- **Заголовков, запрещающих встраивание, быть не должно.** Ни
  `X-Frame-Options`, ни CSP `frame-ancestors` мы не ставим — на этом держится
  вся затея.
- **Сохранение работ детей не реализовано** (см. отчёт от 08.08.2026): для
  него нужен доступ к экземпляру VM, а `window.vm` в сборке не выставлен —
  это уже правка логики редактора, а не адреса медиа.
- **Галерея чужих проектов и вход в аккаунт scratch.mit.edu не работают** и
  работать не будут: они живут на серверах Scratch.

## Грабли выкладки

`npm run build` начинается с `npm run clean`, который **стирает папку `build`
целиком** — вместе с `build/.vercel/project.json`. Если после пересборки просто
запустить `vercel deploy` из `build`, CLI не найдёт привязку и создаст НОВЫЙ
проект с именем папки (`build`), а `snr-scratch.vercel.app` останется на старой
выкладке. Файл привязки нужно класть заново после каждой пересборки:

```json
{"projectId":"prj_xG6GAGA8hrnuBrlxkc1Ya8mnmtKe","orgId":"team_MYpBV2M3L64gwy59SGSL6QCG"}
```
