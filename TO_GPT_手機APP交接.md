# TO GPT：《渡》手機 App 化交接文件

> 主公裁示（2026-08-28）：GitHub 倉庫、Pages 部署、手機 App 化，均由 GPT 負責。
> Claude 負責遊戲本體設計、程式與內容。本文件為交接。

## 一、現況

- 倉庫：`C:\Users\USER\Codex專案\ferry`（本機 git，尚未推上 GitHub）
- **純靜態零建置**：`index.html` + `style.css` + `data.js` + `audio.js` + `game.js`，無任何依賴、無建置步驟、根目錄即站點
- 存檔：`localStorage`（key：`du_ferry_save_v1`；音效偏好另存 `du_ferry_sound`）
- 聲音：Web Audio 即時生成（零音檔），瀏覽器規定需使用者手勢後才出聲（已處理）
- 已離線可用（無外部資源、無 CDN、無字型連線）
- `tools/serve.js` 僅本機開發用，與部署無關

## 二、建議路線（首選 A）

### A. PWA（建議）
1. 加 `manifest.webmanifest`：
   - `display: standalone`、`orientation: portrait`
   - `theme_color` / `background_color`：`#f4efe6`（宣紙色）
   - `start_url` 與 `scope` 用**相對路徑** `./`（Pages 子路徑相容）
   - 名稱：`渡`；短名：`渡`
2. 圖示：水墨風「渡」字朱印（朱砂 `#b6512f` 底、宣紙字，或宣紙底朱印字），192/512 兩檔＋maskable
3. Service Worker：cache-first、版本號手動 bump 清舊快取；**絕不可清 localStorage**
4. 部署 GitHub Pages（main 分支根目錄），手機瀏覽器「加入主畫面」即成 App

### B. 上架商店（若主公要求再做）
- Android：TWA（Bubblewrap）包 Pages 網址即可
- iOS：Capacitor 殼；注意 WKWebView 的 localStorage 在殼內是獨立空間

## 三、不可破壞的設計鐵律（詳見 專案憲章.md）

- 全程**無數字無分數**；無連續登入懲罰、無倒數限時、無排行榜、無推播轟炸
  - **請勿加任何推播通知**——「缺席＝留白」是核心設計，提醒推播會毀掉它
- 後果隔日揭曉依賴**本機日期**（`todayStr()` 用 local time），勿改成 UTC
- 更新部署**不得清掉玩家 localStorage 存檔**（SW 快取策略請避開 storage）
- 手機直式單手；動畫全 CSS、已尊重 prefers-reduced-motion，勿加重動畫

## 四、驗收清單

- [ ] 手機可「加入主畫面」，開啟為全螢幕直式
- [ ] 飛航模式離線可完整玩一局
- [ ] 更新版本後，舊存檔（字帖、長卷、連環進度）完好
- [ ] 首次點擊後配樂正常浮現；「音／默」開關記憶正常
- [ ] 真機玩 10 分鐘不發燙
- [ ] Pages 網址回報主公與 Claude（寫回本文件或 README）

## 五、聯絡

- 遊戲邏輯、內容、玩法問題 → 回報主公，由 Claude 處理
- 本文件由 Claude 起草（2026-08-28）

## 六、GPT 發版回報（2026-09-06）

- GitHub 倉庫：https://github.com/chifon2025/ferry
- GitHub Pages：https://chifon2025.github.io/ferry/
- 發布來源：`main` 分支／`/ (root)`
- PWA 基礎提交：`fc6935e`
- 線上驗證：首頁、`manifest.webmanifest`、`sw.js`、192 圖示與 maskable 512 圖示均為 HTTP 200
- 本機離線驗證：停止伺服器後仍可重新開啟；「音／默」偏好在離線重載後保留
- 未代稱完成：手機加入主畫面、真機飛航模式完整一局、真機十分鐘溫度，仍須由實機驗收
