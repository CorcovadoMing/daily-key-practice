# 弓弦的每日音階練習 🎻

一個專為大提琴日常練習與師生課堂設計的 **24 調音階抽籤網站**。

## 功能

- **完整 24 調**：12 個大調、12 個古典旋律小調；旋律小調上行升高第 6、7 級，下行恢復自然小調。
- **依調號篩選**：24 個調性預設全部啟用，可依升降記號分類選取或排除；「全部選取／全部取消」快速調整練習範圍。
- **自由抽選**：分別設定大調與小調要抽的數量，隨機抽出不重複的調性；候選不足時提醒調整。
- **依調號循序練習**：直接練習目前勾選的全部調性，依無升降記號、升記號 1～6、降記號 1～6 的順序排列；不受隨機抽選數量限制。
- **雙向大提琴指板**：上行與下行同時呈現，無須演奏中途切換；可選 1／2 個八度。實驗版 043 採低換把計算預設，大調下行對稱反轉；古典旋律小調上行與自然小調下行共同計算，不重複最高音。原先逐調確認的 Werner 指號與推排弦位另保留為來源資料。弦位與指號均可個別編輯，已儲存修改優先。
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
- Tuner: A4 defaults to 442 Hz (430-450 adjustable). Local microphone analysis, no recording/upload. Stops release tracks; cancellation also releases delayed grants. The tuner and scale practice share one microphone capture. The tuner, metronome and scale practice can each start and stop independently. Pitch smoothing uses a five-reading log-frequency moving average, not a claim about Tonal Energy algorithms. No beat gating or beat-synchronized blanking is applied. Metronome sound can still affect readings.
- Left-aligned floating bottom capsule, sized to visible content; expands and contracts smoothly with controls and disables animation for reduced-motion preferences; controls expand inline, not in a popup. Icon buttons stay visible: quarter-note starts the metronome and a stop square stops it; its arrow opens an upward settings popover without stopping playback. Metronome controls are on the left and tuner controls on the right; activating the tuner expands the capsule and pitch bar to the available viewport width. The tuning-fork button controls microphone use; its separate arrow opens an upward A4 settings popover (442 Hz default). Successful recording has no visible status sentence; pending permission and errors remain visible. Only the control area scrolls horizontally on mobile. Bottom content padding preserves access to the footer.
- **聽音階（實驗）**：展開調性卡，在五線譜下按「開始練習」，照譜慢拉兩個八度上、下行，然後按「停止並看結果」。短暫滑過的音或停頓不計分；額外音可略過，但 29 個譜面音要依序辨識（含原八度及旋律小調上下行差異）。採調音器目前的 A4 基準，每音容許 ±40 音分，不判節奏或運弓。音準圖以譜面順序排列，0¢ 是目標線；實心點是已對上的音，空心圈只顯示本機此刻聽到且可定位到譜格的音。停止後顯示整次最佳配對，未對上的譜格留空。只在前景本機分析，不錄音、不上傳、不寫入完成紀錄；可與調音器和節拍器同時用；手機喇叭的節拍聲仍可能影響收音，遇到誤讀可轉小聲或戴耳機。
- 驗證：`node --test tests/*.test.cjs`；合成 C2–A5 音訊與瀏覽器模擬通過不等於實際大提琴／手機麥克風驗收。節拍聲、泛音、環境噪音與手機低音收音須實機試用。

## 網站

- **正式版 Stable**：<https://corcovadoming.github.io/daily-key-practice/>
- **實驗版 Experimental**：<https://corcovadoming.github.io/daily-key-practice/experimental/>

實驗版音階譜：各調以低音譜號、兩八度上行接下行共 29 音單列顯示，手機可橫向捲動。低音譜號旁依各調標示調號，只在需要改變音高時顯示臨時升降／還原；同一八度臨時記號在無小節線的練習行內延續，下行正確恢復自然小調，使用十六分音符，四音雙連桿分組，末音雙符尾；不新增拍號或小節線。指板中央顯示低換把計算預設或老師／學生自訂指號，0 為空弦、? 為尚未指定；同步與保存格式不變。

### 寬版練習桌（本機候選，尚未發布）

- 抽籤、課堂與音訊工具在練習區上方；五度圈保留原有 24 個候選 ID 與各自選取狀態，F♯ 大調／E♭ 小調保留既有等音調拼寫，不新增調性或變更循序練習排序。
- 練習清單使用整列寬度。五線譜維持至少 960 px 可讀寬度，窄螢幕可用觸控或鍵盤橫向捲動。桌面小調上／下行指板並排；大調只顯示半寬上行，既有下行資料不刪除。手機指板單欄。
- 點調性標題或標題列空白處展開／收合；只有完成圓圈改變完成狀態。筆記按鈕獨立操作，不觸發展開或完成。
- 個人筆記依調性及個人／房間 ID 儲存於此瀏覽器 localStorage，不上傳 Firebase，不是跨裝置或登入學生帳號筆記；共用裝置仍能讀到。筆記只當純文字處理；清空後儲存會移除筆記與高亮。
- 驗證：`node --test tests/*.test.cjs`、`JSDOM_MODULE=/path/to/jsdom node qa/wide-layout.cjs`。DOM 測試不等於 Safari／iPad 視覺及音訊實機驗收。

### 043 實驗版低換把指法

