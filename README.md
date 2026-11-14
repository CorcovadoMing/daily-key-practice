# 弓弦的每日音階練習 🎻

一個專為大提琴日常練習與師生課堂設計的 **24 調音階抽籤網站**。

## 功能

- **完整 24 調**：12 個大調、12 個古典旋律小調；旋律小調上行升高第 6、7 級，下行恢復自然小調。
- **依調號篩選**：24 個調性預設全部啟用，可依升降記號分類選取或排除；「全部選取／全部取消」快速調整練習範圍。
- **自由抽選**：分別設定大調與小調要抽的數量，隨機抽出不重複的調性；候選不足時提醒調整。
- **依調號循序練習**：直接練習目前勾選的全部調性，依無升降記號、升記號 1～6、降記號 1～6 的順序排列；不受隨機抽選數量限制。
- **雙向大提琴指板**：上行與下行同時呈現，無須演奏中途切換；可選 1／2 個八度。12 個大調採用逐調核對的 Werner 上行指號，下行對稱反轉；12 個古典旋律小調使用獨立確認的 29 碼序列（上行 15 音＋下行 14 音、不重複最高音）。弦位與把位配色依音高及指型推排，均可個別編輯。
- **指法修改提示**：老師或學生儲存指法後，標題顯示「（已修改）」，修改的音符指號以醒目顏色和淡色背景標示。
- **練習進度**：完成的調性可打勾並顯示完成比例。
- **指板批次直接編輯**：可連續更換同一方向多個音符的弦位及 1～4 指，暫存後一次確認。「上一步」以操作堆疊只撤銷最後一步；「復原選取的修改」僅還原目前選中的粉紅色自訂音位（可再撤銷）；「復原所有修改」只把該方向的指法暫時還原預設，**不會退出編輯模式或立即儲存**；若誤按，可以按「上一步」恢復整批原本的指法，直到按「確認修改」才真正儲存。四個按鈕緊湊並排。點空白處時若有未儲存修改會詢問放棄、儲存或繼續編輯；捲頁不會觸發取消。
- **課堂即時協作指法**：六位數房號連線後，另一位參與者可看見藍色虛線音符選取框與半透明粉紅色的暫存弦位／指號。按確認才正式儲存，且只合併本次更動的音位。教室中已確認的修改也同步保存在每位連線者目前瀏覽器的個人指法紀錄；未完成的草稿不會儲存。
- **版面與即時預覽**：移除頁首重複導覽列，從英文副標題開始；桌面上方左側課堂／設定、右側練習清單，與下方左右兩欄紀錄採一致的欄寬；窄螢幕以單欄顯示。懸浮快速導覽預留右側空間，不遮住指板。音符在編輯中移動弦位時，原位置顯示半透明殘影，課堂其他人也能看見。
- **練習卡片自動摺疊**：預設只展開第一個未完成的調性；標題顯示完整的大調或小調，點標題切換完成狀態後自動前進至下一個未完成項目。右側箭頭可手動摺疊／展開指板。跳轉到任一調時，僅展開指定調的指板。
- **快速跳轉與進度欄**：大螢幕右側的窄浮動清單與練習區下方的快速列，均可點選調性跳轉。已完成以灰色和勾號標示，未完成保留白底。
- **繼續／重現歷史練習**：歷史卡片會把已完成的調性顯示成灰底勾號，並顯示正確的完成比例。未完成的紀錄可按「繼續這次練習」，保留已完成項目，接下來的勾選會直接更新**原本日期的那筆**紀錄；完成全部調性後則改為「重現這次練習」，從零重新練習、但不新增或覆蓋歷史。連線教室期間兩項操作均顯示不支援對話框，需先離開房間。
- **雙欄練習紀錄**：左欄保存個人練習，右欄保存此裝置連線期間收到的課堂抽籤與完成進度。雙方連線時，任一人抽選都會各自在自己的瀏覽器保存。每筆只顯示日期與整點（例如 17 點），可逐筆刪除；既有的每日個人紀錄會自動保留。
- **覆蓋或新增**：重新抽籤、重新開始循序練習時，可選擇覆蓋目前這筆或新增紀錄，同一天可以有多筆紀錄。課堂模式透過相同的房間紀錄識別碼讓在線參與者一致地覆蓋或新增，無須改動 Firebase 資料格式。
- **版本編碼**：實驗版恢復日期加當日流水號格式，並附加實驗標記，例如 `20261106-025-experimental`。

