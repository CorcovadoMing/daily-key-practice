const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
test('sample bank and calibrations are the independently octave-verified pair',()=>{
 const html=read('index.html'), js=read('fingerboard-editor.js');
 const encoded=js.match(/\nCELLO_DEMO_MP3_START\n([A-Za-z0-9+/=]+)\nCELLO_DEMO_MP3_END\n/)?.[1];
 a.ok(encoded);
 const payload=Buffer.from(encoded,'base64'); a.equal(payload.length,172268);
 a.equal(crypto.createHash('sha256').update(payload).digest('hex'),'b5dcbd7e71fc90a51461a1c007ebd61650f7f12565c09c761e9bf254afd4aacb');
 const table=JSON.parse(html.match(/const celloDemoRoots = (\[.*?\]);/)[1]);
 a.equal(table.length,13);
 for(let i=0;i<table.length;i++){
   const [f,s]=table[i],m=36+i*3;
   a.ok(Math.abs(1200*Math.log2(f/(440*2**((m-69)/12))))<10);
   a.equal(s,Number((.08+1.65*i).toFixed(2)));
 }
 a.match(html,/fingerboard-editor\.js\?v=20261126-cello-audio-2/);
});
