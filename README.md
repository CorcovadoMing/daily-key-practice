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
- **大提琴指板視覺化：**在每個抽中的調性下方，以 HTML/SVG 畫出四條弦（C–G–D–A）和該音階的音位；點上同時標示音名與演奏順序（1～8 或 1～15）。可切換**上行／下行、1／2 個八度**。古典旋律小調下行自動使用自然小調。
- **老師的實際指法：**可另外填寫上、下行實際弦別、左手指號與換把位；課堂房間內同步。圖中的數字為演奏順序，並非左手指號。
- 課堂狀態與個人本機歷史分開，離開房間即返回個人模式。

## 古典旋律小調

- 上行：比自然小調升高第 6、7 級，走到高八度主音。
- 下行：回到**自然小調**，由高八度主音下降至原主音。
- A 小調：上行 `A B C D E F♯ G♯ A`，下行 `A G F E D C B A`。
- C 小調：上行 `C D E♭ F G A B C`，下行 `C B♭ A♭ G F E♭ D C`。

當顯示音階提示時，網站會分別列出上行與下行。十二組音階均使用正確音名拼法（例如 G♯ 旋律小調上行的 F𝄪）。

## 指板音位圖使用說明

每張抽出的調性卡下方，會顯示四條垂直弦線：**C、G、D、A**（由左到右），最上方是弦枕。每個音階音用一個圓點顯示：

- **圓內數字：**音階的**演奏順序**。第 1 個音從低音開始（下行則從高音開始），第 8 或第 15 個音是終點。
- **圓點旁音名：**實際音名（例如 E♭、F♯）。不同升降記號按所抽的調性正確拼寫。
- **上行／下行：**切換音階方向；古典旋律小調下行會恢復自然小調。
- **1 八度／2 八度：**切換音階音域。此教學圖以各個調性的**最低 C 弦音域內的主音**為起始（C2～B2），延伸最多兩個八度。
- **圖形尺度：**為求易讀，圖中半音的垂直距離是示意，**不是實際指板比例，也不是唯一的換弦方法**。每個音選擇可演奏的較高開放弦、較低指板位置；實際把位與運指請以老師指定為準。

重要：圖上的數字 **1、2、3…** 代表第幾個音，**不是左手第 1、2、3 指**。如需左手指法，請使用每張卡的「記錄／編輯老師的指法」填寫，包括空弦（0）與換把位置。

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
4. **最重要**：到 **Realtime Database → Rules**，將本儲存庫的 [firebase-rules.json](firebase-rules.json) **整份內容**貼上，按 **Publish**。**已設定過舊版規則也必須重新發布**，否則連線人數及共用指法註記可能無法正常同步（Permission denied）。
5. Web App 公開設定與 `databaseURL` 已經寫在 [firebase-config.js](firebase-config.js)。**不需要再次修改**。
6. 重新整理網站後，先用手機和電腦加入同一間房：在線連線應由 1 增為 2；關閉一個分頁後應降回 1。再在其中一端編輯指法，確認另一端的調性卡顯示相同註記。

> 資料庫規則只允許匿名認證後存取符合格式的房號、限制新六位數房間使用期限，並阻止整個資料庫的根目錄被公開讀取。六位數仍可能被猜中，因此不應用於敏感內容。

Firebase Web App `apiKey` 是公開的用戶端設定，不是 Firebase Admin 私鑰。**永遠不要提交 Service Account JSON 或管理員私鑰到 GitHub**。

## GitHub Pages 部署

本專案為純靜態 HTML／CSS／JavaScript，不需編譯。若 GitHub Actions 出現舊 Pages deployment 卡住的錯誤，建議使用官方「由分支發布」：

1. Repository **Settings → Pages → Build and deployment → Source** 選 **Deploy from a branch**。
2. 選擇 **main** 分支、**/(root)** 資料夾，按 **Save**。
3. GitHub Pages 隨後會自動發布該分支的網站，後續推送也會自動更新。

根目錄已新增 `.nojekyll`，避免 Jekyll 處理靜態程式。原本的 `.github/workflows/deploy.yml` 仍留作**手動執行的備援流程**，不再在每次 push 競爭 Pages 部署。

## 檔案

- `index.html` — 大提琴音階抽籤與操作介面。
- `classroom.js` — 即時同步與六位數房間、碰撞保護和過期處理。
- `firebase-config.js` — Firebase Web App 公開設定（包含 databaseURL）。
- `firebase-rules.json` — **必須手動發布到 Firebase Console** 的資料庫安全規則。
- `.nojekyll` — GitHub Pages 分支發布的靜態檔案設定。
- `.github/workflows/deploy.yml` — 可手動執行的備援部署工作流程。

免費 Spark 方案的 Realtime Database 有使用量限制；兩人上課使用通常遠低於限制。留意 Firebase Console 的 Usage 分頁。
