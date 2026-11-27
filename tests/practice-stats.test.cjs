const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');const html=fs.readFileSync('index.html','utf8'),c={};vm.runInNewContext(html.slice(html.indexOf('    function practiceCompletionRows('),html.indexOf('    const cumulativeNoteKey='))+';this.count=cumulativePracticeCounts;this.heat=practiceHeatDays',c);const row=(id,doneIds,majorIds=[0,1],minorIds=[2])=>({id,doneIds,majorIds,minorIds});
test('24 counters including zero, no drawn-only completions',()=>{const counts=c.count([row('a',[])]);assert.equal(Object.keys(counts).length,24);assert.ok(Object.values(counts).every(x=>x===0));});
test('unique completion per actual row and source mirror, invalid keys excluded',()=>{const counts=c.count([row('a',['major-0','major-0','minor-2','major-4','major-12']),row('b',['major-0']),null],[row('a',['major-0','major-0','minor-2']),row('c',['minor-2'],[],[2,2,'2',13])]);assert.equal(counts['major-0'],2);assert.equal(counts['minor-2'],2);assert.equal(counts['major-4'],0);assert.equal(Object.keys(counts).length,24);});
test('deleted and resumed records derive counts without increment drift',()=>{let rows=[row('a',['major-0']),row('b',[])];assert.equal(c.count(rows)['major-0'],1);rows[1].doneIds.push('major-0');assert.equal(c.count(rows)['major-0'],2);rows[1].doneIds=[];assert.equal(c.count(rows)['major-0'],1);rows.splice(0,1);assert.equal(c.count(rows)['major-0'],0);});
test('cumulative scope never depends on shared room, rendering reads only archived histories',()=>{assert.ok(html.includes("const cumulativeNoteKey=studentNoteKey;"));assert.ok(html.includes('cumulativePracticeCounts(state.personalHistory,state.classroomHistory)'));assert.ok(html.includes('function renderHistory(){\n      renderPracticeStats();'));});

test('24 ordered accessible counts share one linear axis, including zeros and large counts; one separate note picker',()=>{
 function el(tag){return {tag,children:[],dataset:{},style:{setProperty(k,v){this[k]=v}},events:{},attrs:{},
   setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){this.events[k]=f},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items}}}
 const grid=el('div'),picker=el('select'),open=el('button');
 const nodes={'#practice-stats-grid':grid,'#practice-stats-note-key':picker,'#practice-stats-note-open':open};
 const first=html.indexOf('    const MAJOR_KEYS = ['),last=html.indexOf('    const STORAGE_KEY',first);
 const counts=(personal,classroom)=>c.count(personal,classroom);
 const noteCalls=[];
 const box={document:{createElement:el},q:s=>nodes[s],state:{personalHistory:[],classroomHistory:[]},
  cumulativePracticeCounts:counts,selectedId:(m,i)=>m+'-'+i,cumulativeNoteKey:k=>'private-'+k,openPracticeNotes:(...x)=>noteCalls.push(x)};
 vm.runInNewContext(html.slice(first,last)+';function keyName(m,i){return (m==="major"?MAJOR_KEYS:MINOR_KEYS)[i][0];}\n'+
  html.slice(html.indexOf('    function practiceStatsScale('),html.indexOf('    function historyProgress(')),box);
 box.renderPracticeStats();
 const allBars=()=>grid.children.flatMap(x=>x.children[1].children);
 let [axis,bars]=grid.children[0].children;
 assert.equal(grid.children.length,1);
 assert.equal(bars.children.length,24);
 assert.equal(bars.children.at(-1).children[0].textContent,'B 小調，0 次');
 assert.equal(allBars().length,24);
 assert.ok(allBars().every(col=>col.dataset.count==='0'&&col.style['--bar-height']==='0%'));
 assert.deepEqual(axis.children.map(t=>t.textContent),['0','5']);
 assert.equal(allBars()[1].children[0].textContent,'D♭ 大調，0 次');
 assert.equal(allBars()[13].children[0].textContent,'C♯ 小調，0 次');
 assert.ok(allBars().every(col=>!col.events.click&&col.tag==='li'));
 for(const [max,ticks] of [[2,['0','5']],[5,['0','5','10']],[10,['0','5','10','15']]]){
   box.state.personalHistory=Array.from({length:max},(_,i)=>row('ordinary'+i,['major-0']));
   box.renderPracticeStats();
   const [axis,bars]=grid.children[0].children;
   assert.deepEqual(axis.children.map(t=>t.textContent),ticks);
   assert.equal(axis.children.at(-1).style['--level'],'1');
   assert.ok(parseFloat(bars.children[0].style['--bar-height'])<100);
   assert.match(bars.style['--grid-lines'],/var\(--line\) 100%/);
 }
 const huge=box.practiceStatsScale(1_000_000_000);
 assert.equal(huge.max,1_000_000_005);
 assert.ok(huge.ticks.length<=9);
 assert.equal(huge.ticks.at(-1),huge.max);
 box.state.personalHistory=Array.from({length:1300},(_,i)=>row('personal'+i,i<650?['major-0','minor-2']:['major-0']));
 box.renderPracticeStats();
 [axis,bars]=grid.children[0].children;
 assert.deepEqual(axis.children.map(t=>t.textContent),['0','165','330','495','660','825','990','1.2k','1.3k']);
 assert.equal(bars.children[0].dataset.count,'1300');
 assert.equal(allBars()[14].dataset.count,'650');
 assert.equal(bars.children[0].style['--bar-height'],2*parseFloat(allBars()[14].style['--bar-height'])+'%');
 assert.equal(allBars()[14].children[0].textContent,'D 小調，650 次');
 assert.equal(picker.children.length,0);
 open.events.click();assert.deepEqual(noteCalls[0],[open]);
 assert.ok(allBars().every(col=>col.dataset.count==='0'?col.children[1].children.length===1:col.children[1].children[1].textContent===col.dataset.count));
 assert.deepEqual(allBars()[1].children[2].children.map(part=>part.textContent),['D','♭']);
 assert.deepEqual(allBars()[13].children[2].children.map(part=>part.textContent),['C','♯']);
 assert.match(html,/class="practice-stats-chart" role="region" aria-label="24 調的練習次數"/);
 assert.match(html,/\.practice-stats-scroll\{[^}]*overflow-x:auto/);
});

