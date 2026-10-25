# 糧戰：雙城經營戰

React + TypeScript + Vite 的繁體中文策略遊戲第一版。以 CSS 幾何圖形呈現輕量中式 Low Poly 村莊，不載入圖片或外部字型。

## 啟動與預覽

需要 Node.js 22 或更新版本（已於 Node 24 驗證）。

```sh
cd /workspace/grain-war-game
npm ci --cache /tmp/grain-npm-cache
npm run dev -- --port 5173
```

在自己的開發電腦開啟瀏覽器 `http://localhost:5173`；在雲端工作區請使用平台提供的 5173 連接埠轉送（若平台支援），或下載專案後在本機執行上述指令。

```sh
npm test
npm run build
npm run preview -- --port 4173
```

`dist/` 可部署至任意靜態網站服務，無後端或環境變數需求。開發與預覽伺服器監聽所有介面，對外公開前請使用平台的存取控制。

## 可操作流程

首頁 → 規則逐步教學 → 關主設定 2–6 城與名稱 → 大廳開始 → 切換城市輪流操作 → 各城提交 → 關主公開週報 → 手動推進 → 第 4、8 週月結 → 八週排名與完整行動復盤。

每城起始 8 箱、三塊同規則農田；每週通常四次行動、採買每次兩箱且最多兩次；開墾後照料，下一週週初自動收成七箱。每週基本交付六箱，允許不足及超額交付；提交立即扣庫存並鎖定。月底目標 32 / 44 箱，交付不消耗行動。未使用行動不跨週累積。第八週完成照料的田不再產生第九週收成，只計入暫行未來產能。

存檔自動保存在目前瀏覽器 localStorage，重新整理可恢復；建立新局需確認並覆蓋。不同瀏覽器、網址或裝置不共享存檔。瀏覽器清除資料會遺失存檔。

## 規則與架構

- `src/gameConfig.ts`：所有參數、城市預設名稱、固定教學事件與暫行計分權重。
- `src/gameEngine.ts`：獨立純函式處理行動、提交、揭曉、收成、推進、月目標及計分，不依賴 React 或瀏覽器。
- `src/main.tsx`：頁面、同機輪流操作、存檔與復盤。
- `src/gameEngine.test.ts`：2–6 城八週流程、非法操作、限次採買、重複提交、跨週收成、缺交翻身、月結分帳與事件。

### 測試版規則，尚未平衡

事件在週初收成後生效，所有城市一致：第 3 週行動降為三次、第 6 週採買每次三箱、第 7 週行動增為五次。這些是可替換的教學例子。

暫行計分（滿分 100）：

- 月目標：兩月各自達成比例（各封頂 100%）平均乘 35。
- 超額：八週交付超過 48 箱的部分，最多計 24 箱，比例乘 25。
- 儲備產能：期末庫存加每塊非空田 3 箱等值，最多計 20 箱，比例乘 25。
- 韌性：15 減每週缺交合計，每箱扣 1，最低 0。缺交不淘汰。

各上限、權重與等值均集中於 gameConfig，尚待實際試玩校準。

## 與完整規格的差異／下一步

本次依需求先完成單機原型，**不是多人正式版**。所有城市共用同一操作端，切換可見各城資料；沒有房間碼、身分授權或安全隔離。localStorage 可被使用者修改，不應用於正式競賽。伺服器權威狀態、資料庫、權杖、原子交易與斷線同步留待下一階段。

尚未實作：暫停／重開回合、臨時訂單、可插拔隨機卡池、城主風格鑑定、PNG 圖卡、正式人物美術。這些不以假資料模擬已完成。

待確認：正式配分與缺交扣分、期末產能估值、訂單履約時點與分數、事件平衡、多人操作權轉讓方式、風格證據門檻及素材授權。

## 本次驗證紀錄

- `npm test`：14 個引擎測試通過。
- `npm run build`：TypeScript 與正式建置通過。
- 使用系統 Chromium + Playwright 實際操作：六城開局、逐步教學、八週逐城開墾／照料／提交、月結、最終排名、第一週提交後重新整理恢復、390px 手機版無橫向溢位；無瀏覽器執行錯誤。此為本次實際執行的煙霧驗證，未將臨時瀏覽器工具加入專案依賴。

## GitHub Pages 預覽／部署

部署不會改動儲存庫的公開／私有狀態。請先確認 GitHub 帳號方案支援私有儲存庫的 Pages，並確認可接受網站對外公開。**儲存庫私有並不代表 Pages 網站私有**；本原型不可放入敏感資料。

1. 在 GitHub 開啟 `shmash4545/grain-war-game` → **Settings → Pages**。
2. 在 **Build and deployment → Source** 選 **GitHub Actions**。如果因方案無法啟用，請升級適用方案或另選支援私有來源的託管平台；不必將儲存庫改成公開。
3. 若 Actions 被停用，至 **Settings → Actions → General** 允許本流程使用的 GitHub 官方 Actions。若組織政策限制 Actions 或部署，需由管理員允許。
4. 合併部署 PR 到 `main` 後，至 **Actions → Validate and deploy GitHub Pages** 查看建置與部署結果。也可選 `main` 後使用 **Run workflow** 手動部署。
5. 如 `github-pages` 環境要求核准，在該次執行中批准部署，並確認 **Settings → Environments → github-pages** 允許 `main` 部署。
6. 成功後在 **Settings → Pages → Visit site** 或 Actions 的 deployment URL 開啟網站。預期網址為 `https://shmash4545.github.io/grain-war-game/`；請以 GitHub 顯示的 URL 為準，設定完成前該網址可能不存在。

PR 只執行測試與建置；**不會替每個 PR 建立預覽網址**。正式 Pages 部署只在 `main` 的 push 或手動執行時進行，且只授予部署工作 `pages: write`、`id-token: write`。不需要新增 token 或其他 secrets。

`vite.config.ts` 預設 base 為 `/grain-war-game/`。如使用不同名稱的儲存庫，需同步更新 base 與 workflow 的 `BASE_PATH`。如設定自訂網域，改為 `/`。此版無前端深層路由，不需要 SPA 404 回退設定。

加入 base 後，開發網址為 `http://localhost:5173/grain-war-game/`，正式建置本機預覽則為 `http://localhost:4173/grain-war-game/`。舊版根路徑的啟動說明請加上此子路徑。

### Private 儲存庫的限制

- 一般 GitHub Free／Free for organizations 的 Pages 適用於公開儲存庫；私有儲存庫通常需要 GitHub Pro、Team 或 Enterprise 等支援方案。
- 一般私有來源的 Pages 網站仍可公開瀏覽。網站存取控制是額外企業功能，需符合 GitHub Enterprise Cloud 等條件；不應假設登入 GitHub 才能進入。
- 私有儲存庫執行 Actions 可能消耗帳號方案內的執行分鐘數／儲存配額。
- GitHub Pages 僅提供靜態檔案。本版 localStorage 可正常使用，但不同網址的存檔互不共用；未來多人同步需要另外的後端服務。
- 方案、用量及組織限制可能調整，請以帳號的 Settings → Pages 與 GitHub 官方文件為準。

官方說明：
- https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site
