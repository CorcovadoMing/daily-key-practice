const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function motion(reduced=false){
  let y=0,abs=1000,now=0,arrivals=0;const handlers={},frames=[],positions=[];
  const root={clientHeight:500,scrollHeight:2000};
  const target={isConnected:true,getBoundingClientRect:()=>({top:abs-y})};
  const window={get scrollY(){return y},scrollTo({top,behavior}){assert.equal(behavior,'instant');positions.push(y=top)},matchMedia:()=>({matches:reduced}),addEventListener(k,h){handlers[k]=h}};
  const ctx={window,document:{documentElement:root,scrollingElement:root},getComputedStyle:e=>e===root?{scrollPaddingTop:'20px'}:{scrollMarginTop:'10px'},performance:{now:()=>now},requestAnimationFrame:f=>frames.push(f)};
  const program=html.slice(html.indexOf('    let cardScrollRequest=0;'),html.indexOf('    function jumpToPractice('));
  vm.runInNewContext(program+';this.start=(target,finish)=>scrollToPracticeLanding(target,++cardScrollRequest,finish)',ctx);
  return {target,handlers,positions,resize:height=>root.scrollHeight=height,start:()=>ctx.start(target,()=>arrivals++),get arrivals(){return arrivals},
    move:point=>{abs=point},tick:t=>{now=t;frames.splice(0).forEach(f=>f(now));}};
}
test('navigation has one easing leg and follows a changing layout',()=>{
 const m=motion();m.start();m.tick(80);m.tick(160);assert.equal(m.arrivals,0);
 m.move(950);m.tick(240);m.tick(320);
 assert.equal(m.arrivals,1);assert.equal(m.positions.at(-1),920);
 assert.ok(m.positions.every((y,i)=>!i||y>=m.positions[i-1]));
});
test('reduced motion settles immediately with configured offsets',()=>{
 const m=motion(true);m.start();assert.deepEqual(m.positions,[970]);assert.equal(m.arrivals,1);
});
test('wheel, touch, keyboard and a newer request cannot trigger the old landing',()=>{
 const tests=[m=>m.handlers.wheel(),m=>m.handlers.touchmove(),m=>m.handlers.keydown({key:'Tab'}),m=>{m.target.isConnected=false}];
 for(const cancel of tests){
  const m=motion();m.start();m.tick(80);const count=m.positions.length;
  cancel(m);m.tick(500);assert.equal(m.arrivals,0);assert.equal(m.positions.length,count);
 }
 const m=motion();m.start();m.tick(35);m.start();m.tick(440);assert.equal(m.arrivals,1);
});

test('a short page retains the destination within the scrollable range',()=>{
 const m=motion();m.resize(780);m.start();m.tick(320);assert.equal(m.arrivals,1);
 assert.equal(m.positions.at(-1),280);
});
