// node qa/movement-audit.cjs > qa/fingering-046.md
const fs=require('fs'),vm=require('vm'),c={window:{}};vm.createContext(c);
for(const f of ['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const O=c.window.CelloFingeringOptimizer,h=fs.readFileSync('index.html','utf8');
const policies=['minimum-shifts','reviewed-045','reviewed-046'],groups=[[1,false,'一八度'],[2,false,'兩八度'],[2,true,'琶音']];
const identity=r=>JSON.stringify(Array.from(r,p=>[p.midi,p.s,p.f,p.anchor,p.shape]));
const zero=()=>({events:0,stringChanges:0,anchorShifts:0,shapeChanges:0,components:0,travel:0,extensionNotes:0,firstFamilyNotes:0,outsideFirstNotes:0,semitone12:0,semitone34:0,stretched134:0,stretched124:0,mixed134:0,normal134:0,rawMixed134:0});
const add=(a,b)=>{for(const k of Object.keys(a))a[k]+=b[k]||0;return a};
const total=policies.map(zero),rows=[],alternatives=[],changed=[],nearTies=[];
for(const [mode,name] of [['major','MAJOR_KEYS'],['minor','MINOR_KEYS']]){
 const keys=vm.runInNewContext(h.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
 for(const key of keys){
  const cells=[],names=[],pairs=[zero(),zero()],firstCells=[],nearCells=[];
  for(const [oct,arp,label] of groups){
   const sums=policies.map(zero),rawMotion=zero(),first=zero();let selectedNear=false;
   for(const dir of ['up','down']){
    const routes=policies.map(p=>O.route(mode,key,dir,oct,arp,p));
    routes.forEach((r,i)=>{
      add(sums[i],O.movementMetrics(r));
      for(let j=2;j<r.length;j++){
        const w=r.slice(j-2,j+1),pattern=w.map(p=>p.f).join('');
        if(['134','431'].includes(pattern)&&w.every(p=>p.s===w[0].s&&p.anchor===w[0].anchor)&&
          w.some(p=>p.shape!=='normal')&&!w.every(p=>p.shape===w[0].shape&&p.shape!=='normal'))sums[i].rawMixed134++;
      }
    });
    if(routes[2][0].source==='computed-first-family-near-tie-v1')selectedNear=true;
    add(pairs[0],O.movementMetrics(routes[1]));add(pairs[1],O.movementMetrics(routes[2]));
    if(identity(routes[1])!==identity(routes[2])){names.push(label+(dir==='up'?'↑':'↓'));changed.push([mode,key[0],oct,arp,dir]);}
    add(rawMotion,O.movementMetrics(O.route(mode,key,dir,oct,arp,'minimum-movements')));
    add(first,O.movementMetrics(O.route(mode,key,dir,oct,arp,'first-family')));
   }
   sums.forEach((s,i)=>add(total[i],s));
   nearCells.push(selectedNear?`E ${rawMotion.events}→${sums[2].events}；換 ${rawMotion.anchorShifts}→${sums[2].anchorShifts}；距 ${rawMotion.travel}→${sums[2].travel}；外 ${rawMotion.outsideFirstNotes}→${sums[2].outsideFirstNotes}`:'—');
   cells.push(`E ${sums.map(s=>s.events).join('/')}；C ${sums.map(s=>s.components).join('/')}`);
   firstCells.push(first.outsideFirstNotes<rawMotion.outsideFirstNotes?
    `E ${rawMotion.events}→${first.events}；外 ${rawMotion.outsideFirstNotes}→${first.outsideFirstNotes}`:'同等或無較熟悉替代');
  }
  const label=key[0]+(mode==='major'?' 大調':' 小調');
  rows.push(`| ${label} | ${cells.join(' | ')} | ${names.join('、')||'不變'} | ${pairs[0].semitone12}→${pairs[1].semitone12} / ${pairs[0].semitone34}→${pairs[1].semitone34} |`);
  alternatives.push(`| ${label} | ${firstCells.join(' | ')} |`);
  if(nearCells.some(x=>x!=='—'))nearTies.push(`| ${label} | ${nearCells.join(' | ')} |`);
 }
}
console.log(`# 046 · 24 調實際移動稽核

## 定義與優先順序

- **移動事件 E**：相鄰音發生換弦、手位基準改變、擴增手型開合其中任何一種，計一次。同一步同時改三項，E 仍為1；**分項總數 C**則為3。單在同一弦、基準、手型內換用另一手指不計移動。
- **通用排序**：先少E；同E先少離開第一把位家族的按弦音（一般／前擴增／後擴增均算），再避免真正或混合手型的擴增134／431，再少不必要擴增、避免同框半音3/4而非1/2，再少C及長距離位移。這不是禁止3/4，也不懲罰一般0124。
- **近似同分優先熟悉把位**：再搜尋每個顯示方向最多比理論最少E多1次的路線。只有第一家族外音至少少2個、兩方向均不增加縱向換把及位移，且兩項都有改善或熟悉音至少增加4個才採用；不得以多次額外移動硬留第一把位。小調共同頂點仍保留。
- **等價手型正規化**：半把位前擴增基準1與第一把位後擴增基準2的四指音位完全相同，改名不算移動。新候選統一用後者。一般第一把位→第一把位前擴增仍只算手型打開、不算縱向換把；不將所有前擴增一律加1。回算043／045也採相同正規化，與舊報告的原始標示數字可能不同。
- 前擴增仍為[0,2,3,4]，後擴增[-1,1,2,3]只新增在第一把位基準2。043原始候選集及最少換把搜尋未變。
- 空弦不屬把位，永遠中性白色0且無把位標籤。計算器仍保留潛在手位／手型：在空弦時換弦、移手或開合也照計，沒有免費傳送。E/C是教學模型的動作計數，不是手部攝影／實奏測量。
- 候選限基準1–13、相鄰順向換弦、單次位移不超過7半音、同弦手位跟音高方向；較高位置只用1–3指。不包含所有大提琴演奏法，也不宣稱普遍全域最優。
- 大調與大小調琶音下行精確反向；旋律小調上行＋自然小調下行共同最佳化並共用頂點。原使用者自訂、Werner來源、拼寫、音域、弦序、C小調045專用箭頭與端點編輯抑制均保留。
- 明確確認的F/C路線優先於通用計算。F新尾段為A弦B♭3/C4/D4擴增1/2/4（與前擴增基準1同一實體手型，統一記第一把位後擴增基準2），再E4/F4第四把位1/2（基準7）；G/D弦仍為一般第一把位0124。C小調045路線保持不變。

## 24 調：相同路線定義，三版直接重算

每格依序為 **043原始最少換把／045已確認／046候選**；每列包括一八度音階上下行、兩八度音階上下行、兩八度琶音上下行。E與C分開，不拿把位數代替移動。最後一欄為045→046的同框半音1/2對數、3/4對數。

| 調性 | 一八度 E/C（043/045/046） | 兩八度 E/C | 琶音 E/C | 對045改動的方向 | 半音1/2 / 3/4 |
|---|---|---|---|---|---|
${rows.join('\n')}

共144條方向路線，對045改動${changed.length}條。總計：

| 政策 | E事件 | 換弦 | 換把 | 手型開合 | C分項總數 | 第一家族外按弦音 | 半音1/2 | 半音3/4 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${policies.map((p,i)=>{const s=total[i];return `| ${p} | ${s.events} | ${s.stringChanges} | ${s.anchorShifts} | ${s.shapeChanges} | ${s.components} | ${s.outsideFirstNotes} | ${s.semitone12} | ${s.semitone34} |`}).join('\n')}

## 實際採用的近似同分熟悉把位例外

每格合計上下行，所以E最多可加2，但每個方向最多加1。換＝縱向換把、距＝基準總位移、外＝第一家族外按弦音。所有採用例外逐方向驗證沒有增加換把／位移。

| 調性 | 一八度 | 兩八度 | 琶音 |
|---|---|---|---|
${nearTies.join('\n')}

## 第一把位優先的完整替代比較（未必採用）

以下刻意把「第一家族外按弦音最少」放到E之前，以顯示熟悉把位與總移動的取捨；比較對象是未套F/C固定例外的通用最少E路線。外＝第一家族外的按弦音數。可能增加手型開合／換弦，故不是一律較好；只有符合上方近似同分界線的候選才會套用。若E相同，通用預設已把第一家族放在其它手型／距離偏好之前。

| 調性 | 一八度替代 | 兩八度替代 | 琶音替代 |
|---|---|---|---|
${alternatives.join('\n')}

## 固定例與回歸

- F大調043→045沿用當時原始把位編碼、只計「換把或換弦」的事件都是4；把手型開合一起算進E則為6→4。上表另統一等價手型後回算分項，不把改名當移動。這證實只數換把會漏掉動作，不能據此說所有調都一樣。
- F大調046的D4→E4：同A弦，等價正規化後基準2後擴增4指→基準7一般1指，同一步有換把＋收回擴增，E=1、C=2、基準位移5半音；E4→F4同框1→2不新增移動。沒有新增自動箭頭。
- 延伸只打開1–2指間距；2–3與3–4仍各半音。正常134合法，不能只看數字或橙色就判為錯誤。045原始編碼下有${total[1].rawMixed134}個混合一般／擴增134或431視窗（043為${total[0].rawMixed134}）；統一實體基準後為${total[1].mixed134}個，並非0個舊視覺案例。真正三音始終同一擴增手型134，045為${total[1].stretched134}個。046兩種都降為0，穩定擴增124／421則有${total[2].stretched124}個；正常134保留${total[2].normal134}個，不硬禁用。
- F♯小調一／兩八度、上下行都沒有真正或混合擴增134／431。上行G弦改以A2／B2／C♯3穩定擴增124；原先G弦B2／C♯3／D♯3的混合134已重新分配，D♯3到D弦，不改音高。兩八度上下行E由6／6改為5／5，縱向換把由3／2改為2／1（正規化口徑）。
- E♭／B♭小調一八度的完全第一家族共同頂點方案是上3／下4次E，下行超過原理論2次的+1界線，因此本版採上3／下3、各僅2個外把位音的折衷，不宣稱全程第一把位。
- 043全部144條物理路線校驗碼保持不變；reviewed-045全部144條已與發布1a9242e逐一核對。F/C固定例外及未知自訂的安全呈現另有測試。過往043/044/045報告不覆蓋。
- Node測試399項通過（含144路線、等價手型、事件／分項、近似同分界線、第一指間距、F♯小調、原始版本校驗碼）；192個DOM組合、24調琶音DOM、320／390／1440px各24調實際Chromium渲染皆通過，弦序切換不儲存資料且無頁面水平溢出。數值來自可重跑的node qa/movement-audit.cjs，不代表老師實際拉奏驗收。
`);
