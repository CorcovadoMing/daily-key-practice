const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const moduleCode = name => html.split('// ' + name + '_START')[1].split('// ' + name + '_END')[0];
const audio = { module: { exports: {} } };
vm.runInNewContext(moduleCode('AUDIO_TOOLS'), audio);
const { pitchReading } = audio.module.exports;

class Node {
  constructor() {
    this.children = []; this.dataset = {}; this.attributes = {}; this.variables = {};
    this.style = { setProperty: (key, value) => { this.variables[key] = value; } };
    this._text = '';
  }
  get textContent() { return this._text; }
  set textContent(value) { this._text = value; this.children = []; }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener() {}
  find(className) {
    if (this.className === className) return this;
    return this.children.map(child => child.find(className)).find(Boolean);
  }
}
const source = { module: { exports: {} }, document: { createElement: () => new Node() },
  localStorage: { getItem: () => 'loop' } };
vm.runInNewContext(moduleCode('SCALE_PRACTICE'), source);
const { card, manager } = source.module.exports;
const target = [36,38,40,41,43,45,47,48,47,45,43,41,40,38,36].map(midi =>
  ({ midi, name: String(midi), octave: Math.floor(midi / 12) - 1 }));
const slots = { up: 3, down: 11, wrongOctave: 5 };

async function fixture(sequence=target,mode='loop') {
  let now = 0, listener, starts = 0, releases = 0;
  const heads = sequence.map(() => new Node());
  const view = card({ querySelectorAll: () => heads }, sequence, () => {});
  const states = [];
  const render = view.update.bind(view);
  view.update = (...state) => { states.push(state); return render(...state); };
  const capture={ subscribe: hooks => { starts++; listener = hooks; return () => { releases++; }; } };
  const m = manager({ performance: { now: () => now } }, {
    capture, swiftCapture:capture,
    reference: () => 442, pitchReading, pitchName: String
  });
  Object.defineProperty(view,'mode',{value:mode});
  await m.toggle(view);
  listener.ready();
  const play = (midi, cents = 0) => {
    const frequency = midi == null ? 0 : 442 * 2 ** ((midi - 69 + cents / 100) / 12);
    for (let i = 0; i < 6; i++) { now += 27; listener.frame({ now, frequency }); }
  };
  const last = () => states.at(-1);
  const historyPoints = slot => {
    const column = view.element.find('scale-pitch-columns');
    assert.ok(column, 'actual chart must be mounted');
    const all = column.children;
    return all[slot].find('scale-pitch-history').children;
  };
  return { play, last, historyPoints, stop: () => m.toggle(view), heads, captureCounts: () => [starts,releases] };
}
const entries = bin => Array.from(bin.entries(), pair => Array.from(pair));

