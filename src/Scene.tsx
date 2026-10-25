import { type City, eventFor } from "./gameEngine";
export function Scene({
  city,
  week = 1,
  compact = false,
}: {
  city?: City;
  week?: number;
  compact?: boolean;
}) {
  const weather = eventFor(week)?.weather ?? "sun";
  const stock = city?.stock ?? 8;
  return (
    <div className={`scene ${weather} ${compact ? "compact" : ""}`}>
      <svg
        viewBox="0 0 800 490"
        role="img"
        aria-label={`${city?.name ?? "青禾城"}微縮村莊：${weather === "rain" ? "下雨" : weather === "wind" ? "微風" : "晴朗"}，糧倉${stock}箱`}
      >
        <defs>
          <linearGradient id="sky" x2="0" y2="1">
            <stop stopColor="#dcebe2" />
            <stop offset="1" stopColor="#f7e9cb" />
          </linearGradient>
          <linearGradient id="earth" x2="0" y2="1">
            <stop stopColor="#a8bd7d" />
            <stop offset="1" stopColor="#7e9a66" />
          </linearGradient>
          <pattern
            id="soil"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 1H10" stroke="#9a754c" strokeWidth="3" />
          </pattern>
          <pattern
            id="water"
            width="25"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 7q6-4 12 0t12 0"
              fill="none"
              stroke="#e5f4e5"
              opacity=".5"
            />
          </pattern>
          <filter id="shadow">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>
        <rect width="800" height="490" rx="22" fill="url(#sky)" />
        <circle className="scene-sun" cx="638" cy="85" r="36" fill="#f4d58c" />
        <path
          d="M0 230L145 59l112 171L362 106l157 124L647 85l153 145"
          fill="#a8bdad"
          opacity=".55"
        />
        <path
          d="M0 231L140 133l130 98L430 158l160 73L743 147l57 84"
          fill="#9bb199"
          opacity=".5"
        />
        <g className="cloud">
          <path
            d="M120 83q0-20 22-18q17-33 40 0q28-3 28 18Z"
            fill="#fffdf2"
            opacity=".8"
          />
          <path
            d="M420 54q0-16 20-15q12-28 33-1q22-1 22 16Z"
            fill="#fffdf2"
            opacity=".6"
          />
        </g>
        <ellipse
          cx="411"
          cy="403"
          rx="280"
          ry="37"
          fill="#4b6741"
          opacity=".16"
          filter="url(#shadow)"
        />
        <path d="M35 324L480 191l298 119-433 165Z" fill="#90c0bb" />
        <path
          className="water-flow"
          d="M35 324L480 191l298 119-433 165Z"
          fill="url(#water)"
        />
        <path d="M111 285L432 165l272 106v35L390 437 111 322Z" fill="#a29162" />
        <path d="M111 285L432 165l272 106-314 130Z" fill="url(#earth)" />
        <path
          d="M270 238L474 321l-20 9-205-82ZM368 213L563 291l-14 7-198-79Z"
          fill="#ded2a5"
        />
        <g className="bridge">
          <path d="M579 316l53-24 45 20-55 26Z" fill="#cdb081" />
          <path
            d="M579 316v-14l53-24v14M622 338v-14l55-24v12"
            fill="none"
            stroke="#886746"
            strokeWidth="5"
          />
        </g>
        <g transform="translate(285 176)">
          <path d="M0 47l61-22 47 20v73l-61 23L0 121Z" fill="#e7d6a5" />
          <path d="M61 25l47 20v73l-47 23Z" fill="#c2a67d" />
          <path d="M-15 49l65-46 78 38-61 25Z" fill="#52725f" />
          <path d="M-15 49l65-22 78 14-61 25Z" fill="#3c5d4d" />
          <path d="M18 70l19-7v20l-19 7ZM72 66l16 7v20l-16-7Z" fill="#7a7c52" />
          <path d="M44 96l17-6v51l-17-7Z" fill="#88724d" />
          <path
            d="M-19 49l86 19 65-26"
            fill="none"
            stroke="#315444"
            strokeWidth="5"
          />
          <path d="M50 11V0" stroke="#315444" strokeWidth="4" />
          <g className="smoke">
            <circle cx="83" cy="-12" r="7" fill="#fff" opacity=".45" />
            <circle cx="87" cy="-28" r="9" fill="#fff" opacity=".3" />
          </g>
        </g>
        <g transform="translate(472 174)">
          <path d="M0 48l48-17 58 25v65l-48 18L0 114Z" fill="#c5a876" />
          <path d="M48 31l58 25v65l-48 18-10-4Z" fill="#a5875c" />
          <path d="M-13 50l45-44 88 43-62 23Z" fill="#9b684c" />
          <path d="M-13 50l59-18 74 17-62 23Z" fill="#81553c" />
          <path d="M12 67l32 14v45l-32-14Z" fill="#88714c" />
          {Array.from({ length: Math.min(8, Math.ceil(stock / 3)) }, (_, i) => (
            <g
              key={i}
              transform={`translate(${65 + (i % 3) * 13} ${91 - Math.floor(i / 3) * 13})`}
            >
              <path
                d="M0 0q-3-8 5-10q8 3 5 10v10H0Z"
                fill="#e2c285"
                stroke="#b29258"
              />
              <path d="M1 1H9" stroke="#aa884d" />
            </g>
          ))}
        </g>
        <g transform="translate(383 252)">
          <path d="M0 18l45-17 42 18v51L44 89 0 69Z" fill="#ded0a4" />
          <path d="M44 0l43 19v51L44 89Z" fill="#bca67a" />
          <path d="M-12 17L26-9l76 24-57 23Z" fill="#56715b" />
          <path
            d="M-13 18l58 19 58-22"
            fill="none"
            stroke="#345442"
            strokeWidth="5"
          />
          <path d="M13 69V47q11-18 23-7v41" fill="#536948" />
          <text x="14" y="32" fill="#6d684b" fontSize="15" fontFamily="serif">
            禾
          </text>
        </g>
        <g transform="translate(211 266)">
          <path d="M0 18l39-15 48 20-41 15Z" fill="#d6c093" />
          <path d="M1 18v36M85 23v36" stroke="#83694c" strokeWidth="4" />
          <path d="M-5 17l40-23 57 27-45 17Z" fill="#cf9470" />
          <path d="M16 9l13-7 57 24-11 4Z" fill="#edc8a0" />
          <path d="M0 50l44 18 42-17v15l-42 17L0 65Z" fill="#aa875b" />
        </g>
        {[
          { x: 186, y: 239, s: 1 },
          { x: 611, y: 260, s: 1.1 },
          { x: 535, y: 194, s: 0.65 },
          { x: 159, y: 301, s: 0.75 },
        ].map((t, i) => (
          <g
            className="scene-tree"
            key={i}
            transform={`translate(${t.x} ${t.y}) scale(${t.s})`}
          >
            <path d="M0 0v43" stroke="#88744c" strokeWidth="7" />
            <path
              d="M0-49L-26 3l13 18 13 6 21-9 8-15Z"
              fill={i % 2 ? "#5f8051" : "#759759"}
            />
            <path d="M0-49L-5 12l5 15 21-9 8-15Z" fill="#486e48" opacity=".5" />
          </g>
        ))}
        {(
          city?.fields ?? [
            { state: "empty" },
            { state: "tilled" },
            { state: "ready" },
          ]
        ).map((f, i) => (
          <g
            key={`${i}-${f.state}`}
            className="scene-field"
            transform={`translate(${271 + i * 72} ${324 + i * 8})`}
          >
            <path d="M0 0l59-22 58 24-59 24Z" fill="#dec58d" />
            <path d="M5 0l54-17 49 19-49 18Z" fill="url(#soil)" />
            {f.state !== "empty" &&
              Array.from({ length: 9 }, (_, j) => (
                <g
                  className="crop"
                  key={j}
                  style={{ animationDelay: `${j * 0.06}s` }}
                  transform={`translate(${24 + (j % 3) * 17 + Math.floor(j / 3) * 7} ${-1 + Math.floor(j / 3) * 5 - (j % 3) * 4})`}
                >
                  <path
                    d="M0 0V-12m0 6q-9-8-8-11q10 2 8 9m0 0q9-10 9-13q-10 4-9 13"
                    fill="none"
                    stroke={f.state === "ready" ? "#d9bd51" : "#67934b"}
                    strokeWidth="3"
                  />
                </g>
              ))}
            <text x="48" y="38" fontSize="11" fill="#756742">
              {String.fromCharCode(65 + i)} 田
            </text>
          </g>
        ))}
        <g className="flag">
          <path d="M401 182v-40" stroke="#6e6c48" strokeWidth="3" />
          <path d="M402 142l28 5-28 9Z" fill="#af6750" />
        </g>
        {weather === "rain" && (
          <g className="rain" stroke="#8aabb1" strokeWidth="2" opacity=".55">
            {Array.from({ length: 38 }, (_, i) => (
              <path key={i} d={`M${(i * 79) % 800} ${(i * 43) % 410}l-9 20`} />
            ))}
          </g>
        )}
        <g className="birds" fill="none" stroke="#758978" strokeWidth="2">
          <path d="M280 88q7-6 14 0q7-6 14 0M314 72q5-4 10 0q5-4 10 0" />
        </g>
      </svg>
      <div className="scene-caption">
        <span>{city?.name ?? "青禾初立"}</span>
        <span>
          {weather === "rain"
            ? "雨落田畝"
            : weather === "wind"
              ? "風過禾浪"
              : "山水相依，禾苗漸長"}
        </span>
      </div>
    </div>
  );
}
export function Portrait({
  color = "#53764c",
  variant = 0,
}: {
  color?: string;
  variant?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 260 280"
      role="img"
      aria-label="原創中式城主剪影"
    >
      <circle cx="130" cy="135" r="105" fill="#e5dfcb" />
      <path d="M17 275q9-90 83-111h60q74 21 83 111" fill={color} />
      <path d="M106 158l24 60 25-60" fill="#eee4cd" />
      <path
        d="M108 166l-24 36 46 17-30 56h-31l20-91M153 166l23 36-46 17 29 56h33l-23-91"
        fill="#203f3d"
        opacity=".4"
      />
      <path
        d="M96 93q1-40 34-40t35 40v47q-7 38-35 42q-30-8-34-42Z"
        fill="#d6b78f"
      />
      <path
        d="M94 99q-13-64 36-64q48 0 38 64l-15-30q-28 16-48 0Z"
        fill="#394944"
      />
      <path d="M92 60l9-30 29-16 29 16 10 30Z" fill={color} />
      <path
        d={`M100 30l-24 ${variant % 2 ? "-10" : "8"}M160 30l24 ${variant % 2 ? "-10" : "8"}`}
        stroke={color}
        strokeWidth="9"
      />
      <path d="M109 111l11-2m21 0 11 2" stroke="#4d4a3d" strokeWidth="3" />
      <path
        d="M119 149q11 6 22 0M131 114l-4 21h8"
        fill="none"
        stroke="#aa8868"
        strokeWidth="2"
      />
      <path
        d="M98 143q5 38 32 62q29-27 34-62q-12 28-34 28t-32-28"
        fill="#394944"
      />
      <path d="M56 230l38 16M168 246l37-16" stroke="#d2bd8b" strokeWidth="4" />
      <circle cx="130" cy="232" r="8" fill="#c4a56b" />
    </svg>
  );
}