test('heat uses valid local civil record dates, exactly 84 dates through today and unique completed keys each day',()=>{
 const dated=(date,id,doneIds)=>({...row(id,doneIds),date});
 const records=[
  dated('2026-04-30','earlier',['major-0']),
  dated('2026-02-18','opening',['major-0']),
  dated('2026-02-17','one-day-too-old',['major-0']),
  dated('2026-05-01','a',['major-0','major-0','minor-2','major-9']),
  dated('2026-05-01','b',['major-0','major-1']),
  dated('2026-05-12','today',['minor-2']),
  dated('2026-05-13','future',['major-1']),
  dated('2026-02-30','invalid',['major-1']),
  dated(null,'undated',['major-0']),
  dated('2025-01-01','expired',['major-0'])
 ];
 const classRows=[dated('2026-05-01','mirror',['major-1']),dated('2026-05-12','fresh',['major-0','minor-2'])];
 const days=c.heat(records,classRows,'2026-05-12'),get=date=>days.find(d=>d.date===date);
 assert.equal(days.length,84);
 assert.equal(days[0].date,'2026-02-18');
 assert.equal(get('2026-02-18').count,1);assert.equal(get('2026-02-17'),undefined);
 assert.equal(days.at(-1).date,'2026-05-12');
 assert.equal(new Set(days.map(d=>d.date)).size,84);
 assert.equal(get('2026-05-12').weekday,1);
 assert.equal(get('2026-04-30').count,1);assert.equal(get('2026-05-01').count,3);
 assert.equal(get('2026-05-02').count,0);assert.equal(get('2026-05-12').count,2);
 assert.equal(days.reduce((n,d)=>n+d.count,0),7);
 assert.equal(get('2026-05-13'),undefined);assert.equal(get('2026-02-30'),undefined);
 // Leap day and transitions across common DST weekends remain individual cells.
 const leap=c.heat([],[],'2024-03-12');
 for(const day of ['2024-02-29','2024-03-09','2024-03-10','2024-03-11'])assert.ok(leap.some(d=>d.date===day));
 assert.match(html,/class="practice-stats-scroll" role="region" aria-label="每日完成調數，可左右捲動" tabindex="0"/);
 assert.match(html,/\.practice-statistics\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(14\.75rem,33%\)/);
 assert.match(html,/最近 12 週（84 天），含今天/);
});