## 實驗版練習工具

- 同列本機節拍器：30–240 BPM、1/2/3/4/6 拍及可選重拍位置（含無重拍）。使用 Web Audio 時鐘排程，再按啟用按鈕即停止收起；切換分頁／鎖屏自動停止。
- Tuner: A4 defaults to 442 Hz (430-450 adjustable). Local microphone analysis, no recording/upload. Stops release tracks; cancellation also releases delayed grants. Both tools may run together. Pitch smoothing uses a five-reading log-frequency moving average, not a claim about Tonal Energy algorithms. No beat gating or beat-synchronized blanking is applied. Metronome sound can still affect readings.
- Left-aligned floating bottom capsule, sized to visible content; expands and contracts smoothly with controls and disables animation for reduced-motion preferences; controls expand inline, not in a popup. Icon buttons stay visible: quarter-note starts the metronome and a stop square stops it; its arrow opens an upward settings popover without stopping playback. Metronome controls are on the left and tuner controls on the right; activating the tuner expands the capsule and pitch bar to the available viewport width. The tuning-fork button controls microphone use; its separate arrow opens an upward A4 settings popover (442 Hz default). Successful recording has no visible status sentence; pending permission and errors remain visible. Only the control area scrolls horizontally on mobile. Bottom content padding preserves access to the footer.
- 驗證：`node --test tests/*.test.cjs`；合成 C2–A5 音訊與瀏覽器模擬通過不等於實際大提琴／手機麥克風驗收。節拍聲、泛音、環境噪音與手機低音收音須實機試用。

## 網站

- **正式版 Stable**：<https://corcovadoming.github.io/daily-key-practice/>
- **實驗版 Experimental**：<https://corcovadoming.github.io/daily-key-practice/experimental/>

實驗版音階譜：各調以低音譜號、兩八度上行接下行共 29 音單列顯示，手機可橫向捲動。低音譜號旁依各調標示調號，只在需要改變音高時顯示臨時升降／還原；同一八度臨時記號在無小節線的練習行內延續，下行正確恢復自然小調，使用十六分音符，四音雙連桿分組，末音雙符尾；不新增拍號或小節線。指板中央顯示既有確認指法或老師／學生自訂指號，0 為空弦、? 為尚未指定；同步與保存格式不變。

### 寬版練習桌（本機候選，尚未發布）

- 抽籤、課堂與音訊工具在練習區上方；五度圈保留原有 24 個候選 ID 與各自選取狀態，F♯ 大調／E♭ 小調保留既有等音調拼寫，不新增調性或變更循序練習排序。
- 練習清單使用整列寬度。五線譜維持至少 960 px 可讀寬度，窄螢幕可用觸控或鍵盤橫向捲動。桌面小調上／下行指板並排；大調只顯示半寬上行，既有下行資料不刪除。手機指板單欄。
- 點調性標題或標題列空白處展開／收合；只有完成圓圈改變完成狀態。筆記按鈕獨立操作，不觸發展開或完成。
- 個人筆記依調性及個人／房間 ID 儲存於此瀏覽器 localStorage，不上傳 Firebase，不是跨裝置或登入學生帳號筆記；共用裝置仍能讀到。筆記只當純文字處理；清空後儲存會移除筆記與高亮。
- 驗證：`node --test tests/*.test.cjs`、`JSDOM_MODULE=/path/to/jsdom node qa/wide-layout.cjs`。DOM 測試不等於 Safari／iPad 視覺及音訊實機驗收。
