const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness:baseHarness}=require('./helpers/ui-harness.cjs');
const {MathModel:M}=require('../dist/working/model.js');
const registry=JSON.parse(fs.readFileSync('dist/versions.json','utf8'));
const targets=registry.versions.filter(v=>v.label==='V4.9'||/^V[56](?:\.|$)/.test(v.label));
assert.equal(targets.length,11);
function outlineGeometry(h,height=210){
  const list=h.node('#group-panel .group-list'),count=h.evaluate('state.grades[state.grade].length');
  list.clientHeight=height;list.scrollHeight=count*64+6;
  list.getBoundingClientRect=()=>({top:500,bottom:500+list.clientHeight,height:list.clientHeight});
  for(let i=0;i<count;i++)h.node(`#group-panel [data-action="select-group"][data-id="${i}"]`).getBoundingClientRect=()=>({top:500+i*64-list.scrollTop,bottom:556+i*64-list.scrollTop,height:56});
  h.node('#group-panel .group-list>.group-item:last-child').getBoundingClientRect=()=>({top:500+(count-1)*64-list.scrollTop,bottom:556+(count-1)*64-list.scrollTop,height:56});
  return {list,count};
}
for(const version of targets){
  const appSource=fs.readFileSync('dist/'+version.path+'app.js','utf8');
  const harness=(saved,options={})=>baseHarness(saved,{...options,appSource});

  test(`${version.label} opens the mobile outline at the current topic without moving the main page or reordering topics`,()=>{
    const h=harness(undefined,{reducedMotion:false,initialScroll:640,viewportHeight:844});h.context.innerWidth=390;
    h.evaluate('state.index=8;current().diagnosis="active";render()');const before=h.data('state.grades');
    const {list}=outlineGeometry(h);h.click('groups');
    assert.equal(list.scrollTop,512);assert.equal(h.context.scrollY,640);assert.equal(h.scrollCalls.length,0);
    assert.equal(h.node('#overlay').hidden,true);assert.equal(h.node('#group-panel').getAttribute('aria-hidden'),'false');
    assert.equal(h.node('.groups-trigger').getAttribute('aria-expanded'),'true');
    const ids=[...h.node('#group-panel').innerHTML.matchAll(/data-action="select-group" data-id="(\d+)"/g)].map(m=>Number(m[1]));
    assert.deepEqual(ids,Array.from({length:ids.length},(_,i)=>i));
    assert(h.node('#group-panel').innerHTML.includes('mobile-sheet-handle'));assert.deepEqual(h.data('state.grades'),before);
    list.scrollTop=128;h.evaluate('renderPanel();render();syncGuidanceReminders()');assert.equal(list.scrollTop,128);
    h.click('close-panel');h.click('groups');assert.equal(list.scrollTop,512);assert.equal(h.context.scrollY,640);
  });

  test(`${version.label} aligns even the last topic and recalculates trailing room only when the selection or size changes`,()=>{
    const h=harness();h.context.innerWidth=390;const {list,count}=outlineGeometry(h);
    h.evaluate(`state.index=${count-1};current().diagnosis='active';render()`);h.click('groups');
    assert.equal(list.scrollTop,(count-1)*64);assert.equal(list.style['--rail-tail-space'],'140px');
    list.clientHeight=260;h.emitWindow('resize');assert.equal(list.scrollTop,(count-1)*64);assert.equal(list.style['--rail-tail-space'],'190px');
    h.evaluate("state.index=2;current().diagnosis='active';render()");assert.equal(list.scrollTop,128);
    assert.equal(list.style['--rail-tail-space'],'0px');
    list.scrollTop=64;h.evaluate('renderPanel();render()');assert.equal(list.scrollTop,64);
    h.click('select-group',0);assert.equal(h.evaluate('state.index'),2);assert.equal(list.scrollTop,64);
  });

  test(`${version.label} keeps real diagnosis resume and saved answers intact while the mobile sheet is used`,()=>{
    const saved=M.create();saved.grades[3][0].diagnosis='active';saved.grades[3][0].diagnosticSession={index:1,answers:[0],started:123456,notes:'keep'};saved.ui={diagnosisIntroSeen:true,diagnosisWelcomeSeen:true};
    const h=harness(saved),before=h.data('current().diagnosticSession');h.context.innerWidth=390;
    outlineGeometry(h);h.click('groups');h.click('close-panel');h.click('diagnosis');
    assert.equal(h.evaluate('editing.intro'),false);assert.equal(h.node('#learning').open,true);
    assert.deepEqual(h.data('current().diagnosticSession'),before);assert.equal(h.evaluate('current().programs.length'),0);
  });
}

test('the authorized versions all load the same mobile correction after their original version styles',()=>{
  const mobileOnly=css=>css.replace(/^:root\[data-resume-scrolling=true\].*\n/,'');
  const common=mobileOnly(fs.readFileSync('dist/working/mobile.css','utf8'));
  for(const v of targets){
    assert.equal(mobileOnly(fs.readFileSync('dist/'+v.path+'mobile.css','utf8')),common);
    const html=fs.readFileSync('dist/'+v.path+'index.html','utf8');
    const styles=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
    if(['V6.3','V6.4'].includes(v.label)){assert.equal(styles.at(-2),'mobile.css');assert.equal(styles.at(-1),'diagnosis-entry.css');}else assert.equal(styles.at(-1),'mobile.css');assert(html.includes('viewport-fit=cover'));
    const view=fs.readFileSync('dist/views/'+v.id+'.html','utf8');assert.match(view,/href="mobile\.css\?r=[a-f\d]+"/);
  }
  for(const file of ['v4.html','v5.html','v6.html','v6-2-1.html','v6-2-2.html','v6-2-3.html'])assert.match(fs.readFileSync('dist/'+file,'utf8'),/href="mobile\.css\?r=[a-f\d]+"/);
});
