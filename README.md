# CampSync

> 多人即時同步的露營裝備與伙食清單管理工具  
> **Live:** [erikhuang76821.github.io/CampSync](https://erikhuang76821.github.io/CampSync/)

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + Vite 7 | SPA 框架 & 建置工具 |
| **Styling** | TailwindCSS 4 | 原子化 CSS |
| **Realtime DB** | Firebase Firestore | 多人即時同步 |
| **Auth** | Firebase Anonymous Auth | 匿名登入取得 UID |
| **Backend** | Google Apps Script (GAS) | Google Sheet CRUD、密碼驗證 |
| **Storage** | Google Sheets | 持久化資料儲存 |
| **Hosting** | GitHub Pages (gh-pages) | 靜態網站部署 |
| **PWA** | manifest.json + meta tags | 安裝至桌面、standalone 模式 |
| **Testing** | Vitest 4 | 單元測試（27 tests） |
| **Icons** | Lucide React | SVG icon 組件 |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (React SPA)                                │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ App.jsx   │  │ logic.js │  │ localStorage     │  │
│  │ (UI+State)│  │ (Pure fn)│  │ (Templates/Auth) │  │
│  └─────┬─────┘  └──────────┘  └──────────────────┘  │
│        │                                            │
│   ┌────┴────┐        ┌─────────┐                    │
│   │ SHA-256 │        │ Debounce│                    │
│   │ Hash PW │        │ (500ms) │                    │
│   └────┬────┘        └────┬────┘                    │
└────────┼──────────────────┼─────────────────────────┘
         │                  │
    ┌────▼────┐        ┌────▼─────────────┐
    │  GAS    │        │  Firestore       │
    │ doGet/  │        │  (Realtime Sync) │
    │ doPost  │        │  Anonymous Auth  │
    └────┬────┘        └──────────────────┘
         │
    ┌────▼────┐
    │ Google  │
    │ Sheets  │
    └─────────┘
```

### Data Flow

1. **登入** → 前端 SHA-256 hash 密碼 → GAS `doGet` 驗證（hash 比對）
2. **寫入** → 前端 state 更新 → Firestore `setDoc` + GAS `doPost`（debounce 500ms）
3. **同步** → Firestore `onSnapshot` 即時推送變更到所有連線用戶
4. **模板** → `localStorage` 快取 + JSON 檔案匯入匯出

---

## Features — Implemented ✅

### Core
- [x] 房間制登入（Room ID + 密碼）
- [x] 多人即時同步（Firestore + GAS 雙通道）
- [x] 裝備清單 CRUD（分類、數量、分配、打勾）
- [x] 伙食清單 CRUD（依天數×餐別矩陣）
- [x] 費用結算（自動計算誰欠誰多少）
- [x] 成員管理（新增、移除、切換使用者）

### 分攤機制
- [x] 逐項設定分攤成員（checkbox toggle）
- [x] 自訂分攤時琥珀色標示（如「2/3 人」）
- [x] 至少保留 1 人參與分攤
- [x] 費用明細頁（付款人、分攤人、每人金額）

### 裝備模板
- [x] 匯出目前裝備為命名模板（localStorage）
- [x] 載入模板覆蓋裝備（食材不受影響）
- [x] 多模板並存管理（載入、刪除）
- [x] JSON 檔案下載（`.json` 格式）
- [x] JSON 檔案上傳匯入（100KB 限制）

### PWA
- [x] `manifest.json`（standalone 模式）
- [x] Apple 裝置 meta tags
- [x] Theme color（Emerald `#047857`）
- [x] App icon（192x192, 512x512）

### 安全性
- [x] 密碼 SHA-256 hash（前端 `crypto.subtle` + GAS `Utilities.computeDigest`）
- [x] localStorage 存 hash（不存明文）
- [x] GAS `doPost` 寫入前驗證密碼
- [x] 舊明文密碼自動遷移至 hash
- [x] GAS URL 移至環境變數（`.env`）
- [x] CSP（Content-Security-Policy）header
- [x] `console.error` 限開發模式
- [x] GAS sync debounce 500ms
- [x] 模板上傳 100KB 限制

### 程式碼品質
- [x] 純邏輯抽離至 `logic.js`（可測試）
- [x] 27 個單元測試（Vitest，< 15ms）
- [x] 未使用 import 清理
- [x] `useRef` 取代 `document.getElementById`
- [x] Emerald 統一色系

---

## Planned — To-Do 📋

### 功能擴展
- [ ] Service Worker（離線支援 / `vite-plugin-pwa`）
- [ ] 裝備照片上傳（Firebase Storage）
- [ ] 匯出費用報表為 PDF / CSV
- [ ] 多語系支援（i18n）
- [ ] 房間歷史紀錄（過往行程回顧）
- [ ] 天氣 API 整合（自動建議裝備）

### 安全性強化
- [ ] Firestore Security Rules 限制（需 Firebase Console 部署）
- [ ] 密碼加鹽（salt + hash）
- [ ] 登入失敗速率限制（GAS 端）
- [ ] JWT Token 取代密碼重傳

### 效能優化
- [ ] React.memo / useMemo 微調
- [ ] 虛擬列表（大量裝備時）
- [ ] GAS 分頁讀取（大資料量）
- [ ] Firestore 欄位級 merge（減少傳輸量）

### DevOps
- [ ] GitHub Actions CI（自動測試 + 部署）
- [ ] Lighthouse CI（效能 / PWA 分數追蹤）
- [ ] E2E 測試（Playwright）

---

## Project Structure

```
CampSync/
├── index.html          # 入口 HTML（PWA meta + CSP）
├── vite.config.js      # Vite 設定（base: /CampSync/）
├── package.json        # 依賴 & scripts
├── .env                # 環境變數（GAS URL）← .gitignore
├── .gitignore
├── GAS.md              # Google Apps Script 後端程式碼
├── public/
│   ├── manifest.json   # PWA manifest
│   ├── icon-192.png
│   └── icon-512.png
└── src/
    ├── main.jsx        # React 入口
    ├── App.jsx         # 主元件（UI + 狀態 + 同步邏輯）
    ├── logic.js        # 純邏輯函式（結算、分攤、模板驗證）
    ├── logic.test.js   # 單元測試（27 tests）
    └── index.css       # TailwindCSS 入口
```

---

## Scripts

```bash
npm run dev      # 開發伺服器
npm run build    # 生產建置
npm run preview  # 預覽生產版本
npm test         # 執行單元測試（vitest run）
```

---

## License

MIT