const twoOctaves=start=>{
 const rising=[0,2,4,5,7,9,11,12,14,16,17,19,21,23,24];
 return [...rising,...rising.slice(0,-1).reverse()].map(offset=>({midi:start+offset,name:String(start+offset),octave:Math.floor((start+offset)/12)-1}));
};
for (const [key,midi] of [['C',36],['F',41]]) test(key+' major: shared ±45 tonic scores in two laps without repetition',async()=>{
 const seq=twoOctaves(midi),f=await fixture(seq);
 seq.slice(0,-1).forEach(n=>f.play(n.midi)); f.play(midi,45);
 assert.equal(f.last()[5].laps,1); assert.equal(f.last()[5].passed,1);
 assert.equal(Math.round(f.last()[5].values[0]),45);
 seq.slice(1,-1).forEach(n=>f.play(n.midi)); f.play(midi,-45);
 assert.equal(f.last()[5].laps,2); assert.equal(f.last()[5].passed,2);
 assert.deepEqual(entries(f.last()[5].history[0]),[[0,1],[45,1]]);
 assert.deepEqual(entries(f.last()[5].history.at(-1)),[[45,1],[-45,1]]);
 await f.stop();
 assert.equal(f.last()[2],null,'carried tonic does not invent a partial');
 assert.equal(Math.round(f.last()[5].values.at(-1)),-45);
});
test('early exact tonic or wrong octave cannot close a loop; wrong octave marks no slot',async()=>{
 const seq=twoOctaves(36), f=await fixture(seq);
 seq.slice(0,8).forEach(n=>f.play(n.midi)); f.play(36,45);
 assert.equal(f.last()[5].laps,0);
 seq.slice(8,-1).forEach(n=>f.play(n.midi)); f.play(24,45);
 assert.equal(f.last()[5].laps,0);
 await f.stop();
 const [, ,result, , ,final]=f.last();
 assert.equal(result.complete,false);
 assert.equal(final.values.at(-1),null);
 assert.equal(f.heads.at(-1).dataset.practiceBand,undefined);
});
test('chart history preserves hue and actual rounded precision, with ±50 passing',()=>{
 const {addHistory,chartPoint}=source.module.exports;
 for(const value of [-40.1,-20.1,-10.1,10.1,20.1,40.1,-50,50]){
  const [bin]=addHistory([new Map()],[value]), [key]=bin.keys();
  assert.equal(chartPoint(key).band,chartPoint(value).band);
  assert.equal(chartPoint(key).failed,false);
 }
});
for(const mode of ['single','loop']) test(mode+' keeps score and capture through hundreds of extra notes',async()=>{
 const seq=twoOctaves(36),f=await fixture(seq,mode);
 seq.slice(0,10).forEach(n=>f.play(n.midi));
 for(let i=0;i<620;i++) f.play(i%2?49:37,45);
 assert.equal(f.last()[0],'listening');
 assert.equal(f.last()[3],10);assert.deepEqual(f.captureCounts(),[1,0]);
 seq.slice(10).forEach(n=>f.play(n.midi));
 if(mode==='loop') {
  assert.equal(f.last()[5].passed,1);
  assert.deepEqual(f.captureCounts(),[1,0]);await f.stop();
 } else {
  assert.equal(f.last()[2].complete,true);
  assert.equal(f.last()[2].extra,620);
 }
 assert.deepEqual(f.captureCounts(),[1,1]);
});
test('midpoint favors held MIDI, then exact expected MIDI or rejects; a held tie never advances two slots',async()=>{
 const {resolveMidpoint}=source.module.exports;
 const reading={midi:61,cents:-50};
 assert.deepEqual(JSON.parse(JSON.stringify(resolveMidpoint(reading,61,60))),{midi:60,cents:50});
 assert.equal(resolveMidpoint(reading,62,null),null);
 const seq=[36,37,39].map(midi=>({midi,name:String(midi),octave:2})), f=await fixture(seq,'single');
 f.play(36,50); f.play(36,50);
 assert.equal(f.last()[3],1);assert.equal(Math.round(f.last()[5].values[0]),50);
 f.play(null); f.play(36,50);
 assert.equal(f.last()[3],2);assert.equal(Math.round(f.last()[5].values[1]),-50);
});
test('watchdog times out at 120 seconds from latest genuine progress despite continuous wrong or held pitches',async()=>{
 const ticks=new Map(), states=[];
 let now=0,id=0,listening,releases=0;
 const env={performance:{now:()=>now},setTimeout(fn,ms){ticks.set(++id,{at:now+ms,fn});return id;},clearTimeout(key){ticks.delete(key);}};
 const practice=manager(env,{capture:{subscribe(listener){listening=listener;return ()=>releases++;}},reference:()=>442,pitchReading,pitchName:String});
 function advance(at){
  for(const [key,entry] of ticks){if(entry.at>at)continue;now=entry.at;ticks.delete(key);entry.fn();}
  now=at;
 }
 function frame(at,midi){
  advance(at);listening.frame({now,frequency:midi==null?null:442*2**((midi-69)/12)});
 }
 await practice.toggle({target,mode:'loop',update(...state){states.push(state);}});listening.ready();
 for(const at of [60000,60027,60054,60081])frame(at,36);
 assert.equal(states.at(-1)[3],1);
 const lastProgress=60027;
 for(let i=0;i<600;i++)frame(61000+i*130,[24,37,36][i%3]);
 advance(lastProgress+119999);assert.equal(states.at(-1)[0],'listening');
 advance(lastProgress+120000);assert.equal(states.at(-1)[0],'idle');
 assert.match(states.at(-1)[1],/未對上下一個譜音/); assert.equal(releases,1);
});

test('repeating a recently scored ascent pitch does not skip the apex or move the clock',async()=>{
 const seq=[40,41,43,41,40].map(midi=>({midi,name:String(midi),octave:2})), f=await fixture(seq,'single');
 f.play(40); f.play(41); f.play(null); f.play(41,8);
 assert.equal(f.last()[3],2);
 assert.equal(f.last()[5].values[3],null);
 f.play(43); f.play(41); f.play(40);
 assert.equal(f.last()[2].complete,true);
});

test('bounded event compaction preserves the optimum ordered path and recent raw notes',()=>{
 const {align,retainPracticeEvents}=source.module.exports;
 let seed=180013;
 const next=()=>{seed=(seed*48271)%2147483647;return seed;};
 const seq=twoOctaves(36), retained=[];
 const full=Array.from({length:1024},(_,id)=>({id,midi:36+next()%28,cents:next()%101-50}));
 let compact=retained;
 for(const e of full)compact=retainPracticeEvents(seq,[...compact,e]);
 assert.ok(compact.length<=seq.length*(seq.length+1)/2+32);
 assert.deepEqual(compact.slice(-8).map(x=>x.id),full.slice(-8).map(x=>x.id));
 const project=(events)=>Array.from(align(seq,events).pairs,p=>[p.expected,events[p.heard].id]);
 assert.deepEqual(project(compact),project(full));
});

