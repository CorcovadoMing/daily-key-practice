// node qa/fingering-048.cjs > qa/fingering-048.md
const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),c={window:{}};vm.createContext(c);for(const f of['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const O=c.window.CelloFingeringOptimizer,h=fs.readFileSync('index.html','utf8'),lists=[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']].map(([m,n])=>[m,vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1])]);
const plain=r=>Array.from(r,p=>[p.midi,p.s,p.f,p.anchor,p.shape]);
function physical(r){let secondMoves=0,secondTravel=0,uniform=0;for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i],x=O.SHAPES[a.shape].map(v=>v+a.anchor),y=O.SHAPES[b.shape].map(v=>v+b.anchor),delta=y.map((v,j)=>v-x[j]);secondMoves+=Number(delta[1]!==0);secondTravel+=Math.abs(delta[1]);uniform+=Number(delta[0]!==0&&delta.every(v=>v===delta[0]));}return{secondMoves,secondTravel,uniform};}
const rows=[],changes=[],hashRows=[],totals={old:{events:0,components:0,secondMoves:0,secondTravel:0},now:{events:0,components:0,secondMoves:0,secondTravel:0}};
for(const[m,keys]of lists)for(const k of keys)for(const[o,arp]of[[1,false],[2,false],[2,true]])for(const d of['up','down']){
 const old=O.route(m,k,d,o,arp,'reviewed-047'),now=O.route(m,k,d,o,arp),id=[m,k[0],o,arp,d].join('|');const om={...O.movementMetrics(old),...physical(old)},nm={...O.movementMetrics(now),...physical(now)};const changed=JSON.stringify(plain(old))!==JSON.stringify(plain(now));
 hashRows.push([id,plain(now)]);rows.push({m,k:k[0],o,arp,d,old,now,om,nm,changed});if(changed)changes.push(id);for(const[name,metrics]of[['old',om],['now',nm]])for(const field of Object.keys(totals[name]))totals[name][field]+=metrics[field];
}
console.log(`# 048 · 全24調逐方向稽核與已審閱局部調整

基準：experimental 047，7ab337fdd486720615f9e38f4507e45910ce05b1。範圍為24調 × 一八度音階／兩八度音階／兩八度琶音 × 上下行＝144條、1,440個逐音配置。只採用明確審閱的7組，共14條方向路線；其餘130條音高、弦、指、基準與手型逐一相同。正式版與工作流程不修改。

## 方法與限制

逐音檢查拼寫／MIDI、空弦、1–2-only擴增接觸音位、同弦連接、相鄰換弦、大小調鏡像規則、小調共同頂點、既有自訂與呈現。這是數值逐音走查與瀏覽器模擬，不是老師或使用者實奏，也沒有聲稱已聽到音訊播放。

E為相鄰步驟出現換弦、模型基準或手型變化時算一次。C是原046名義分項總和，保留可重現，不能解讀成精確生物力學。新增實體比較以第2指接觸音位＝anchor+shape[1]計算變動次數P與半音距離T，不以裸anchor代替。第2指移動並不一定代表整手剛性平移：報告另辨識四指同量平移，且空弦內部潛在手位只用於計數，不顯示把位。保留同一步跨弦時手指音位變化，不能把跨弦當免費換把。

全域搜尋權重與047比較候選不重調。reviewed-047可精確重算原144條；reviewed-046、reviewed-045、minimum-shifts與minimum-movements均保留。Werner原始手指資料不覆寫，生成路線不是Werner原稿。

## 採用理由

- E、B大調一八度：兩組穩定擴增124再接半把位12，減少原路線內部開合／移動事件；所有大調下降精確倒轉。
- F♯大調一八度：C弦擴增24、G弦一般124、D弦第一把位向後擴增123，依完整上下行比較，不把指號124本身當擴增。
- D♭大調琶音：低D♭／F以第一家族向後擴增14，之後改用指定正常上第一／下第二手型；表列實際接觸位移，不宣稱所有分項均變好。
- F♯大調琶音：只把G弦A♯／C♯改成同正常手型14，其餘音不動。
- A♭大調琶音：只把A弦C／E♭改成同正常手型14，最上方A♭不動。
- F♯小調兩八度：使用者明確選擇A弦上行12124。B3／C♯4為擴增基準2的12；D♯4／E♯4為擴增基準6的12；F♯4是基準6正常4，收回擴增。最後收手型另計事件，上行E4→5，名義換把4→4，名義位移9→8。共同頂點改為4指，下一下降E自然改2指，同正常基準6，下降E仍4、名義位移8→7。按第2指接觸音位實算，上行T為7→8、下降8→7，全循環15→15，不是整體物理路程縮短；取捨是較早以1指換把、最後落在正常4指。沒有加音或重複頂音，也不是一個固定擴增124。最高F♯及下降E自然不再橙色；前面的D♯／E♯仍為擴增色。其餘下降、原低G♯在C弦及琶音均保留。

## 144條總計

| 指標 | 047 | 048 |
|---|---:|---:|`);
for(const[field,label]of[['events','E事件'],['components','C名義分項'],['secondMoves','P第2指接觸音位變動'],['secondTravel','T第2指接觸音位半音距離']])console.log(`| ${label} | ${totals.old[field]} | ${totals.now[field]} |`);
console.log(`\n## 每方向完整比較\n\n各格為047→048；＝表示逐音配置相同。P/T是接觸音位指標，不偽稱實際手腕路程。\n\n| 調 | 類別 | 方向 | E | C | P | T | 改動 |\n|---|---|---|---:|---:|---:|---:|---|`);
for(const r of rows)console.log(`| ${r.k}${r.m==='major'?'大':'小'}調 | ${r.arp?'琶音':r.o+'八度音階'} | ${r.d==='up'?'上':'下'} | ${r.om.events}→${r.nm.events} | ${r.om.components}→${r.nm.components} | ${r.om.secondMoves}→${r.nm.secondMoves} | ${r.om.secondTravel}→${r.nm.secondTravel} | ${r.changed?'已審閱':'＝'} |`);
console.log('\n## 已改路線逐音接觸框\n\n格式：MIDI／弦指／正常基準／手型／四指音位（相對各空弦半音）。空弦的框只為內部計數。');
for(const r of rows.filter(r=>r.changed)){console.log(`\n### ${r.k} ${r.m} ${r.o} ${r.arp?'arp':'scale'} ${r.d}\n`);for(const[label,route]of[['047',r.old],['048',r.now]])console.log(label+': '+route.map(p=>`${p.midi}/${'CGDA'[p.s]}${p.f}/${p.anchor}/${p.shape}/[${O.SHAPES[p.shape].map(v=>v+p.anchor)}]`).join(' · '));}
console.log('\n## 重現與驗證\n\n- `node --test tests/*.test.cjs`：407項通過，含逐音、鏡像、共同頂點、封存校驗、自訂與中性空弦回歸。\n- `JSDOM_MODULE=... node qa/fingering-dom.cjs`：192組呈現組合及指定最高音正常色／教師編輯器驗證。\n- `JSDOM_MODULE=... node qa/arpeggio.cjs`：24調琶音呈現。\n- 響應式：320／390／1440px，24調、雙弦序，確認無頁面橫向溢出。\n- 048路線校驗 SHA256：`'+crypto.createHash('sha256').update(JSON.stringify(hashRows)).digest('hex')+'`。\n- 改動方向數：'+changes.length+'；未改：'+(144-changes.length)+'。\n- 發布前另做根代理獨立審閱；此報告不是CI成功或已發布的替代證據。');
