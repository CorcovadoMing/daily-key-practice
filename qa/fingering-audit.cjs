// Reproducible model audit: node qa/fingering-audit.cjs > qa/fingering-043.md
const fs=require('fs'),vm=require('vm'),c={window:{}};vm.createContext(c);
for(const file of ['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
const F=c.window.CelloFingerboard,O=c.window.CelloFingeringOptimizer,P=c.window.CelloFingeringPresets;
const html=fs.readFileSync('index.html','utf8');
console.log(`# 043 · 24 調低換把路線稽核\n
預設是本專案的計算路線，不是 Werner 原譜。原始使用者確認的 Werner 指號／推排弦位保留在 fingering-presets.js 的原始模組，原文未改動（計算器另加在檔案末尾）。音高、拼寫、起始音域與兩八度範圍不變。\n
## 計算邊界\n
- 第一指距空弦 1–13 半音，依使用者把位表命名；一般手型 1–4 指偏移 [0,1,2,3]，擴增手型 [0,2,3,4]。第五把位附近（第一指距空弦 >=8）僅使用 1–3 指；不引入拇指把位或表外名稱。未包含所有可能高把位／個別手型。\n- 狀態包含弦、指、第一指位置、手型。空弦仍有明確手的位置；其前後移動照計一次換把，不會清空狀態偷渡。換把＝第一指基準位置改變；伸展／收回手型另行計算，不冒充縱向換把。\n- 逐音動態規劃：先最小化換把次數，再比較擴增音數＋手型變更、換弦次數、換把距離平方、總把位高度。只允許順向相鄰換弦；同弦手位跟隨音高方向，換弦時可回到較低把位；單次移動最多七半音。這是此教學模型內的最少換把，不宣稱所有演奏法的全域最少。\n- 小調以旋律小調上行＋自然小調下行整個循環共同最佳化，共用完整頂點狀態；一八度與兩八度各自最佳化。大調音階及大小調琶音下行精確反轉弦／指／把位／手型。琶音獨立計算，不再直接抽取音階預設。\n- 既存自訂資料不刪除、不遷移。音階上行的個別已儲存修改仍覆蓋琶音同音高並對稱反轉；小調音階保留獨立上下行修改。自訂路線不保證少換把或符合手型模型，畫面標示「把位未核對」，不沿用可能過期的預設標籤。\n
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
   const oldRoute=O.search(notes,dir,null,old),newRoute=O.route(mode,key,dir,2,arp);
   const om=O.metrics(oldRoute),nm=O.metrics(newRoute);metrics.push(nm);
   if(om){comparable++;before+=om.shifts;after+=nm.shifts;}
   values.push(`${om?om.shifts:'不適用'} → ${nm.shifts}`);
  }
  console.log(`| ${key[0]} ${mode==='major'?'大調':'小調'} | ${values.join(' | ')} | ${metrics.map(m=>m.extensions).join('／')} | ${metrics.map(m=>m.crossings).join('／')} |`);
 }
}
console.log(`\n可完整比較 ${comparable}/72 條方向路線，合計 ${before} → ${after} 次換把。這個合計排除不適用的舊路線，不是完整舊版總數。\n
## 驗證\n
- node --test tests/*.test.cjs：313 tests passed（包含 24 調 × 1／2 八度上下行的音高、候選手型、頂點一致、大小調琶音對稱、空弦換把計價、自訂保留、原始來源保留）。\n- 新舊把位例：第一指在空弦上 5 半音為第三把位，3 半音為上第一／下第二把位。不能再只以某一音距空弦的距離分類整個手位。\n- DOM 驗證：192 個音階／琶音／八度／弦序組合通過；24 調琶音即時套用自訂修改與固定八度驗證通過。
- Chromium 實際渲染：320／390／1440 px 各 24 調，CGDA ↔ ADGC 往返的弦位、指號、顏色一致，切換不儲存資料，頁面無水平溢出。
- 這是程式／模型與瀏覽器驗證，不是老師逐條實際拉奏驗收。`);
