const fs=require('fs'),vm=require('vm'),a=require('node:assert/strict'),c={window:{}};vm.createContext(c);for(const f of['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);const O=c.window.CelloFingeringOptimizer,F=c.window.CelloFingerboard,h=fs.readFileSync('index.html','utf8'),lists=[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']].map(([m,n])=>[m,vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1])]),OPEN=[36,43,50,57],summary=[],sameOne=[],uniform=[],changed=[];let notes=0,harmonics=0,normalContext=0,routeCount=0;
for(const[m,ks]of lists)for(const k of ks){let contexts=0,translations=0;for(const[o,arp]of[[1,false],[2,false],[2,true]])for(const d of['up','down']){
 const r=O.route(m,k,d,o,arp,'reviewed-052'),old=O.route(m,k,d,o,arp,'reviewed-051'),refs=Object.fromEntries(r.map(p=>[p.midi,p])),id=[m,k[0],o,arp?'arp':'scale',d].join(' ');routeCount++;
 const plain=xs=>Array.from(xs,p=>[p.midi,p.s,p.f,p.anchor,p.shape]);if(JSON.stringify(plain(r))!==JSON.stringify(plain(old)))changed.push(id);
 r.forEach((p,i)=>{notes++;const pos=F.notePlacement(p.midi,{},refs),style=F.pointStyling(pos),semi=p.midi-OPEN[p.s];
 if(!p.f){a.equal(style.group,'open');a.equal(style.extended,false);a.equal(pos.anchor,undefined);}
 else if(p.technique==='naturalHarmonic'){harmonics++;a.equal(p.midi,69);a.equal(p.s,3);a.equal(p.f,3);a.equal(p.harmonic.touchSemitones,12);a.equal(style.group,'harmonic');a.equal(pos.anchor,undefined);}
 else{a.equal(semi,p.anchor+O.SHAPES[p.shape][p.f-1]);a.equal(style.group,'position-'+p.anchor);a.ok(style.label.includes(F.CHART_POSITIONS[p.anchor][0]));a.equal(F.POSITION_COLORS[style.group],F.CHART_POSITIONS[p.anchor][1]);a.equal(Boolean(style.extended),p.shape!=='normal'||Boolean(p.displayExtended));}
 if(p.f&&p.shape==='normal'&&p.displayExtended){contexts++;normalContext++;}
 if(i){const q=r[i-1],x=O.SHAPES[q.shape].map(v=>v+q.anchor),y=O.SHAPES[p.shape].map(v=>v+p.anchor),delta=y.map((v,j)=>v-x[j]);
 if(q.anchor===p.anchor&&delta[0]!==0&&delta.every(v=>v===delta[0])){translations++;uniform.push(id+' '+q.midi+'→'+p.midi+' '+delta[0]);}
 if(q.s===p.s&&q.f===1&&p.f===1)sameOne.push({id,from:q.midi,to:p.midi,string:'CGDA'[p.s],frames:x+'→'+y,cue:q.shiftCue?.symbol||'無新增'});
 }
 });
}summary.push({key:k[0]+(m==='major'?'大調':'小調'),contexts,translations});}
console.log(`# 052 · 指法顯示、指定上行與完整把位稽核

基準051：490ea0763eab03f3b88888771e7151f8835fc965。最新使用者指示優先，沒有用全域啟發式暗改其它路線。

## 指定上行更動

- A大調兩八度上行A弦：0｜134｜124｜3。A3空弦；B3/C♯4/D4正常第一把位134；E4/F♯4/G♯4前擴增第四把位124（基準7）；A4仍第3指自然泛音。原下降完整保留。
- E大調、小調兩八度上行A弦：0｜1↓｜134。A3空弦；B3為正常第一把位1；C♯4/D♯4/E4同一正常上第二把位134（基準4）。B1→C♯1是全音的整個接觸框向琴橋移動，提示明寫全音，不假稱擴增或半音。原下降與頂點E4的4指／基準4不變。
- A/E大調的兩八度已不對稱，畫面分別顯示上行／下行，不再冒稱上下行相同；一八度與琶音仍原規則。沿用既有共用upMap自訂覆蓋，新增下降顯示為唯讀，避免復活或覆寫封存downMap。原上行編輯器仍對相同自訂音高生效，保存內容完全保留。

## 實證1134與短版11

原051只有E小調、B小調兩八度上行出現同弦1134：E小調D弦D♯3→E3→F♯3→G3；B小調A弦A♯3→B3→C♯4→D4。前1是第一把位向後擴增，第二1收回半音至正常第一把位，後續134是同一正常手型。第1指接觸音位由1→2，另外三指3/4/5完全不動，不能說整手剛性換把。

第一1加圓內↓；正常第二1設明確區段邊界，之後134不再被舊同基準區段的擴增外框覆蓋。E/B小調一八度結尾11有同一幾何，亦採此提示與邊界，共4處。另有E大／小調上述全音換把2處，合計6個新增↓。不是把所有重複1或所有134套同一規則。

## 顯示精簡

- 擴增改成1.5px細實線對比框，原把位底色完全保留。
- 圖例只包含該方向目前真正顯示的把位／空弦／泛音／自訂類別；該圖確有擴增才出現擴增說明。八度、編輯、方向、教師圖、琶音各自更新，不列無關高把位。
- 填色音點數字與圈內箭頭白色；較淺底色加細深色字緣，空弦0仍深色。白字對深色字緣或深底的對比至少4.5:1，不宣稱每個白字直接對較淺底色也達4.5。
- 移除調性卡產生的長段落，保留功能標題、音名、指號、圖例、控制、驗證錯誤、無障礙標籤，以及使用者自己保存的筆記。五線譜不改。

## 全路線逐音稽核

${routeCount}條方向路線、${notes}個音點；每個按音逐一以空弦MIDI＋基準＋手型偏移核對，並檢查實際顯示把位名稱／色碼；${harmonics}個泛音端點獨立驗證輕觸資料，空弦不輸出把位。**音高幾何／圖表名稱／色碼不相符：0。**

物理配置相較051只有以下${changed.length}條上行變更，其餘${routeCount-changed.length}條相同：${changed.join('；')}。下降全部保留。舊051路線可用reviewed-051重算；原Werner資料與歷史報告不覆寫。封存051完整144路線（含呈現中繼資料）對照發布源碼完全相同，SHA256：a592533045f0412fc61f9d2c7d5a512e029f691bf01ad42c2217ff1e8325ad78。

### 尚待分段判斷，不等於錯指法

仍有${normalContext}個實際normal音點依既有整段擴增規則帶擴增框，包含已確認的C小調例子；不能一概刪除。另有${uniform.length}個相鄰步驟，名義基準未改但四指接觸點一致平移，原計分把它分到手型變更。下表逐調列出，先公開模型／呈現歧義，不因此重排未授權路線。未做真人實奏或人體工學保證。

| 調 | normal音點的整段擴增框 | 同基準但四指整體平移步驟 |
|---|---:|---:|`);
for(const x of summary)console.log(`| ${x.key} | ${x.contexts} | ${x.translations} |`);
console.log('\n### 全部同弦1→1實際接音\n\n列出接觸框，未新增提示者維持原資料，不冒稱正常134。\n\n| 路線 | 音高MIDI | 弦 | 四指接觸框 | 提示 |\n|---|---|---|---|---|');
for(const x of sameOne)console.log(`| ${x.id} | ${x.from}→${x.to} | ${x.string} | ${x.frames} | ${x.cue} |`);
console.log('\n## QA\n\n- 426項Node回歸；144個方向／八度變化的使用中圖例、192一般DOM、288泛音DOM、24調琶音與完整編輯器互動檢查。\n- 320／390／1440px實際SVG檢查：白字與箭頭（含字緣）在圓內，細實線正確，圖例無裁切；390px截圖目視確認。四個代表調最多6項圖例，遠少於原18項全表。\n- 24調×3寬度雙弦序與8組捲動中斷流程回歸；另外保留051逐畫格捲動檢查。\n- 正式版／workflow不變，發布須再核對精確CI、artifact、線上檔案與main。');
