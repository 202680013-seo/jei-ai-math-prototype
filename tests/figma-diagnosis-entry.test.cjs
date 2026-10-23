const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness:base}=require('./helpers/ui-harness.cjs');
const {MathModel:M}=require('../dist/working/model.js');
const registry=JSON.parse(fs.readFileSync('dist/versions.json'));
const source=label=>fs.readFileSync('dist/'+registry.versions.find(v=>v.label===label).path+'app.js','utf8');
function saved(answers){const s=M.create();s.grades[3][0].diagnosis='active';s.grades[3][0].diagnosticSession={answers,index:Math.min(answers.length,2),notes:'보존'};s.ui={diagnosisWelcomeSeen:true,diagnosisIntroSeen:true};return s;}
for(const [label,kind] of [['V6.3','puzzle'],['V6.4','clover']]){
  const harness=(state,options={})=>base(state,{appSource:source(label),...options});
  test(label+' shows only valid saved answered-question progress and keeps stable renders still',()=>{
    for(const [answers,solved,pieces] of [[[],0,0],[[0],1,1],[[0,1],2,2],[[0,1,2],3,4],[[99,-1,null],0,0]]){
      const h=harness(saved(answers)),a=h.node('#diagnosis-welcome-progress');
      assert.equal(a.getAttribute('data-art-kind'),kind);assert.equal(a.getAttribute('aria-valuenow'),String(Math.round(solved/3*100)));
      assert.equal(a.getAttribute('data-fitted-pieces'),String(pieces));
      for(let i=0;i<4;i++)assert.equal(h.node('#diagnosis-art-piece-'+i).getAttribute('data-piece-state'),i<pieces?'complete':'empty');
      assert(Math.abs(Number(h.node('#diagnosis-clover-fill').style.clipPath.match(/[\d.]+/)[0])-200*(1-solved/3))<.000001);
      assert.equal(h.node('#diagnosis-clover-bubble').hidden,solved>0);
      if(label==='V6.4')assert.match(h.node('#diagnosis-clover-fill').style.clipPath,/px 0 0 0\)$/,'Filled stem must remain visible with the original leaves');
      const before=h.data('current()');let writes=0;const set=a.setAttribute.bind(a);a.setAttribute=(...args)=>{writes++;set(...args);};
      h.evaluate('render();render();syncGuidanceReminders()');assert.equal(writes,0);assert.deepEqual(h.data('current()'),before);
    }
  });
  test(label+' saves an answer when leaving and restores the same progress after reload and resume',()=>{
    const h=harness(saved([0]));h.click('diagnosis');assert.equal(h.evaluate('editing.intro'),false);
    h.click('diagnosis-answer',1);h.click('close-learning');h.click('diagnosis-leave');
    assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'67');
    const restored=harness(h.saved());assert.equal(restored.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'67');
    restored.click('diagnosis');assert.equal(restored.evaluate('editing.intro'),false);assert.deepEqual(restored.data('current().diagnosticSession.answers'),[0,1]);
  });
  test(label+' previews the full graphic without replacing real answers or rewards',()=>{
    const h=harness(saved([0]),{reducedMotion:false}),before=h.data('current()'),sky=h.data('state.sky||null');
    h.click('welcome-preview-motion');
    for(let i=0;i<4;i++)h.evaluate('diagnosisArtPreview.timer.fn()');
    assert.equal(h.evaluate('diagnosisArtPreview'),null);assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'33');
    assert.deepEqual(h.data('current()'),before);assert.deepEqual(h.data('state.sky||null'),sky);
    h.document.visibilityState='hidden';h.emitDocument('visibilitychange');assert.equal(h.node('#diagnosis-welcome').getAttribute('data-welcome-motion'),'paused');
  });
}
