const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'),fs=require('fs'),a=require('assert/strict');
const d=new JSDOM(fs.readFileSync('index.html','utf8')).window.document;
const side=d.querySelector('.setup-sidebar'),stats=d.querySelector('.practice-stats'),classroom=d.querySelector('.classroom-bar');
a.equal(stats.parentElement,side);a.equal(classroom.parentElement,side);a.equal(classroom.nextElementSibling,stats);
a.equal(stats.closest('.classroom-bar'),null);a.equal(side.nextElementSibling.getAttribute('aria-labelledby'),'settings-title');
a.equal(stats.querySelector('#practice-stats-grid').id,'practice-stats-grid');a.equal(stats.getAttribute('aria-labelledby'),'practice-stats-title');
a.equal(stats.querySelector('h3').textContent,'累積練習');
console.log('PASS separate sibling classroom/stats cards in shared sidebar, stats IDs and accessible heading preserved');
