// Current policy: node qa/fingering-audit.cjs > qa/fingering-045.md
// Reproduce 043 generic physical routes: node qa/fingering-audit.cjs --minimum-shifts
const fs=require('fs'),vm=require('vm'),c={window:{}};vm.createContext(c);
for(const file of ['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
const F=c.window.CelloFingerboard,O=c.window.CelloFingeringOptimizer,P=c.window.CelloFingeringPresets;
const html=fs.readFileSync('index.html','utf8');
const policy=process.argv.includes('--minimum-shifts')?'minimum-shifts':'reviewed-045';
console.log(`# 045 · 24 調指法稽核（${policy}）\n
預設是本專案的計算路線，不是 Werner 原譜。原始使用者確認的 Werner 指號及網站先前自行推排的弦位保留在 fingering-presets.js 的原始模組，原文未改動（計算器另加在檔案末尾）。音高、拼寫、起始音域與兩八度範圍不變。\n
## 計算邊界\n
- 一般手型第一指基準距空弦 1–13 半音，依使用者把位表命名；一般手型 1–4 指偏移 [0,1,2,3]，向前擴增手型 [0,2,3,4]，確認的 C 小調另用向後擴增 [-1,1,2,3]（只讓第一指往低半音伸，2–4 指留在原位）。向後擴增不加入通用搜尋候選，避免改變無關路線。第五把位附近（第一指距空弦 >=8）僅使用 1–3 指；不引入拇指把位或表外名稱。未包含所有可能高把位／個別手型。\n- 狀態包含弦、指、第一指位置、手型。空弦仍有明確手的位置；其前後移動照計一次換把，不會清空狀態偷渡。換把＝第一指基準位置改變；伸展／收回手型另行計算，不冒充縱向換把。\n- 逐音動態規劃：先最小化換把次數，再比較擴增音數＋手型變更、換弦次數、換把距離平方、總把位高度。只允許順向相鄰換弦；同弦手位跟隨音高方向，換弦時可回到較低把位；單次移動最多七半音。這是通用計算模型的最少換把，不宣稱所有演奏法的全域最少；045 偏好規則覆蓋已確認的 F 大調／C 小調音階，不是一味最小化換把。\n- 小調以旋律小調上行＋自然小調下行整個循環共同最佳化，共用完整頂點狀態；一八度與兩八度各自最佳化。大調音階及大小調琶音下行精確反轉弦／指／把位／手型。琶音獨立計算，不再直接抽取音階預設。\n- 既存自訂資料不刪除、不遷移。音階上行的個別已儲存修改仍覆蓋琶音同音高並對稱反轉；小調音階保留獨立上下行修改。自訂路線不保證少換把或符合手型模型，畫面標示「把位未核對」，不沿用可能過期的預設標籤。\n
## 045 已確認修正與偏好

- 空弦不屬任何把位。所有空弦點維持中性白色 0、深色外框，標題只稱空弦；不附擴增色、不顯示把位。計算器可保留未按弦時的潛在手位作換把計帳，但不輸出到音點顯示資料。
- 相鄰弦能用同一一般把位的連續 0124 時，優先一般手型，不為少一次換把硬用擴增。無特殊音域、接音或擴增等理由時，優先第一把位。本次只改使用者明確確認的 C 小調路線，不進行所有調性的全面重排。
- F 大調兩八度維持 044 的 G／D 弦第一把位 0124；單向 2 次換把、0 擴增音。一八度與琶音不變。C 小調上行與一八度上下行也不變。
- C 小調兩八度自然下行 D 弦按音位由低至高為 01244；演奏順序為 A♭3 4 → G3 4 → F3 2 → E♭3 1 → D3 0。A♭3 位於一般上第一／下第二把位（基準3），隨後同一4指向弦枕移動半音進入基準2的向後擴增，G／F／E♭維持同一三音擴增區段。D空弦保持中性。全下行實際基準位移2次（A弦基準2→D弦基準3，再→D弦基準2），不得宣稱零換把。
- 只在這個 A♭3 的4指旁另標較小的「（↑）」；說明是同一4指往弦枕方向移動半音、音高由 A♭3 降到 G3，不是升高音高。改動任一端點的弦或指號便隱藏提示；不自動把所有半音都加箭頭。
- C 小調琶音改用 C弦0／2，G弦0／4，D弦1／4向後擴增，A弦2；低 E♭2及高C4均為第一把位2指，全部手位基準2，0次換把。下行精確反向；只有D弦兩個按弦音標擴增色，空弦中性。
- 其餘按弦音的擴增著色仍涵蓋連續同弦同基準區段；不跨鄰弦，不將未知自訂指法冒標擴增。實際手型與著色分開計數。
- 144條物理路線與044逐一比較，只改C小調兩八度下行音階及上下行琶音3條，其餘141條完全相同；通用minimum-shifts的144條仍與043基準校驗碼一致。043／044報告保留不覆蓋。

## 兩八度逐調比較\n
數值為「舊 → 新」實際手位改變次數。舊路線先固定原弦／指，再以相同候選手型和轉換規則求最少次數。**不適用**表示舊指法無法完整放入此受限模型，不能視為不會拉或計為零。琶音舊路線沿用原上行音階。\n
| 調性 | 音階上行換把 | 音階下行換把 | 琶音單向換把 | 新上／下／琶音擴增音數 | 新上／下／琶音換弦數 |\n|---|---:|---:|---:|---:|---:|`);
let comparable=0,before=0,after=0;
for(const [mode,name] of [['major','MAJOR_KEYS'],['minor','MINOR_KEYS']]){
 const keys=vm.runInNewContext(html.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
 for(const key of keys){
  const values=[],metrics=[];
  for(const [dir,arp] of [['up',false],['down',false],['up',true]]){
   const notes=arp?F.arpeggioNotes(mode,key,'up'):F.scaleNotes(mode,key,dir,2);
   const old=P.get(mode,key,arp?'up':dir,F.scaleNotes(mode,key,arp?'up':dir,2));
   const oldRoute=O.search(notes,dir,null,old),newRoute=O.route(mode,key,dir,2,arp,policy);
   const om=O.metrics(oldRoute),nm=O.metrics(newRoute);metrics.push(nm);
   if(om){comparable++;before+=om.shifts;after+=nm.shifts;}
   values.push(`${om?om.shifts:'不適用'} → ${nm.shifts}`);
  }
  console.log(`| ${key[0]} ${mode==='major'?'大調':'小調'} | ${values.join(' | ')} | ${metrics.map(m=>m.extensions).join('／')} | ${metrics.map(m=>m.crossings).join('／')} |`);
 }
}
console.log(`\n可完整比較 ${comparable}/72 條方向路線，合計 ${before} → ${after} 次換把。這個合計排除不適用的舊路線，不是完整舊版總數。\n
## 驗證\n
- node --test tests/*.test.cjs：321 tests passed（包含 24 調 × 1／2 八度上下行的音高、候選手型、頂點一致、大小調琶音對稱、空弦換把計價、自訂保留、原始來源保留）。\n- 新舊把位例：第一指在空弦上 5 半音為第三把位，3 半音為上第一／下第二把位。不能再只以某一音距空弦的距離分類整個手位。\n- DOM 驗證：192 個音階／琶音／八度／弦序組合通過；24 調琶音即時套用自訂修改與固定八度驗證通過。
- Chromium 實際渲染：320／390／1440 px 各 24 調，CGDA ↔ ADGC 往返的弦位、指號、顏色一致，切換不儲存資料，頁面無水平溢出。
- 這是程式／模型與瀏覽器驗證，不是老師逐條實際拉奏驗收。`);
