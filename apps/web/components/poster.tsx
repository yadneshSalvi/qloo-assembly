import { useId } from "react";
import { clsx } from "clsx";
export function Poster({
  variant = "blue-hour",
  className,
  compact = false,
}: {
  variant?: "blue-hour" | "night-garden" | "soft-signal";
  className?: string;
  compact?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <div
      className={clsx(
        "poster",
        `poster-${variant}`,
        compact && "poster-compact",
        className,
      )}
      role="img"
      aria-label={
        variant === "blue-hour"
          ? "Original Blue Hour poster: a coral sun above a midnight blue table, with abstract vinyl grooves."
          : variant === "night-garden"
            ? "Original Night Garden poster: lime leaves and a moon against deep plum."
            : "Original Soft Signals poster: sculptural cobalt sound waves on golden paper."
      }
    >
      <div className="poster-top">
        <span>THE FOLD PRESENTS</span>
        <span>EST. FOR ONE NIGHT</span>
      </div>
      <div className="poster-title">
        {variant === "blue-hour" ? (
          <>
            Blue
            <br />
            <em>hour.</em>
          </>
        ) : variant === "night-garden" ? (
          <>
            Night
            <br />
            <em>garden.</em>
          </>
        ) : (
          <>
            Soft
            <br />
            <em>signals.</em>
          </>
        )}
      </div>
      <svg className="poster-art" viewBox="0 0 500 450" aria-hidden="true">
        <defs>
          <pattern
            id={`grain-${id}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".55" fill="#fff" opacity=".2" />
            <circle cx="4" cy="4" r=".45" fill="#000" opacity=".1" />
          </pattern>
          <clipPath id={`clip-${id}`}>
            <rect width="500" height="450" />
          </clipPath>
        </defs>
        <g clipPath={`url(#clip-${id})`}>
          {variant === "blue-hour" ? (
            <>
              <circle cx="335" cy="145" r="112" fill="#ff7357" />
              <path d="M-45 330Q250 70 545 330V460H-45Z" fill="#dcc6a7" />
              <ellipse cx="250" cy="321" rx="275" ry="96" fill="#173f47" />
              <g fill="none" stroke="#c7d5bf" strokeWidth="1.5" opacity=".75">
                {[45, 65, 86, 107, 129, 151, 174, 198, 222, 247].map((r) => (
                  <ellipse key={r} cx="250" cy="320" rx={r} ry={r * 0.31} />
                ))}
              </g>
              <ellipse cx="250" cy="320" rx="34" ry="11" fill="#ff7357" />
              <path
                d="M88 215v90m-22-72h44m-40-50c-3 35 30 35 29 0"
                fill="none"
                stroke="#f6f1e7"
                strokeWidth="3"
              />
              <path
                d="M385 255v54m-13-55h26l-4-49h-18Z"
                fill="none"
                stroke="#f6f1e7"
                strokeWidth="3"
              />
              <path
                d="M48 430Q250 360 452 430"
                fill="none"
                stroke="#a48d72"
                strokeWidth="2"
              />
            </>
          ) : variant === "night-garden" ? (
            <>
              <circle cx="360" cy="124" r="86" fill="#edc4b6" />
              <path
                d="M260 455Q190 220 70 140M240 450Q300 220 430 180"
                fill="none"
                stroke="#c1ce84"
                strokeWidth="8"
              />
              {[
                [120, 230, -40],
                [170, 300, -25],
                [220, 350, -30],
                [330, 280, 40],
                [370, 220, 50],
                [280, 365, 30],
              ].map(([x, y, r], i) => (
                <ellipse
                  key={i}
                  cx={x}
                  cy={y}
                  rx="37"
                  ry="85"
                  transform={`rotate(${r} ${x} ${y})`}
                  fill={i % 2 ? "#e1d696" : "#a1b57a"}
                />
              ))}
              <path d="M0 430Q250 380 500 430" fill="#8a555e" />
            </>
          ) : (
            <>
              <circle cx="250" cy="275" r="160" fill="#eb754d" />
              <g fill="none" stroke="#234899" strokeWidth="19">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <path
                    key={i}
                    d={`M${85 + i * 40} 450V${220 - i * 20}Q${85 + i * 40} ${65 - i * 6} ${235 + i * 36} ${85 + i * 27}T${490 + i * 30} ${250 + i * 25}`}
                  />
                ))}
              </g>
              <circle cx="85" cy="125" r="22" fill="#f6f1e7" />
            </>
          )}
          <rect width="500" height="450" fill={`url(#grain-${id})`} />
        </g>
      </svg>
      <div className="poster-bottom">
        <span>
          {variant === "blue-hour"
            ? "A LISTENING SUPPER"
            : variant === "night-garden"
              ? "FILM, FOOD & AFTERTHOUGHTS"
              : "RECORDS, CONVERSATION & MAKING"}
        </span>
        <strong>
          14 NOV <i>·</i> 18:30
        </strong>
        <span>PECKHAM, LONDON / 48 PLACES</span>
      </div>
    </div>
  );
}
