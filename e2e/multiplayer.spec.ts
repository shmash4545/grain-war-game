import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
const api = "http://localhost:3102";
test("關主與兩座城市：八週即時同步、控場、恢復、訂單、成果 PNG", async ({
  browser,
  page: host,
}, testInfo) => {
  const errors: string[] = [];
  host.on("pageerror", (e) => errors.push(e.message));
  host.on("dialog", (d) => d.accept());
  await host.goto("");
  await host.getByRole("button", { name: /開啟新戰局/ }).click();
  await host.getByRole("button", { name: "多人連線", exact: true }).click();
  await host.getByLabel("房間伺服器網址").fill(api);
  await host.getByRole("button", { name: /建立戰局/ }).click();
  await expect(host.getByText("即時連線", { exact: true })).toBeVisible();
  const code = (await host.locator(".room-ribbon strong").innerText()).trim();
  const contexts = [await browser.newContext(), await browser.newContext()];
  const cities: Page[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const p = await contexts[i].newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("dialog", (d) => d.accept());
      cities.push(p);
      await p.goto("http://localhost:5180/grain-war-game/");
      await p.getByRole("button", { name: "加入多人房間 →" }).click();
      await p.getByLabel("房間伺服器網址").fill(api);
      await p.getByLabel("六位房間碼").fill(code);
      await p.getByRole("button", { name: "查看可加入城市" }).click();
      await p.locator(".city-cards article").nth(i).getByRole("button").click();
      await expect(p.getByText("即時連線", { exact: true })).toBeVisible();
    }
    await host.getByRole("button", { name: /開始第一週/ }).click();
    await expect(
      cities[0].getByRole("heading", { name: /第 1 週/ }),
    ).toBeVisible();
    await expect(host.getByText("糧倉庫存", { exact: true })).toHaveCount(0);
    await expect(
      cities[0].getByRole("heading", { name: /長安城 · 城郊農田/ }),
    ).toHaveCount(0);
    await cities[0]
      .getByRole("button", { name: "播種 · 1 行動" })
      .first()
      .click();
    await expect(
      cities[0].getByRole("button", { name: "照料 · 1 行動" }),
    ).toBeDisabled();
    await host.getByRole("button", { name: "暫停遊戲", exact: true }).click();
    await expect(
      cities[0].getByText("遊戲已暫停，關主恢復後才能繼續操作。"),
    ).toBeVisible();
    await expect(
      cities[1].getByRole("button", { name: /採買糧食/ }),
    ).toBeDisabled();
    await host.getByRole("button", { name: "重開當週" }).click();
    await expect(
      cities[0].getByRole("button", { name: "播種 · 1 行動" }),
    ).toHaveCount(3);
    await host.getByRole("button", { name: "恢復遊戲", exact: true }).click();
    for (let w = 1; w <= 8; w++) {
      for (let i = 0; i < cities.length; i++) {
        const p = cities[i];
        await expect(
          p.getByRole("heading", { name: new RegExp(`第 ${w} 週`) }),
        ).toBeVisible();
        if (w === 5)
          await p
            .getByRole("button", { name: "維持原計畫", exact: true })
            .click();
        if ([4, 7].includes(w))
          await p
            .getByRole("button", {
              name: i === 0 ? "接單" : "婉拒",
              exact: true,
            })
            .click();
        const care = p.getByRole("button", { name: "照料 · 1 行動" });
        if ((await care.count()) && (await care.first().isEnabled()))
          await care.first().click();
        const till = p.getByRole("button", { name: "播種 · 1 行動" });
        if ((await till.count()) && (await till.first().isEnabled()))
          await till.first().click();
        if (w === 3 && i === 0)
          await p.screenshot({
            path: testInfo.outputPath("rain-city.png"),
            fullPage: true,
          });
        await p.getByLabel("正常交付箱數").fill("0");
        if ([4, 7].includes(w) && i === 0)
          await p
            .getByLabel("訂單交付箱數（不計月目標）")
            .fill(w === 4 ? "4" : "6");
        await p.getByRole("button", { name: "確認並鎖定交付" }).click();
        await expect(p.getByText("已鎖定正常交付 0 箱")).toBeVisible();
        if (w === 1 && i === 0) {
          await p.reload();
          await p
            .getByRole("button", { name: "返回房間", exact: true })
            .click();
          await expect(p.getByText("已鎖定正常交付 0 箱")).toBeVisible();
        }
      }
      await host.getByRole("button", { name: "公開本週結果 →" }).click();
      await expect(
        cities[0].getByRole("heading", { name: "已公開週報", exact: true }),
      ).toBeVisible();
      await host.getByRole("button", { name: "下一週／最終結算 →" }).click();
    }
    await expect(
      cities[0].getByRole("heading", { name: "城市總排名與城主鑑定" }),
    ).toBeVisible();
    const downloadPromise = cities[0].waitForEvent("download");
    await cities[0]
      .getByRole("button", { name: "下載成果 PNG ↓" })
      .first()
      .click();
    const download = await downloadPromise;
    const path = testInfo.outputPath("result.png");
    await download.saveAs(path);
    expect(existsSync(path)).toBe(true);
    const png = readFileSync(path);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(1500);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    await cities[0].screenshot({
      path: testInfo.outputPath("final.png"),
      fullPage: true,
    });
    await cities[0].setViewportSize({ width: 390, height: 844 });
    expect(
      await cities[0].evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    for (const c of contexts) await c.close();
  }
});

test("單機模式保留存檔、跨週限制與重開快照", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("");
  await page.getByRole("button", { name: /開啟新戰局/ }).click();
  await page.getByRole("button", { name: /建立戰局/ }).click();
  await page.getByRole("button", { name: /開始第一週/ }).click();
  await page.getByRole("button", { name: "播種 · 1 行動" }).first().click();
  await expect(
    page.getByRole("button", { name: "照料 · 1 行動" }),
  ).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "單機存檔", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "照料 · 1 行動" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "重開當週" }).click();
  await expect(page.getByRole("button", { name: "播種 · 1 行動" })).toHaveCount(
    3,
  );
  await expect(
    page.getByText("遊戲已暫停，關主恢復後才能繼續操作。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "恢復遊戲", exact: true }).click();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: /採買糧食/ }).click();
  await expect(page.getByRole("button", { name: /採買糧食/ })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
