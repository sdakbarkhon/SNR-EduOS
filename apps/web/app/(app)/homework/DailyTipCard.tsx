import { getDailyTip, defaultLocale } from "@snr/core";

// CSS-маскот из domashnie_zadaniya.zip AdviceCard.tsx
function RobotMascot() {
  return (
    <div className="absolute -bottom-6 -right-2 w-32 h-36 transition-transform hover:scale-105 duration-300 pointer-events-none">
      <div className="relative w-full h-full drop-shadow-2xl">
        {/* Тело */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-24 rounded-t-[45px] overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)",
            boxShadow:
              "inset -6px -6px 12px rgba(0,0,0,0.3), inset 6px 6px 12px rgba(255,255,255,0.3)",
          }}
        >
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-blue-400 opacity-40 blur-sm" />
        </div>

        {/* Левая рука */}
        <div
          className="absolute bottom-4 left-2 w-6 h-14 rounded-full origin-top"
          style={{
            background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
            boxShadow:
              "inset -4px -4px 8px rgba(0,0,0,0.2), inset 4px 4px 8px rgba(255,255,255,0.4)",
            transform: "rotate(25deg)",
          }}
        />
        {/* Правая рука */}
        <div
          className="absolute bottom-4 right-2 w-6 h-14 rounded-full origin-top"
          style={{
            background: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
            boxShadow:
              "inset -4px -4px 8px rgba(0,0,0,0.2), inset 4px 4px 8px rgba(255,255,255,0.4)",
            transform: "rotate(-25deg)",
          }}
        />

        {/* Шарф */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-24 h-6 rounded-full z-10"
          style={{
            bottom: "4.2rem",
            background: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
            boxShadow:
              "inset -3px -3px 6px rgba(0,0,0,0.4), inset 3px 3px 6px rgba(255,255,255,0.5), 0 4px 6px rgba(0,0,0,0.2)",
          }}
        />

        {/* Голова */}
        <div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 overflow-hidden"
          style={{
            width: "6.5rem",
            height: "5rem",
            borderRadius: "40px",
            background: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
            boxShadow:
              "inset -8px -8px 16px rgba(0,0,0,0.2), inset 8px 8px 16px rgba(255,255,255,0.5), 0 8px 16px rgba(0,0,0,0.15)",
          }}
        >
          {/* Экран-лицо */}
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 overflow-hidden"
            style={{
              width: "5.5rem",
              height: "3.5rem",
              borderRadius: "25px",
              boxShadow: "inset 0 4px 12px rgba(0,0,0,0.8)",
              border: "1.5px solid rgba(71,85,105,0.5)",
            }}
          >
            {/* Глаз левый */}
            <div
              className="absolute top-1/2 -translate-y-1/2 left-3 w-4 rounded-full bg-cyan-400"
              style={{
                height: "1.3rem",
                boxShadow: "0 0 8px #22d3ee",
              }}
            >
              <div className="absolute top-2 right-1 w-1.5 h-2 bg-white rounded-full opacity-80" />
            </div>
            {/* Глаз правый */}
            <div
              className="absolute top-1/2 -translate-y-1/2 right-3 w-4 rounded-full bg-cyan-400"
              style={{
                height: "1.3rem",
                boxShadow: "0 0 8px #22d3ee",
              }}
            >
              <div className="absolute top-2 right-1 w-1.5 h-2 bg-white rounded-full opacity-80" />
            </div>
            {/* Румянец левый */}
            <div className="absolute bottom-1.5 left-2 w-4 h-2 bg-rose-500 rounded-full opacity-40 blur-[2px]" />
            {/* Румянец правый */}
            <div className="absolute bottom-1.5 right-2 w-4 h-2 bg-rose-500 rounded-full opacity-40 blur-[2px]" />
            {/* Рот */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2.5 bg-slate-800 rounded-b-full overflow-hidden border-t-2 border-slate-700">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-1.5 bg-rose-400 rounded-t-full" />
            </div>
          </div>
        </div>

        {/* Антенна левая */}
        <div
          className="absolute top-1 left-3 w-2 h-6 origin-bottom z-10"
          style={{
            background: "linear-gradient(to right, #a855f7 0%, #7e22ce 100%)",
            transform: "rotate(-20deg)",
            boxShadow:
              "inset -2px 0 4px rgba(0,0,0,0.3), inset 2px 0 4px rgba(255,255,255,0.4)",
            borderRadius: "4px",
          }}
        >
          <div
            className="absolute -top-3 -left-2 w-6 h-6 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, #d8b4fe 0%, #9333ea 70%, #581c87 100%)",
              boxShadow: "0 0 10px rgba(168,85,247,0.4)",
            }}
          />
        </div>
        {/* Антенна правая */}
        <div
          className="absolute top-1 right-3 w-2 h-6 origin-bottom z-10"
          style={{
            background: "linear-gradient(to right, #a855f7 0%, #7e22ce 100%)",
            transform: "rotate(20deg)",
            boxShadow:
              "inset -2px 0 4px rgba(0,0,0,0.3), inset 2px 0 4px rgba(255,255,255,0.4)",
            borderRadius: "4px",
          }}
        >
          <div
            className="absolute -top-3 -left-2 w-6 h-6 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, #d8b4fe 0%, #9333ea 70%, #581c87 100%)",
              boxShadow: "0 0 10px rgba(168,85,247,0.4)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function DailyTipCard({ tipLabel }: { tipLabel: string }) {
  const tip = getDailyTip(defaultLocale);
  return (
    <div
      className="rounded-[20px] border-[1.5px] border-white/80 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] backdrop-blur-2xl overflow-hidden relative p-6"
      style={{ background: "rgba(219,234,254,0.5)" }} // blue-50/50
    >
      <div className="relative z-10">
        <h3 className="text-lg font-semibold text-rose-500 mb-2">{tipLabel}</h3>
        <p
          className="text-sm text-slate-600 font-medium leading-relaxed"
          style={{ maxWidth: "65%" }}
        >
          {tip}
        </p>
      </div>
      <RobotMascot />
    </div>
  );
}
