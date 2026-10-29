import { useState } from "react";
import { assess } from "./assessment";
import { score, type City } from "./gameEngine";
import { Portrait } from "./Scene";
export function ResultCard({ city }: { city: City }) {
  const a = assess(city),
    s = score(city),
    variant = Math.max(
      0,
      ["精算型", "開拓型", "穩健型", "應變型", "守成型"].indexOf(
        a.main?.name ?? "",
      ),
    ),
    [error, setError] = useState("");
  const download = async () => {
    try {
      const { renderToStaticMarkup } = await import("react-dom/server");
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1500;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#f4f0e4";
      ctx.fillRect(0, 0, 1200, 1500);
      ctx.strokeStyle = "#b9b49a";
      ctx.lineWidth = 3;
      ctx.strokeRect(36, 36, 1128, 1428);
      const text = (
        value: string,
        x: number,
        y: number,
        size = 28,
        color = "#344936",
      ) => {
        ctx.fillStyle = color;
        ctx.font = `${size}px sans-serif`;
        ctx.fillText(value, x, y);
      };
      text("糧戰：雙城經營戰", 80, 110, 30);
      text(`${city.name} · 八週城主紀錄`, 80, 185, 48);
      text(
        `匯出日期 ${new Date().toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })} · 測試版`,
        80,
        235,
        22,
        "#7a806c",
      );
      const blob = new Blob(
          [
            renderToStaticMarkup(
              <Portrait color={a.main?.color} variant={variant} />,
            ),
          ],
          { type: "image/svg+xml" },
        ),
        url = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        ctx.drawImage(img, 75, 270, 370, 400);
      } finally {
        URL.revokeObjectURL(url);
      }
      text(a.main?.name ?? "判定證據不足", 500, 380, 49, a.main?.color);
      text(`次風格：${a.secondary?.name ?? "證據不足"}`, 500, 440, 28);
      text(`象徵聯想：${a.main?.figure ?? "暫不對照"}`, 500, 495, 28);
      text(`總分 ${s.total.toFixed(1)} / 100`, 500, 575, 43);
      const wrap = (value: string, y: number) => {
        let line = "",
          row = y;
        for (const char of value) {
          if (ctx.measureText(line + char).width > 1030) {
            text(line, 80, row, 27);
            row += 43;
            line = "";
          }
          line += char;
        }
        if (line) text(line, 80, row, 27);
        return row + 60;
      };
      text("經營指標", 80, 740, 32);
      text(
        `穩定 ${a.indicators.stability}%　成長投入 ${a.indicators.growth}%　有效事件週 ${a.indicators.adaptation}`,
        80,
        795,
        28,
      );
      let y = 875;
      ctx.font = "27px sans-serif";
      for (const evidence of a.evidence) y = wrap(`• ${evidence}`, y);
      y = wrap(`下一步：${a.advice}`, y + 10);
      text(
        "本卡描述本場城市團隊的決策，不是個人人格或績效診斷。",
        80,
        1400,
        23,
        "#7a806c",
      );
      const png = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(Error("無法輸出圖卡"))),
          "image/png",
        ),
      );
      const link = document.createElement("a");
      link.href = URL.createObjectURL(png);
      link.download = `糧戰-${city.name.replace(/[^\p{L}\p{N}]/gu, "")}-成果.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) {
      setError(`圖卡下載失敗：${(e as Error).message}`);
    }
  };
  return (
    <article className="result-card">
      <div className="card-portrait">
        <Portrait color={a.main?.color} variant={variant} />
      </div>
      <div>
        <div className="eyebrow">本場團隊風格 · 非人格診斷</div>
        <h2>
          {city.name} <small>{s.total.toFixed(1)} 分</small>
        </h2>
        <h3 style={{ color: a.main?.color }}>
          {a.main?.name ?? "判定證據不足"}{" "}
          <small>次風格：{a.secondary?.name ?? "證據不足"}</small>
        </h3>
        <p>象徵聯想：{a.main?.figure ?? "暫不對照歷史人物"}</p>
        <div className="indicator-row">
          <span>穩定 {a.indicators.stability}%</span>
          <span>成長投入 {a.indicators.growth}%</span>
          <span>有效事件週 {a.indicators.adaptation}</span>
        </div>
        {a.evidence.map((e) => (
          <p key={e}>{e}</p>
        ))}
        <p className="advice">下一步：{a.advice}</p>
        <button onClick={download}>下載成果 PNG ↓</button>
        {error && <p role="alert">{error}</p>}
      </div>
    </article>
  );
}
