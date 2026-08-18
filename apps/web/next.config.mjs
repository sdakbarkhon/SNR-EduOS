import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace-пакеты с исходниками на TS компилируются Next напрямую.
  transpilePackages: ["@snr/core", "@snr/ui-tokens"],
  // Server-only парсеры файлов — не бандлим, грузим из node_modules в Node-рантайме.
  serverExternalPackages: ["pdf-parse", "mammoth", "jszip"],
  eslint: {
    // ESLint подключим отдельно; на этапе скаффолда не блокируем сборку.
    ignoreDuringBuilds: true,
  },
  async headers() {
    // App Router's icon.svg convention defaults to max-age=0 (assumes it may
    // change at runtime) — this one is static, so cache it like any other asset.
    return [
      {
        source: "/icon.svg",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, must-revalidate" }],
      },
    ];
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // pptxgenjs (client PPTX export) references node: builtins behind a browser
      // guard. Rewrite the node: scheme to bare names, then stub them out so the
      // client bundle doesn't choke on "Unhandled scheme".
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        os: false,
        path: false,
      };
      // react-pdf/pdfjs-dist probe for node-canvas (server-side rendering
      // fallback) even though we only ever render client-side.
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };

      // СЛОВАРИ: В БРАУЗЕР ЕДЕТ ТОЛЬКО АКТИВНЫЙ ЯЗЫК.
      //
      // packages/core/src/i18n/index.ts статически подключает ru, uz и en и
      // складывает их в один объект — webpack не может выбросить ни один.
      // Замер боевой сборки до подмены: чанк 28922-*.js, 599 447 байт
      // распакованных и 175 063 сжатых, 9 433 русских слова. Это словари
      // ВСЕГО приложения на трёх языках, и приезжали они на каждый экран.
      //
      // Здесь браузерная сборка получает вместо него lib/i18n-lazy.ts:
      // русский статически, узбекский и английский — отдельными чанками, в
      // момент переключения языка.
      //
      // ПОЧЕМУ ПОДМЕНОЙ, А НЕ ПРАВКОЙ ПАКЕТА. Тот же packages/core собирает
      // мобильное приложение, а там ленивость ломает: apps/mobile-parent
      // берёт язык телефона синхронно на первом рендере и сразу зовёт
      // getDictionary — родитель с узбекским телефоном получил бы русский
      // навсегда. И выигрывать в Metro нечего, разделения на чанки там нет.
      // Подмена меняет ровно браузерную сборку и ничего больше.
      //
      // ТОЛЬКО КЛИЕНТ (мы внутри `if (!isServer)`). На сервере словари ничего
      // не стоят: серверная сборка не едет к человеку. Пусть там остаются все
      // три — меньше движущихся частей и никакой разницы между тем, что
      // отрисовал сервер, и тем, что подхватил браузер.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          // Разделитель и слэш, и обратный слэш: на Windows webpack отдаёт
          // путь с обратными, на Linux — с прямыми, а собирается и там, и там.
          /packages[\\/]core[\\/]src[\\/]i18n[\\/]index\.ts$/,
          path.join(HERE, "lib", "i18n-lazy.ts"),
        ),
      );
    }
    return config;
  },
};

export default nextConfig;