24 調音階及大小調琶音改用獨立標示的低換把計算預設。原 Werner 指號保留為來源資料，不將新路線冒稱原譜。一般手型相鄰指距半音，伸展明確標為「擴增把位」；把位按第一指位置標記。大調音階及所有琶音下行精確反向，小調保留旋律上行／自然下行與共同頂點。已儲存自訂修改優先且資料格式不變，單一自訂音可能使路線不再符合預設手型。

[24 調逐調前後比較、模型範圍與驗證](qa/fingering-043.md)。重算報告：`node qa/fingering-audit.cjs`。一般測試：`node --test tests/*.test.cjs`；DOM 驗證：`JSDOM_MODULE=/path/to/jsdom node qa/fingering-dom.cjs`。未聲稱老師實際拉奏驗收。

### 044 一般手型優先與擴增區段配色

相鄰弦可維持同一一般把位的連續 `0124` 時，優先保持一般手型，不為少一次換把硬用擴增。F 大調兩八度依此改用 G／D 弦第一把位；C 小調一／兩八度以第一把位為基準，必要時明示第一指向後擴增或向前擴增，不把真正伸展誤稱一般半把位。其他調性、F 一八度與所有琶音的弦／指／手型不變。

擴增配色涵蓋同弦同基準位置的整個連續區段，包含空弦（橙色外圈、仍顯示 0），不跨弦傳染。顯示配色和真正伸展音數分開，已有自訂指法仍優先。

[044 現行逐調比較與驗證](qa/fingering-044.md)；[043 原始最少換把報告](qa/fingering-043.md)保留。`node qa/fingering-audit.cjs` 重算現行政策；加 `--minimum-shifts` 重現未套用偏好前的 043 通用物理路線。

### 045 空弦中性與 C 小調修正

所有空弦永遠為中性白色 `0`，不屬任何把位、不顯示把位或擴增色。C 小調兩八度自然下行 D 弦改為 `4（↑）→4→2→1→0`；箭頭是同一第四指向弦枕方向移動半音（音高下降），只有該確認接音使用，任一端點自訂弦／指改動就隱藏。G／F／E♭三音保持同一向後擴增手型。

無特殊音域、接音或擴增理由時優先第一把位。本次 C 小調琶音依此使用低 E♭2 與高 C4 的第一把位2指，D弦1／4向後擴增，下行精確反向。沒有全面改排其他調性；F、C上行及一八度路線不變，原資料和舊報告保留。

[045 現行逐調比較與驗證](qa/fingering-045.md)。

### 046 實際移動與第一把位家族

把換弦、手位基準移動、擴增手型開合都納入相鄰音的移動事件；同一步同時發生只計一次，另列各項及分項總數。同等移動優先第一把位及其擴增；最多多一次事件但明顯更熟悉、且不增加縱向換把／位移時也可採用，再考量穩定手型、同框半音1/2相對3/4、較短位移。不是以把位種類數取代實際移動。保留已確認F/C例外，F最新A弦尾段為擴增124接第四把位12。

[046全部24調、三版同口徑比較、第一把位替代成本](qa/fingering-046.md)。`node qa/movement-audit.cjs` 可重算；舊043、044、045報告保留。`minimum-shifts`與`reviewed-045`政策可重現舊物理路線，`first-family`僅為比較用的熟悉把位優先替代，不自動套到畫面。

### 047 F♯小調兩八度指定弦分組

只針對F♯小調兩八度音階採用已存在的最少移動候選：上行C／G／D／A弦3／3／3／6音（不計頂點則3／3／3／5），下行低G♯2回C弦。每方向事件5→4，但模型手位基準變更較多，非所有指標都變少；另依確認修改F♯小調琶音：D弦同把位1／4，A弦高音1／4間明示必須「換把半音」。一八度音階及其它調性不動。

[047逐音路線與取捨](qa/fingering-047.md)，可用 `node qa/fingering-047.cjs` 重算。

### 20261118-001 已確認四調指法

依語音逐調確認更新 F／降 B／降 E 大調與升 F 小調的兩八度預設，音階和琶音分開套用，保留自訂指法優先及其他調性。包含降 E 音階 B♭3 移至 D 弦、升 F 小調琶音 C♯4 移至 D 弦，指號皆對應實際音高與手型。[修改清單與驗證範圍](qa/fingering-20261118-001.md)。目前只完成這批，並非宣稱 24 調已全部實奏驗收。

The same experimental release modestly increases iOS Safari metronome peak from 0.65 to 0.85 (about +2.3 dB), retaining the volume slider, silence, accents and both audio engines. Other platforms keep existing gain. Synthetic audio checks do not replace on-device listening validation.

### 琶音指板直接編輯

琶音可像音階一樣點音、移弦、選指、批次確認，並支援撤銷、選取／全部還原及離開時儲存或放棄。上下行共用一份琶音指法；音階一／兩八度切換不影響兩八度琶音。琶音使用獨立的本機儲存欄位，不套用或覆寫既有音階自訂資料。20261118-010 教室琶音同步使用獨立確認與草稿資料：確認後同步保存至各裝置的本機琶音指法，未確認的草稿不保存。音階原有資料不變。配套 Firebase 規則已經使用者確認並部署；琶音與音階使用獨立資料區域。

驗證：`node --test tests/*.test.cjs`；`JSDOM_MODULE=/path/to/jsdom node qa/arpeggio-editor.cjs`。DOM 模擬不代表 iOS 實機觸控驗收。
