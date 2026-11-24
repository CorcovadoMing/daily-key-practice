const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const url = process.env.URL || 'http://127.0.0.1:8769/experimental/';
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM || '/usr/bin/chromium'});
  try {
    for(const width of [320,390,768,1024,1440]){
    const page = await browser.newPage({viewport:{width,height:900},colorScheme:'light'});
    const origin = new URL(url).origin;
    await page.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    await page.goto(url);
    assert.equal(await page.locator('#draw-button').isVisible(),true);
    assert.equal(await page.locator('#resume-practice').isVisible(),false);
    assert.equal(await page.locator('#major-plus').isVisible(),false);
    assert.equal(await page.locator('input[name="launch-mode"]:checked').inputValue(),'random');
    await page.locator('input[name="launch-mode"][value="sequential"]').check();
    assert.equal(await page.locator('#empty-state').isVisible(),true,'selection alone does not run');
    assert.match(await page.locator('#session-launch-note').textContent(),/已選 12 個大調、12 個小調/);
    const launchBox=await page.locator('#draw-button').boundingBox();
    const roomBox=await page.locator('#classroom-settings').boundingBox();
    assert.ok(launchBox.height>=54&&roomBox.y+roomBox.height<=launchBox.y);
    assert.ok(launchBox.width>=122&&launchBox.width<=134&&launchBox.height>=74&&launchBox.height<=82);
    const gearBox=await page.locator('#launch-options-toggle').boundingBox();
    assert.ok(gearBox.width>=44&&gearBox.height>=44&&gearBox.x>=launchBox.x+launchBox.width);
    assert.ok(Math.abs((launchBox.y+launchBox.height/2)-(gearBox.y+gearBox.height/2))<2);
    const footer=await page.locator('footer').boundingBox();
    const footerNote=await page.locator('.local-audio-note').boundingBox();
    assert.ok(Math.abs(footerNote.x-footer.x)<1);
    const list=page.locator('.result-panel');
    const listTop=(await list.boundingBox()).y;
    const gear=page.locator('#launch-options-toggle');
    const settings=page.locator('#draw-settings');
    await gear.click();
    assert.equal(await page.locator('#major-plus').isVisible(),false,'amounts are random-only');
    await page.keyboard.press('Escape');
    await page.locator('input[name="launch-mode"][value="random"]').check();
    await gear.click();
    assert.equal(await page.locator('#major-plus').isVisible(),true);
    await page.locator('#major-plus').click();
    assert.equal(await page.locator('#major-count').textContent(),'3');
    assert.match(await page.locator('#session-launch-note').textContent(),/已選 12 個大調、12 個小調/);
    assert.equal((await list.boundingBox()).y,listTop,'opening a popover cannot move the list');
    const box=await settings.boundingBox();
    assert.ok(box.x>=7&&box.x+box.width<=width-7);
    assert.ok(box.height<=475);
    await page.keyboard.press('Escape');
    assert.equal(await settings.isVisible(),false);
    await gear.click();
    await page.locator('#page-title').click(); // native light dismiss
    assert.equal(await settings.isVisible(),false);
    const appearance=page.locator('#appearance-toggle');
    assert.equal(await appearance.locator('.theme-sun').isVisible(),true);
    await appearance.click();
    assert.equal(await appearance.locator('.theme-moon').isVisible(),true);
    assert.equal(await appearance.evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');
    assert.equal(await appearance.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
    assert.equal(await page.locator('html').getAttribute('data-appearance'),'dark');
    assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(22, 25, 29)');
    assert.equal(await page.locator('.audio-tools').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(33, 37, 43)');
    await page.reload();
    assert.equal(await page.locator('#appearance-choice').count(),0);
    assert.equal(await page.locator('html').getAttribute('data-appearance'),'dark');
    await page.evaluate(()=>localStorage.setItem('cello-experimental-appearance','system'));
    await page.reload();
    await page.emulateMedia({colorScheme:'dark'});
    await page.waitForFunction(()=>document.documentElement.dataset.appearance==='dark');
    await page.emulateMedia({colorScheme:'light'});
    await page.waitForFunction(()=>document.documentElement.dataset.appearance==='light');
    await appearance.click();
    await page.evaluate(() => {
      let capture;
      const local=window.CelloScalePractice;
      local.controller=local.manager(window,{
        capture:{subscribe(listener){capture=listener;queueMicrotask(()=>listener.ready());return ()=>{};}},
        swiftCapture:{subscribe(listener){capture=listener;queueMicrotask(()=>listener.ready());return ()=>{};}},
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
    const detector=scale.locator('.scale-practice-detector');
    assert.equal(await detector.isVisible(),true);
    const smart=detector.getByRole('radio',{name:'智慧'}),traditional=detector.getByRole('radio',{name:'傳統'});
    assert.equal(await smart.isChecked(),true);
    await smart.focus();await page.keyboard.press('ArrowLeft');
    assert.equal(await traditional.isChecked(),true);
    assert.equal(await arp.locator('.scale-practice-detector').getByRole('radio',{name:'智慧'}).isChecked(),true);
    assert.equal(await scale.getByRole('button',{name:'開始音階練習'}).isVisible(),true);
    const scope=page.locator('.cello-fingerboard').last();
    assert.equal(await scope.locator('.exercise-disclosure').first().getAttribute('open'),null);
    assert.equal(await arp.locator('.scale-practice-coach').isVisible(), false);
    await arp.getByRole('button',{name:'開始琶音練習'}).click();
    await scope.locator('.exercise-nav').getByRole('button',{name:'音階',exact:true}).click();
    assert.equal(await scope.getByRole('button',{name:'停止目前收音'}).isVisible(),true);
    await page.evaluate(()=>window.simulateArpeggio());
    await scope.getByRole('button',{name:'停止目前收音'}).click();
    assert.equal(await scope.getByRole('button',{name:'停止目前收音'}).isVisible(),false);
    assert.equal(await arp.locator('.scale-practice-coach').isVisible(), true);
    assert.equal(await scale.locator('.scale-practice-coach').isVisible(), false);
    await arp.locator('.scale-practice-coach-action').click();
    assert.ok((await page.evaluate(()=>window.lastCoachIds)).includes('arpeggio_leap'));
    assert.match(await arp.locator('.scale-practice-coach-tip').textContent(),/琶音從.*C2.*E2.*再拉一輪琶音/);
    const notation=page.locator('.arpeggio-exercise .cello-scale-score').last();
    assert.equal(await notation.locator('line.scale-stem').last().evaluate(e=>getComputedStyle(e).stroke),'rgb(185, 200, 216)');
    const active=notation.locator('[data-practice-band=near] ellipse').first();
    assert.equal(await active.evaluate(e=>getComputedStyle(e).fill),'rgb(244, 212, 133)');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.theme-choice').count(),0);
    assert.equal(await notation.locator('ellipse').last().evaluate(e=>getComputedStyle(e).fill),'rgb(34, 34, 34)');
    console.log(width,'px: disclosures, dark/print and real arpeggio flow passed.');
    await page.close();
    }
  } finally { await browser.close(); }
})().catch(err=>{console.error(err);process.exitCode=1;});
