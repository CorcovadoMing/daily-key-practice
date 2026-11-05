# 今日練什麼調？ 🎻

一個專為**大提琴課**設計的 24 調抽籤網頁：12 個大調 + 12 個**古典旋律小調（Classical Melodic Minor）**。

正式網站：<https://corcovadoming.github.io/daily-key-practice/>

## 功能

- 大調、小調各抽 0～12 個（可使用 1+1、2+2、3+3、6+6 快速設定），單次抽籤不重複。
- 點選調性標記完成、查看練習進度；可選擇顯示音階提示。
- **個人練習模式**：今日清單、完成進度與最近練習歷史保存在本機瀏覽器。
- **課堂同步模式**：老師或學生按「建立同步房間」，得到六位數字（例如 `482731`）；另一人直接在同一個網站輸入這六位數，即可進入同一間房。也可以使用「複製邀請連結」直接加入。
- 共同即時同步：抽籤數量、結果、完成勾選、「顯示音階」設定與**老師的指法註記**；手機與電腦皆可用。
- **目前連線數：**透過 Firebase `onDisconnect` 監測每個已連接的裝置／瀏覽器分頁；一人開兩個分頁會算兩個連線。
- **大提琴指法：**在每個調性下面顯示兩個八度、第一指起的移把位參考指型；老師可以自行填寫上、下行實際弦別、指號與換把位，課堂房間內同步。
- 課堂狀態與個人本機歷史分開，離開房間即返回個人模式。

## 古典旋律小調

- 上行：比自然小調升高第 6、7 級，走到高八度主音。
- 下行：回到**自然小調**，由高八度主音下降至原主音。
- A 小調：上行 `A B C D E F♯ G♯ A`，下行 `A G F E D C B A`。
- C 小調：上行 `C D E♭ F G A B C`，下行 `C B♭ A♭ G F E♭ D C`。

當顯示音階提示時，網站會分別列出上行與下行。十二組音階均使用正確音名拼法（例如 G♯ 旋律小調上行的 F𝄪）。

## 使用六位數課堂房間

1. 雙方打開 <https://corcovadoming.github.io/daily-key-practice/>。
2. 其中一人按 **建立同步房間**，頁面出現六位數房號。
3. 另一人輸入六位數，按 **加入房間**，就會看到同一份抽籤和勾選結果。
4. 任何一方都能抽籤，另一方會即時看到更新。亦可複製邀請連結直接加入。
5. 房間在建立後 **24 小時內可用**；過期後新開一間即可。舊的 32 位十六進位房間連結仍相容。

### 六位數安全取捨

- 六位數只有一百萬種組合，不是高安全性的密碼。**可能被猜中**，因此房間只應存放不敏感的練習清單；不要儲存姓名、電話、帳號或其他個資。
- 「加入房間」不會因輸入錯誤房號而自動建立新房間；建房時使用 Firebase transaction 避免與既有房間碰撞。
- 六位數房間過期後由 Realtime Database **安全規則阻止讀寫**；這**不代表資料會自動刪除**。如需清理過期資料，可在 Firebase Console 移除。
- 不需登入 Google：網站使用 Firebase Anonymous Authentication（匿名驗證）；任何取得有效房號的人均可讀寫該房間。
- 需要網路連線；網路中斷期間無法保證雙向同步。

## Firebase 初次設定（僅專案擁有者執行一次）

網站放在 GitHub Pages，跨裝置同步由 **Firebase Realtime Database + Anonymous Authentication** 提供。

1. 在 <https://console.firebase.google.com/project/daily-key-practice/overview> 開啟 Firebase 專案。
2. 到 **Build → Authentication → Sign-in method** 啟用 **Anonymous**，按 Save。
3. 到 **Build → Realtime Database** 確認資料庫已建立，網址為：
   `https://daily-key-practice-default-rtdb.asia-southeast1.firebasedatabase.app/`
4. **最重要**：到 **Realtime Database → Rules**，將本儲存庫的 [firebase-rules.json](firebase-rules.json) **整份內容**貼上，按 **Publish**。**即使之前貼過舊版規則，也必須重新發布新版**，否則六位數房間會出現 `Permission denied`。
5. Web App 公開設定與 `databaseURL` 已經寫在 [firebase-config.js](firebase-config.js)。**不需要再次修改**。
6. 重新整理網站後，可先用手機與電腦建立 / 加入同一房間測試。

> 資料庫規則只允許匿名認證後存取符合格式的房號、限制新六位數房間使用期限，並阻止整個資料庫的根目錄被公開讀取。六位數仍可能被猜中，因此不應用於敏感內容。

Firebase Web App `apiKey` 是公開的用戶端設定，不是 Firebase Admin 私鑰。**永遠不要提交 Service Account JSON 或管理員私鑰到 GitHub**。

## GitHub Pages 部署

- 本專案為靜態 HTML、CSS、JS，不需 npm build。
- GitHub Repository → **Settings → Pages → Build and deployment → Source → GitHub Actions**。
- 提交到 `main` 後由 `.github/workflows/deploy.yml` 自動部署。

## 檔案

- `index.html` — 大提琴音階抽籤與操作介面。
- `classroom.js` — 即時同步與六位數房間、碰撞保護和過期處理。
- `firebase-config.js` — Firebase Web App 公開設定（包含 databaseURL）。
- `firebase-rules.json` — **必須手動發布到 Firebase Console** 的資料庫安全規則。
- `.github/workflows/deploy.yml` — GitHub Pages 部署。

免費 Spark 方案的 Realtime Database 有使用量限制；兩人上課使用通常遠低於限制。留意 Firebase Console 的 Usage 分頁。
