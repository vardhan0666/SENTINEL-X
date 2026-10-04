import {
  useEffect,
  useRef,
  useState,
} from "react";

interface CursorPoint {
  x: number;
  y: number;
}

export default function GlobalTacticalCursor(): React.JSX.Element {
  const cursorRef =
    useRef<HTMLDivElement | null>(null);

  const trailRef =
    useRef<HTMLDivElement | null>(null);

  const ringRef =
    useRef<HTMLDivElement | null>(null);

  const rawPosition =
    useRef<CursorPoint>({
      x: 0,
      y: 0,
    });

  const smoothPosition =
    useRef<CursorPoint>({
      x: 0,
      y: 0,
    });

  const animationFrame =
    useRef<number | null>(null);

  const [visible, setVisible] =
    useState(false);

  const [hovering, setHovering] =
    useState(false);

  const [pressed, setPressed] =
    useState(false);

  const [clickPulse, setClickPulse] =
    useState(0);

  useEffect(() => {
    const updateHoverState = (
      target: EventTarget | null,
    ): void => {
      if (
        !(target instanceof Element)
      ) {
        setHovering(false);
        return;
      }

      const interactive =
        target.closest(
          "button, a, input, textarea, select, [role='button'], [data-cursor-target]",
        );

      setHovering(
        Boolean(interactive),
      );
    };

    const handlePointerMove = (
      event: PointerEvent,
    ): void => {
      rawPosition.current = {
        x: event.clientX,
        y: event.clientY,
      };

      setVisible(true);
      updateHoverState(
        event.target,
      );
    };

    const handlePointerDown = (): void => {
      setPressed(true);
      setClickPulse(
        (value) => value + 1,
      );
    };

    const handlePointerUp = (): void => {
      setPressed(false);
    };

    const handlePointerLeave = (): void => {
      setVisible(false);
    };

    const handlePointerEnter = (): void => {
      setVisible(true);
    };

    const animate = (): void => {
      const target =
        rawPosition.current;

      const current =
        smoothPosition.current;

      current.x +=
        (target.x - current.x) *
        0.19;

      current.y +=
        (target.y - current.y) *
        0.19;

      if (cursorRef.current) {
        cursorRef.current.style.transform =
          `translate3d(${current.x}px, ${current.y}px, 0)`;
      }

      if (ringRef.current) {
        ringRef.current.style.transform =
          `translate3d(${current.x}px, ${current.y}px, 0)`;
      }

      if (trailRef.current) {
        trailRef.current.style.transform =
          `translate3d(${current.x}px, ${current.y}px, 0)`;
      }

      animationFrame.current =
        requestAnimationFrame(
          animate,
        );
    };

    document.body.style.cursor =
      "none";

    document.documentElement.style.cursor =
      "none";

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      { passive: true },
    );

    window.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    window.addEventListener(
      "pointerup",
      handlePointerUp,
    );

    window.addEventListener(
      "pointerleave",
      handlePointerLeave,
    );

    window.addEventListener(
      "pointerenter",
      handlePointerEnter,
    );

    animationFrame.current =
      requestAnimationFrame(
        animate,
      );

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      );

      window.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );

      window.removeEventListener(
        "pointerup",
        handlePointerUp,
      );

      window.removeEventListener(
        "pointerleave",
        handlePointerLeave,
      );

      window.removeEventListener(
        "pointerenter",
        handlePointerEnter,
      );

      document.body.style.cursor =
        "";

      document.documentElement.style.cursor =
        "";

      if (
        animationFrame.current !==
        null
      ) {
        cancelAnimationFrame(
          animationFrame.current,
        );
      }
    };
  }, []);

  return (
    <>
      <style>
        {`
          @keyframes sxCursorRotate {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          @keyframes sxCursorRotateReverse {
            from {
              transform: rotate(360deg);
            }

            to {
              transform: rotate(0deg);
            }
          }

          @keyframes sxCursorPulse {
            0% {
              transform: scale(.65);
              opacity: .75;
            }

            100% {
              transform: scale(2.7);
              opacity: 0;
            }
          }

          @keyframes sxCursorSweep {
            0% {
              transform: rotate(0deg);
            }

            100% {
              transform: rotate(360deg);
            }
          }

          @keyframes sxCursorBlink {
            0%,
            100% {
              opacity: .25;
            }

            50% {
              opacity: 1;
            }
          }

          @keyframes sxCursorLock {
            0% {
              transform: scale(.9);
              opacity: .35;
            }

            50% {
              transform: scale(1.04);
              opacity: .8;
            }

            100% {
              transform: scale(.9);
              opacity: .35;
            }
          }

          .sx-cursor-no-pointer,
          .sx-cursor-no-pointer * {
            cursor: none !important;
          }
        `}
      </style>

      <div
        ref={trailRef}
        className={`pointer-events-none fixed left-0 top-0 z-[10000] hidden md:block ${
          visible
            ? "opacity-100"
            : "opacity-0"
        }`}
        style={{
          transition:
            "opacity 180ms ease",
        }}
        aria-hidden="true"
      >
        <div
          className={`-translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-300 ${
            hovering
              ? "h-16 w-16 border-emerald-300/10"
              : "h-20 w-20 border-emerald-400/[0.035]"
          }`}
        />
      </div>

      <div
        ref={ringRef}
        className={`pointer-events-none fixed left-0 top-0 z-[10001] hidden md:block ${
          visible
            ? "opacity-100"
            : "opacity-0"
        }`}
        style={{
          transition:
            "opacity 120ms ease",
        }}
        aria-hidden="true"
      >
        <div
          className={`relative -translate-x-1/2 -translate-y-1/2 transition-transform duration-150 ${
            pressed
              ? "scale-[0.82]"
              : hovering
                ? "scale-[1.16]"
                : "scale-100"
          }`}
        >
          {/* Main targeting ring */}
          <div
            className={`absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
              hovering
                ? "border-emerald-200/60"
                : "border-emerald-300/45"
            }`}
            style={{
              animation:
                "sxCursorRotate 3.5s linear infinite",
              borderTopColor:
                hovering
                  ? "rgba(255,255,255,.9)"
                  : "rgba(125,255,180,.8)",
              borderRightColor:
                "transparent",
            }}
          />

          {/* Secondary reverse ring */}
          <div
            className="absolute left-1/2 top-1/2 h-[38px] w-[38px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.12]"
            style={{
              animation:
                "sxCursorRotateReverse 5s linear infinite",
              borderLeftColor:
                "rgba(100,255,160,.45)",
              borderBottomColor:
                "transparent",
            }}
          />

          {/* Outer segmented HUD */}
          <div
            className={`absolute left-1/2 top-1/2 h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 rounded-full border ${
              hovering
                ? "border-emerald-300/25"
                : "border-emerald-300/10"
            }`}
            style={{
              animation:
                "sxCursorRotateReverse 7s linear infinite",
              borderTopStyle:
                "dashed",
              borderBottomStyle:
                "dashed",
            }}
          />

          {/* Tactical brackets */}
          <div
            className={`absolute -left-1 -top-1 h-3 w-3 border-l border-t transition-all duration-200 ${
              hovering
                ? "border-emerald-100"
                : "border-emerald-300/80"
            }`}
          />

          <div
            className={`absolute -right-1 -top-1 h-3 w-3 border-r border-t transition-all duration-200 ${
              hovering
                ? "border-emerald-100"
                : "border-emerald-300/80"
            }`}
          />

          <div
            className={`absolute -bottom-1 -left-1 h-3 w-3 border-b border-l transition-all duration-200 ${
              hovering
                ? "border-emerald-100"
                : "border-emerald-300/80"
            }`}
          />

          <div
            className={`absolute -bottom-1 -right-1 h-3 w-3 border-b border-r transition-all duration-200 ${
              hovering
                ? "border-emerald-100"
                : "border-emerald-300/80"
            }`}
          />

          {/* Center crosshair */}
          <div className="absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2">
            <div className="absolute left-1/2 top-0 h-1.5 w-px -translate-x-1/2 bg-emerald-200/80" />
            <div className="absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-emerald-200/80" />
            <div className="absolute left-0 top-1/2 h-px w-1.5 -translate-y-1/2 bg-emerald-200/80" />
            <div className="absolute right-0 top-1/2 h-px w-1.5 -translate-y-1/2 bg-emerald-200/80" />

            {/* Diamond */}
            <div
              className={`absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border transition-all duration-150 ${
                hovering
                  ? "border-white bg-emerald-300 shadow-[0_0_18px_rgba(100,255,160,.95)]"
                  : "border-emerald-100 bg-emerald-400 shadow-[0_0_12px_rgba(100,255,160,.75)]"
              }`}
            />
          </div>

          {/* Rotating scanner arc */}
          <div
            className="absolute left-1/2 top-1/2 h-[70px] w-[70px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent border-r-white/60"
            style={{
              animation:
                "sxCursorSweep 1.8s linear infinite",
            }}
          />

          {/* Hover acquisition corners */}
          {hovering && (
            <>
              <div
                className="absolute -left-4 -top-4 h-4 w-4 border-l-2 border-t-2 border-emerald-200"
                style={{
                  animation:
                    "sxCursorLock 1.1s ease-in-out infinite",
                }}
              />

              <div
                className="absolute -right-4 -top-4 h-4 w-4 border-r-2 border-t-2 border-emerald-200"
                style={{
                  animation:
                    "sxCursorLock 1.1s ease-in-out infinite",
                }}
              />

              <div
                className="absolute -bottom-4 -left-4 h-4 w-4 border-b-2 border-l-2 border-emerald-200"
                style={{
                  animation:
                    "sxCursorLock 1.1s ease-in-out infinite",
                }}
              />

              <div
                className="absolute -bottom-4 -right-4 h-4 w-4 border-b-2 border-r-2 border-emerald-200"
                style={{
                  animation:
                    "sxCursorLock 1.1s ease-in-out infinite",
                }}
              />
            </>
          )}

          {/* Micro telemetry labels */}
          <div className="absolute left-[31px] top-[-23px] whitespace-nowrap font-mono text-[6px] tracking-[0.2em] text-emerald-700">
            S-X / {hovering ? "LOCK" : "TRACK"}
          </div>

          <div className="absolute left-[31px] top-[31px] whitespace-nowrap font-mono text-[5px] tracking-[0.16em] text-emerald-900">
            {Math.round(
              smoothPosition.current.x,
            )
              .toString()
              .padStart(4, "0")}
            :
            {Math.round(
              smoothPosition.current.y,
            )
              .toString()
              .padStart(4, "0")}
          </div>

          <div className="absolute left-1/2 top-[39px] h-px w-5 -translate-x-1/2 bg-emerald-300/20" />

          {/* Click pulse */}
          <div
            key={clickPulse}
            className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80"
            style={{
              animation:
                "sxCursorPulse .55s ease-out forwards",
            }}
          />
        </div>
      </div>

      {hovering && (
        <div
          className="pointer-events-none fixed bottom-5 right-5 z-[9999] hidden md:block"
          aria-hidden="true"
        >
          <div className="flex items-center gap-2 rounded-md border border-emerald-900/70 bg-black/70 px-3 py-2 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>

            <span className="font-mono text-[8px] tracking-[0.18em] text-emerald-300">
              TARGET ACQUIRED
            </span>
          </div>
        </div>
      )}

      <div
        className="pointer-events-none fixed bottom-5 left-5 z-[9999] hidden md:block"
        aria-hidden="true"
      >
        <div className="flex items-center gap-2 font-mono text-[7px] tracking-[0.2em] text-emerald-950">
          <span
            className="h-1 w-1 rounded-full bg-emerald-400"
            style={{
              animation:
                "sxCursorBlink 1.2s ease-in-out infinite",
            }}
          />

          CURSOR / S-X TACTICAL INTERFACE
        </div>
      </div>
    </>
  );
}