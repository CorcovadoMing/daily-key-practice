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
- Tuner: A4 defaults to 442 Hz (430-450 adjustable). Local microphone analysis, no recording/upload. Stops release tracks; cancellation also releases delayed grants. The tuner and score practice share one microphone capture. The tuner, metronome and score practice can each start and stop independently. Pitch smoothing uses a five-reading log-frequency moving average, not a claim about Tonal Energy algorithms. No beat gating or beat-synchronized blanking is applied. Metronome sound can still affect readings.
- Left-aligned floating bottom capsule, sized to visible content; expands and contracts smoothly with controls and disables animation for reduced-motion preferences; controls expand inline, not in a popup. Icon buttons stay visible: quarter-note starts the metronome and a stop square stops it; its arrow opens an upward settings popover without stopping playback. Metronome controls are on the left and tuner controls on the right; activating the tuner expands the capsule and pitch bar to the available viewport width. The tuning-fork button controls microphone use; its separate arrow opens an upward A4 settings popover (442 Hz default). Successful recording has no visible status sentence; pending permission and errors remain visible. Only the control area scrolls horizontally on mobile. Bottom content padding preserves access to the footer.
- **調音器 A/B（實驗）**：在原 A4 設定旁切換「現有偵測」與「SwiftF0」，共用同一麥克風、A4 基準和音準顯示。SwiftF0 首次使用需下載固定版本的模型與執行環境，載入失敗會提示，不會偷偷切回現有演算法。音訊只在本機分析。SwiftF0 偶爾會把泛音較強的低音估高八度；只有波形的兩個半週期持續有差、合起來更能重複時才校正，不用譜面猜音。
- **共用音高偵測（實驗）**：調音器、音階與琶音的「智慧」使用同一套 SwiftF0 與泛音修正，預設智慧，各自記住手動選擇。調音器平滑最新音高，練習逐幀對譜，因此顯示時機不必相同。A4 由調音器設定。
- **音準走勢（實驗）**：練完可在原本譜位音準圖下展開「音準走勢」，橫軸為實際經過時間，縱軸是相對譜音的音分，空白不補線。最多保留本次末段約兩分鐘，只在頁面記憶體存數值，不保存原始收音或上傳。若同一譜位有足夠的連續資料，可在本機練習建議中使用簡短的音高前後段摘要，不據此推斷弓法、姿勢或節奏。
- **聽音階與琶音（實驗）**：各調性卡分區顯示五線譜、收音練習及指板。按「開始練習」後，音階先以中性色示意下一個譜位，辨識到該音後以調音器同樣的綠、黃、紅色標示音準（±10¢、±20¢、超過 ±20¢）。依譜順序判定，原八度音準固定容許 ±50¢（含邊界），不判節奏、運弓或自動勾選練完；短滑音與停頓不計分，額外音可略過。較短的練習收音視窗可更快追蹤音符，低音判定另比對泛音與基音的週期，避免把有足夠低音證據的 F2 判成 F3。調音器使用原本較長的收音視窗，兩者仍可和節拍器同時用。
- **音階與琶音偵測（實驗）**：音階及琶音的「開始練習」旁可選「傳統」或「智慧」，未選過時用智慧（SwiftF0），兩項各自保存選擇，不影響調音器。SwiftF0 準備完成後才開始判定，需多約 0.18 秒音訊確認；手動停止會稍候最後一音，不納入按停止之後的音。兩種方式使用相同的順序比對、±50¢ 及歷史；智慧偵測載入失敗會提示自行切換傳統，不會自動切換。
- **快速短音（041 實驗）**：音階／琶音的「智慧」若連續兩個獨立的模型音訊幀都通過原本聲音／信心檢查、指向同一個下一譜位、音分相近，且其中至少一幀有較強的信心，才可提早登記短音。沒有降低模型本身的信心門檻，不把單幀、泛音修正或跳過譜位的片段視為快路徑證據；調音器、「傳統」、±50¢ 通過標準及兩分鐘停止條件不變。合成音階顯示部分漏音改善，實錄 F2／F3 回放仍正確；特定 80 ms 的下行 E2 合成例仍因模型信心不足而未辨識，這不是對任何演奏速度或 iPhone Safari 即時表現的保證。
- **單次／循環**：預設循環，仍可用開始按鈕右側切換為單次。單次完整對上譜面就結束。兩種模式若連續 2 分鐘未對上下一個譜音，會停止並保留結果；單純重拉已對上的音、錯音或錯八度不會重設計時；跳過譜音後辨識到的下一個正確音仍可記錄，但這次跳過本身不重設計時。循環回到原八度的最低主音時，它同時是本輪最後一音與下一輪第一音，直接接第二個音即可。恰在兩個半音中點時，延續原來已辨識的音，否則只用下一個預期譜音判定；無法確定就略過。音準圖依譜位排列，白圈是即時音高，實心點是本輪，同色空心虛線是先前各輪。長時間穿插額外音不會清掉本輪或停止收音。
- **課堂房間（實驗）**：未加入時只顯示「加入房間」與「建立房間」。加入時在六格對話框輸入或貼上房號，失敗可以保留號碼重試；加入後只顯示房號和「退出房間」，點房號複製邀請連結。舊邀請連結仍可開啟。頁首不顯示日期，清單以「練習完成進度 1／4」一列顯示，歷史紀錄日期保留。
- **練習優先版面（實驗）**：首頁用同一個「開始練習」，先直選隨機或循序。相鄰的齒輪會開啟浮層，可即時選調性與調整隨機練習數量，不需另按儲存；未完成清單可按「繼續上次」。練習紀錄與累積次數放在一起，課堂同步仍獨立。打開調性後，音階和琶音各保留原本操作；上方可跳到兩張譜、停止現有收音，指板與練習設定可單獨展開。
- **外觀**：頁首的日月圖示可切換淺色與深色；頁尾可選跟隨系統，本瀏覽器會記住偏好。列印沿用原本淺色譜面。
- **練習建議（實驗）**：預設使用本機確定性規則，不下載或呼叫模型。回看最近最多八輪，在同一譜位或指板已顯示的弦別／指序有足夠配對資料時，才建議一個練法與重測。以「照當次指板拉」為前提，不從音高推定實際手指或原因；未明確標註的伸指不推測，舊音準圖也不補套今天的指板。重新開啟時，會從同一份本機練習暫存還原已生成建議；較舊的暫存若只留有音準，則用已量到的單一譜位給出重測方法，不推斷當時的指法或反覆模式。新練習會優先使用同輪相鄰兩個譜位的實測音準和開始時的可見指板：同弦有音程差時練落指與原譜連接；換弦可先用空弦練弓的高度，再帶回譜音。只量過一次會明說；不從音準推斷實際手型、運弓或原因。若當次指板明確標為空弦、且有偏高或偏低的實測，先用相同 A4 的調音器單獨核對該弦，確認偏差才調弦，再回到原譜重測。舊版建議只保留原音準資料，不套用現在的指法。音準走勢有可核對的較長片段時，會列出同一次收音內量到的前段、後段偏差或明顯起伏，不推論實際起弓或收尾。練習建議先列觀察，再合併成最多三項練法；可比較的下一次練習會顯示同一焦點有沒有改善，不用其他練習紀錄猜測。
- **相對音量走勢（實驗）**：練完後可查看這一回已辨識音符的收音強弱，以這次的中間值為 0 dB，保留空白以標示未判讀的片段。若同一個音量到夠長、可核對的部分，持音中段起伏可列入練習建議；不憑收音判定運弓原因或琴的共鳴。網站節拍器可聽見時及其短尾音不納入。本機只暫留相對音量分析，重新整理不保留，不儲存或上傳錄音。
- **Qwen3.5 本機開發診斷（僅 localhost，可加 `?aiCoach=1`，公開站不啟用）**：音階或琶音停止收音後可按「練習建議」。WebLLM 0.2.86 在本機透過 WebGPU 執行 [Qwen3.5 0.8B 的官方 MLC 量化模型](https://huggingface.co/mlc-ai/Qwen3.5-0.8B-q4f16_1-MLC/tree/0ec138972555613c1d7812a821778ad0398c8790)；首次按下才會下載約 447 MB，與舊版權重分開保留，不會主動刪除舊快取或改用雲端。建議可中斷，等待時間不硬限；同一模型可再嘗試一次結構化輸出，失敗不會偷偷換模型。音訊與摘要不上傳。
- **譜面與指板**：音階和琶音固定兩個八度；指板保留弦序、把位、指法編輯，既有指法不變。介面只在頁尾說明收音與音準留在本機。
- **音準歷史**：結束有辨識到音符的練習後，可以自行選「併入歷史」；「查看歷史」開另一張圖，僅顯示同一調性、同一練習種類（音階或琶音）的累積紀錄。資料只存在本瀏覽器，不保留錄音、不上傳；完成練習時不會彈窗；若當前調性有未儲存的結果，切換調性或標記完成前會顯示這個調性的確認，讓你選擇儲存、略過或留在原處。此瀏覽器只暫存整個網站最近一次有辨識資料的音準圖，重整後仍可查看，不會自動再開麥克風，也不會自動併入歷史。若本機暫存失敗，在支援的瀏覽器上離開或重整時才會收到原生提示。
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

### Experimental interface polish

The experimental site applies web adaptations of the [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/): a scalable system-font hierarchy with Traditional Chinese fallbacks, paired radio choices and consistent minimum touch areas for common actions, visible focus and pressed states, and responsive controls that wrap without changing order. The fifths chooser retains its compact circular map rather than overlapping larger tap targets. The screen-only styling leaves printed notation and all practice, classroom, audio, and history behavior unchanged.

### Experimental practice advice wording

After an explicit request, the local coach writes one or two short Traditional Chinese cello drills and a retest, using only the exercise type, the observed score slots, and available method/A4 metadata. The site renders the measured observation separately. Suggestions about the bow and coordination are practice options, not diagnoses from audio. There is no template-choice fallback; the same model can attempt the structured response once more without thinking.

### Latest pitch trend on reload (experimental)

A finished, scored practice can save its latest pitch timeline in the existing single local draft. The timeline is kept with that exact draft and capped at 120 seconds and 2,564 numeric timeline samples; audio and advice replies are not stored. It is not part of the per-exercise aggregate history. Older drafts, damaged segments or storage quota limits can leave only the original score-position chart. Starting or stopping a new take without any measured pitch does not label the previous timeline as a new recording.

### Full measurement input (experimental)

The local coach receives every score position, including those explicitly marked unrecognized, and every point in the existing pitch timeline with its original precision and segment boundaries. The folded “提供給 AI 的資料” section shows that chart data and the timeline, not model prompts or notes. If it fits, the model reads the data in one request; otherwise the same model reads lossless chronological slices, writes its own rolling notes, and synthesizes the final advice only after all slices succeed. If a slice fails, the application reports partial progress and does not present it as a complete review. The existing chart retention window still applies, and no audio or practice data are uploaded.

- **累積練習（實驗）**：底部長條圖以相同縱軸顯示 12 個大調與 12 個小調的實際完成次數，包含零次，依原有個人與課堂歷史計算。窄螢幕可左右捲動；圖下的練習筆記入口仍使用原本的本機資料。縱軸頂端取嚴格高於最高次數的下一個 5 的倍數，平常每 5 次一格，極大數值減少刻度但保留精確上限。旁邊的每日熱圖統計最近 30 天（含今天），同一天完成的每個調只算一次；日期採用已有紀錄日期，並非事後推算的完成時間。

**連接練習（046 實驗）**：偏差音有同一方向的前音時，先把兩音慢練幾次，再加回譜上更早的音；舊紀錄只能證明保存的音準。查看舊圖時若用到目前可見的譜弦與指法，會特別標成「照目前指板試練」，不當作當時的演奏。練習編排參考 [把準備音加回來（Gerhard Mantel）](https://cellobello.org/cello-blog/interviews/conversation-with-gerhard-mantel/#)、[慢速換弦（Ailbhe McDonagh）](https://www.ailbhemcdonagh.com/cello-basics-17-string-crossings.html)及 [指距與音準（Seattle Public Schools）](https://www.seattleschools.org/wp-content/uploads/2021/07/EIM-Cello-4-5-Finger-Placement-and-Intonation.pdf)。

**本次建議參考（047 實驗）**：建議下方只列出本次實際顯示的練法所用的來源；舊報告沒有來源記錄則不補猜。參考連結可自行開啟，不會在練習時載入第三方內容。

**兩音一弓（048 實驗）**：有符合條件的同弦指距練習時，可自選把這兩音放進同一弓。預設仍是一音一弓，選擇只改本次顯示的下次練法，不判斷已完成練習的弓法，也不影響辨識、計分、音量或歷史。

**開頭未對上提示（049 實驗）**：若未對上首音，但已辨識到樂譜開頭上行的兩個相鄰音，畫面會提示可直接從首音再拉，不必停止收音。提示不是跳位；音準圖、通過、輪數、歷史和收音期限仍由原本的判定決定。

**五線譜漏音標示（050 實驗）**：進度已越過、但沒有辨識成功的音，會用紅色標示符頭、符桿與該音的連桿；還未練到的音維持原樣。這只改變譜面回饋，不把漏音算成通過。

**即時圖與連動（051 實驗）**：展開音階或琶音，就會看到音準圖、音準走勢、相對音量走勢和練習建議。音準圖固定按每一個譜位排列；兩張走勢共用時間尺度，收音時持續往前，停止後裁掉共同的首尾空白，保留中間停頓。點譜位可標示實際對到該位置的時間；點走勢上的已量測區間也可回選譜位。過往輪次用同色半透明點，本輪用不透明點。停止後會直接顯示當次可依據的練習建議，不自動啟動 AI。

**首音未對上（051 實驗）**：若辨識到緊接的兩個譜音，畫面可以先接續，第一音仍顯示未對上，不會補成通過。確認前不寫進歷史或建議；長時間未持續辨識會取消暫定位置，重拉第一音可清除暫定結果。

**首次展開（052 實驗）**：沒有上一筆練習資料時，也可正常展開調性卡並顯示三張空圖。

**深淺色顯示一致（053 實驗）**：音準圖的點選區維持透明，避免遮住音準點與刻度；深色模式加強歷史點、走勢線、五線譜漏音紅色、指板標記和所選設定的對比。淺色五線譜也加深狀態細線。練習資料、判定方式、列印及歷史不變。

**歷史音準點（054 實驗）**：舊輪次維持原色的半透明實心點，增加一像素同色細邊，使最淡的點仍可辨認。本輪仍用不透明的實心點。

**展開卡片（055 實驗）**：深色版標題下方與指板音序的分隔線改為低對比，音準刻度與鍵盤焦點不受影響。

**手機練習統計（055 實驗）**：24 調長條圖保留固定縱軸和完整調名，在圖內左右滑動；近 30 天的熱圖單獨置中並標明起訖日期。統計方式不變。