test('actual heat render outputs date/count per cell and consistent green thresholds without a Tab stop per day',()=>{
 const host={replaceChildren(chart){this.chart=chart}};
 const el=()=>({children:[],attrs:{},dataset:{},style:{setProperty(){}},setAttribute(k,v){this.attrs[k]=v},append(...items){this.children.push(...items)}});
 const dated=(date,n)=>({date,majorIds:[0,1,2,3,4,5],minorIds:[],doneIds:Array.from({length:n},(_,i)=>'major-'+i)});
 const range=el();
 const box={q:key=>key==='#practice-heat-range'?range:host,document:{createElement:el},state:{personalHistory:[
  dated('2026-06-01',1),dated('2026-06-02',2),dated('2026-06-03',4),dated('2026-06-04',6)],classroomHistory:[]},currentDate:'2026-06-04'};
 vm.runInNewContext(html.slice(html.indexOf('    function practiceCompletionRows('),html.indexOf('    const cumulativeNoteKey='))+';renderPracticeHeat()',box);
 const cells=host.chart.children.filter(x=>x.className==='practice-heat-cell');
 assert.equal(cells.length,84);
 assert.equal(cells[0].dataset.count,'0');
 assert.deepEqual(cells.slice(-4).map(cell=>cell.dataset.level),['1','2','3','4']);
 assert.equal(cells.at(-1).children[0].textContent,'2026-06-04，完成 6 調');
 assert.ok(cells.every(x=>x.attrs.role==='listitem'&&x.attrs.tabindex==null));
 assert.deepEqual(host.chart.children.filter(x=>x.className==='practice-heat-month').map(x=>x.textContent),['3月','4月','5月','6月']);
 assert.equal(host.chart.attrs['aria-label'],'最近 12 週（84 天），含今天');
 assert.equal(range.textContent,'3/13–6/4');
 box.currentDate='2027-01-08';box.renderPracticeHeat();
 assert.equal(range.textContent,'2026/10/17–2027/1/8');
 assert.deepEqual(cells.filter(x=>x.attrs['aria-current']==='date').map(x=>x.dataset.date),['2026-06-04']);
 assert.equal(cells[0].style.gridArea,'6 / 2');
 assert.equal(cells.at(-1).style.gridArea,'5 / 14');
 assert.ok(cells.every((x,i)=>i===0||x.dataset.date>cells[i-1].dataset.date));
});

test('phone shares one 24-slot axis with upright note names, and heat legend has fixed tracks',()=>{
 assert.match(html,/\.practice-statistics\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(html,/\.practice-stats-scroll\{[^}]*overflow-x:auto[^}]*contain:inline-size/);
 assert.match(html,/\.practice-stats-bars\{[^}]*grid-template-columns:repeat\(24,minmax\(0,1fr\)\)/);
 assert.match(html,/@media\(max-width:680px\)\{[\s\S]*?\.practice-statistics\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(html,/\.practice-stats-bars\{[^}]*container-type:inline-size/);
 assert.match(html,/\.practice-stats-key\{[^}]*font-size:min\(\.75rem,2\.68cqi\)[^}]*white-space:nowrap/);
 assert.doesNotMatch(html,/\.practice-stats-key\{[^}]*flex-direction:column/);
 assert.doesNotMatch(html,/\.practice-stats-key\{[^}]*writing-mode:vertical/);
 assert.match(html,/\.practice-heat-legend\{display:grid;grid-template-columns:repeat\(5,max-content\)/);
 assert.match(html,/id="practice-heat-title">練習天數<\/h3>/);
 assert.match(html,/id="practice-heat-legend-title"[^>]*>完成調性個數<\/div>\s*<div class="practice-heat-legend" role="group" aria-labelledby="practice-heat-legend-title"/);
 assert.doesNotMatch(html,/practice-stats-band-label/);
 assert.match(html,/id="practice-stats-grid" class="practice-stats-chart"/);
 assert.match(html,/id="practice-heat-range"[^>]*><\/span><\/div>[\s\S]*?id="practice-heat-grid"/);
 assert.match(html,/\.practice-heat-grid\{--heat-cell:clamp\([^}]*margin-inline:auto/);
});
