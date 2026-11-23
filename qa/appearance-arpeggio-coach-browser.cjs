const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const url = process.env.URL || 'http://127.0.0.1:8769/experimental/';
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM || '/usr/bin/chromium'});
  try {
    const page = await browser.newPage({viewport:{width:390,height:900},colorScheme:'light'});
    const origin = new URL(url).origin;
    await page.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    await page.goto(url + '?coach=1');
    await page.selectOption('#appearance-choice','dark');
    assert.equal(await page.locator('html').getAttribute('data-appearance'),'dark');
    assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(21, 26, 24)');
    assert.equal(await page.locator('.audio-tools').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(33, 42, 37)');
    await page.reload();
    assert.equal(await page.locator('#appearance-choice').inputValue(),'dark');
    await page.selectOption('#appearance-choice','system');
    await page.emulateMedia({colorScheme:'dark'});
    await page.waitForFunction(()=>document.documentElement.dataset.appearance==='dark');
    await page.emulateMedia({colorScheme:'light'});
    await page.waitForFunction(()=>document.documentElement.dataset.appearance==='light');
    await page.selectOption('#appearance-choice','dark');
    await page.evaluate(() => {
      let capture;
      const local=window.CelloScalePractice;
      local.controller=local.manager(window,{
        capture:{subscribe(listener){capture=listener;queueMicrotask(()=>listener.ready());return ()=>{};}},
        reference:()=>442,
        pitchReading:(midi)=>({midi,cents:midi===40?28:-12}),
        pitchName:midi=>String(midi)
      });
      window.simulateArpeggio=()=>{
        const start=performance.now();
        // C-major arpeggio: C2, E2, G2, C3. Change MIDI across realistic frames.
        [36,40,43,48].forEach((frequency,i)=>[0,26,42].forEach(dt=>capture.frame({now:start+i*75+dt,frequency,muted:false})));
      };
      const host = document.querySelector('main');
      host.append(CelloFingerboard.create('major',['C',0,'C D E F G A B'],{}));
      // Stub only inference; manager, cards, score generation, alignment and view are real.
      const coach=window.CelloPracticeCoach;
      coach.service=()=>({isBusy:()=>false,cancel(){},dispose(){},
        async run(options){window.lastCoachIds=options.map(x=>x.id);return {choice:options.find(x=>x.id==='arpeggio_leap')};}});
    });
    const arp = page.locator('.cello-fingerboard [data-practice-kind=arpeggio]').last();
    const scale = page.locator('.cello-fingerboard [data-practice-kind=scale]').last();
    assert.equal(await arp.locator('.scale-practice-coach').isVisible(), false);
    await arp.getByRole('button',{name:'開始琶音練習'}).click();
    await page.evaluate(()=>window.simulateArpeggio());
    await arp.getByRole('button',{name:'停止琶音練習並看結果'}).click();
    assert.equal(await arp.locator('.scale-practice-coach').isVisible(), true);
    assert.equal(await scale.locator('.scale-practice-coach').isVisible(), false);
    await arp.locator('.scale-practice-coach-action').click();
    assert.ok((await page.evaluate(()=>window.lastCoachIds)).includes('arpeggio_leap'));
    assert.match(await arp.locator('.scale-practice-coach-tip').textContent(),/琶音從.*C2.*E2.*再拉一輪琶音/);
    const notation=page.locator('.arpeggio-exercise .cello-scale-score').last();
    assert.equal(await notation.locator('line.scale-stem').last().evaluate(e=>getComputedStyle(e).stroke),'rgb(185, 203, 192)');
    const active=notation.locator('[data-practice-band=near] ellipse').first();
    assert.equal(await active.evaluate(e=>getComputedStyle(e).fill),'rgb(244, 212, 133)');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.theme-choice').isVisible(),false);
    assert.equal(await notation.locator('ellipse').last().evaluate(e=>getComputedStyle(e).fill),'rgb(34, 34, 34)');
    console.log('Browser dark/print and actual arpeggio start/stop advice passed.');
  } finally { await browser.close(); }
})().catch(err=>{console.error(err);process.exitCode=1;});