test('a late fuzzy skip advances the chart and final scoring, but only the exact next note resets the clock',async()=>{
 async function attempt(second){
  let now=0, listener, releases=0, state, timer, timerAt;
  const env={performance:{now:()=>now},setTimeout(fn,delay){timer=fn;timerAt=now+delay;return 1;},clearTimeout(){timer=null;}};
  const practice=manager(env,{capture:{subscribe(hooks){listener=hooks;return ()=>releases++;}},
    reference:()=>442,pitchReading,pitchName:String});
  const sequence=[41,43,45,46,48,50,52,53,52,50,48,46,45,43,41].map(midi=>({midi}));
  await practice.toggle({target:sequence,mode:'loop',update(...args){state=args;}});
  listener.ready();
  function advance(at){
   while(timer && timerAt<=at){now=timerAt;const callback=timer;timer=null;callback();}
   now=at;
  }
  function note(at,midi){
   for(const time of [at,at+27,at+54]){
    advance(time);listener.frame({now,frequency:442*2**((midi-69)/12)});
   }
  }
  note(27,41); // confirmed at 54; this is the first qualifying timestamp.
  assert.equal(state[3],1);
  note(119000,second);
  assert.equal(state[3],second===43 ? 2 : second===45 ? 3 : 4);
  assert.equal(state[5].values[state[3]-1],0);
  advance(120053);assert.equal(state[0],'listening');
  advance(120054);
  if(second===43){
   assert.equal(state[0],'listening');
   advance(239026);assert.equal(state[0],'listening');
   advance(239027);
  }
  assert.equal(state[0],'idle');
  assert.match(state[1],/未對上下一個譜音/);
  assert.equal(state[2].pairs.length,2,'both actual heard notes still contribute to final alignment');
  assert.equal(releases,1);
 }
 for(const midi of [45,46,43])await attempt(midi);
});

test('exact final tonic renews the clock at rollover, while a recovered loop skipping the preceding note does not',async()=>{
 for(const skipped of [false,true]){
  let now=0, listener, state, timer, due;
  const env={performance:{now:()=>now},setTimeout(fn,delay){timer=fn;due=now+delay;return 1;},clearTimeout(){timer=null;}};
  const practice=manager(env,{capture:{subscribe(hooks){listener=hooks;return ()=>{};}},
    reference:()=>442,pitchReading,pitchName:String});
  const sequence=twoOctaves(41);
  await practice.toggle({target:sequence,mode:'loop',update(...args){state=args;}});
  listener.ready();
  function advance(at){
   while(timer && due<=at){now=due;const callback=timer;timer=null;callback();}
   now=at;
  }
  function note(at,midi){
   for(const time of [at,at+27,at+54]){
    advance(time);listener.frame({now,frequency:442*2**((midi-69)/12)});
   }
  }
  const prefix=sequence.slice(0,skipped?-2:-1);
  prefix.forEach((n,i)=>note(27+i*120,n.midi));
  const deadline=27+(prefix.length-1)*120+27+120000;
  note(deadline-1000,41);
  assert.equal(state[5].laps,1,'both real rollovers remain intact');
  assert.equal(state[5].passed,skipped?0:1);
  assert.equal(state[3],1,'tonic seeds the next round');
  advance(deadline-1);
  assert.equal(state[0],'listening');
  advance(deadline);
  assert.equal(state[0],skipped?'idle':'listening');
  if(!skipped){
   advance(deadline-1000+27+120000);
   assert.equal(state[0],'idle');
  }
 }
});

for (const mode of ['single','loop']) {
 test(mode+' final graph and coach never map a short B-flat ascent to an unplayed descending G3',async()=>{
  const seq=twoOctaves(46).map(note=>note.midi===55?{...note,name:'G',octave:3}:note);
  for(const extras of [[],[60,55],[55,55]]){
   const f=await fixture(seq,mode);
   [46,48,50,51,53].forEach(midi=>f.play(midi));
   for(const midi of extras){f.play(null);f.play(midi,-40);}
   await f.stop();
   const [, ,final, , ,display]=f.last();
   assert.deepEqual(Array.from(final.pairs,p=>p.expected+1),extras.length?[1,2,3,4,5,6]:[1,2,3,4,5]);
   assert.equal(display.values[23],null,'unplayed descent slot cannot receive the earlier G3');
   if(extras.length)assert.equal(Math.round(display.values[5]),-40,'stable G3 may fill its actual nearby ascending slot');
   else assert.equal(display.values[5],null);
   const ctx={module:{exports:{}}};
   vm.runInNewContext(html.split('// PRACTICE_COACH_START')[1].split('// PRACTICE_COACH_END')[0],ctx);
   const facts=ctx.module.exports.evidence(seq,display.values,mode);
   if(extras.length)assert.match(facts.report,/G3.*譜位 6（上行）/);
   else assert.equal(facts.measured,5);
   assert.match(facts.report,/譜位 24（下行）：未辨識/);
  }
 });
}
test('nearby fuzzy recovery remains allowed; distant unanchored pitches do not establish score position',async()=>{
 const seq=twoOctaves(46);
 const f=await fixture(seq);
 f.play(60,-25);f.play(55,-30);f.play(46);f.play(48);f.play(51,-12); // one skipped note can recover
 f.play(53);await f.stop();
 const [, ,final, , ,display]=f.last();
 assert.deepEqual(Array.from(final.pairs,p=>p.expected+1),[1,2,4,5]);
 assert.equal(display.values[5],null);assert.equal(display.values[8],null);
});
