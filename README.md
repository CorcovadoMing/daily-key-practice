# 今日練什麼調？ 🎹

手機友善的 24 調練習抽籤器：12 個大調 + 12 個 **Jazz Melodic Minor（爵士旋律小調）**。

## 功能

- 設定大調、小調各抽 0–12 個，內建 1+1、2+2、3+3、6+6 快速設定。
- 隨機抽選：同一調式內不重複；完成後可勾選，觀看進度與音階提示。
- 個人模式：當日清單與近 7 次練習紀錄只保存在這台瀏覽器的 localStorage。
- **課堂同步模式（Firebase 設定後啟用）：**建立房間、複製邀請網址給老師；兩人即時共享抽籤數量、結果、完成勾選與顯示音階開關。刷新網頁會恢復相同房間清單。
- 課堂模式的資料不會自動寫入兩端的個人練習歷史。

### 旋律小調的定義

使用爵士旋律小調：相對自然小調升高第 6、7 音，上行和下行都保持相同的音。
例如：C D E♭ F G A B（C Melodic Minor）。

不是古典旋律小調「下行還原自然小調」的版本。G♯ Melodic Minor 的第七音是 F𝄪（重升 F，等音 G），避免把七個音階級數的字母寫錯。

## 網站部署

靜態檔可直接放在 GitHub Pages，無須 build：

1. Repository **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
2. Actions 執行 `Deploy website to GitHub Pages`。
3. 網址：<https://corcovadoming.github.io/daily-key-practice/>。

純個人模式不需要 Firebase，離線打開本機 `index.html` 也可以使用。

## 啟用老師與學生即時同步

因為 GitHub Pages 不能儲存兩個瀏覽器之間的共用狀態，需配置 **Firebase Authentication（Anonymous）** 和 **Firebase Realtime Database**。不需要讓老師註冊或登入帳號。這段設定由 Firebase 專案擁有者完成一次。

1. 到 <https://console.firebase.google.com/> 建立 Firebase 專案。
2. 在專案設定中新增 **Web App**（`</>` 圖示），取得 `firebaseConfig` 的公開設定物件。
3. 在 **Build → Realtime Database** 建立 Database，記下 **databaseURL**。**不要啟用公開測試規則**；使用下面指定的安全規則。
4. 到 **Authentication → Sign-in method** 開啟 **Anonymous** 登入。
5. 到 Realtime Database 的 **Rules** 分頁，將本 Repository 的 [firebase-rules.json](./firebase-rules.json) **內容貼上並 Publish**。這些規則只開放已匿名認證、且擁有難以猜測房間 ID 的訪客讀寫各自的房間，不開放整個資料庫任意讀寫。
6. 修改 Repository 根目錄 [firebase-config.js](./firebase-config.js)，將 `null` 改為 Firebase Console 提供的 Web App 設定物件（記得包含 `databaseURL`），例如：

   ```js
   window.DAILY_KEY_FIREBASE_CONFIG = {
     apiKey: "your-public-web-api-key",
     authDomain: "your-project.firebaseapp.com",
     databaseURL: "https://your-db.REGION.firebasedatabase.app",
     projectId: "your-project",
     appId: "your-app-id"
   };
   ```

7. Commit 修改後，GitHub Pages 自動部署。開啟網站，點 **建立同步房間** → **複製邀請連結** → 傳給老師。老師只需點開連結，兩邊都可以抽籤、勾選完成及修改數量。你也能在不同瀏覽器或手機測試。

### 課堂模式的安全與限制

- 房間使用加密安全亂數產生的 **128-bit 房間識別碼**，放在網址的 `#room=...` 後面；這是分享型存取憑證，**有連結的人就能查看與修改房間內容**，只傳給信任的人。
- Firebase Web App 設定中的 `apiKey` 是設計上可公開的用戶端識別資訊，**絕對不要在 Repository 中放 Firebase Admin 私鑰、Service Account JSON 或任何秘密金鑰**。
- 房間資料會持續保留在 Firebase，直到專案擁有者刪除；這版尚未提供自動到期與房主權限管控。
- 雙方都需連上網路；離線期間不保證同步。課堂已在使用時不應把資料庫規則改為公開。
- Firebase 專案仍有配額和可能的收費限制，請在 Firebase Console 設定使用量警示。若有人取得房間連結，可能干擾該房間的練習結果。

## 檔案

- `index.html`：UI、24 調及個人練習功能
- `classroom.js`：Firebase 匿名登入、加入房間、Realtime Database 同步
- `firebase-config.js`：公開 Web App 設定（需要自行填入）
- `firebase-rules.json`：需要貼到 Firebase Realtime Database Console 的安全規則
- `.github/workflows/deploy.yml`：GitHub Pages 部署設定

Firebase JS SDK 使用 Google 官方 CDN，僅同步模式啟用時載入。
