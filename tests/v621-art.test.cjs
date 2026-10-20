const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness:baseHarness}=require('./helpers/ui-harness.cjs');
const {MathModel:M}=require('../dist/working/model.js');
const registry=JSON.parse(fs.readFileSync('dist/versions.json','utf8'));
const cases=[{label:'V6.2.1',kind:'lens',height:134,parts:1},{label:'V6.2.2',kind:'puzzle',height:112,parts:4},{label:'V6.2.3',kind:'brain',height:154,parts:1}];
function active(answers=[0]){
  const s=M.create();s.grades[3][0].diagnosis='active';
  s.grades[3][0].diagnosticSession={answers,index:answers.length,started:Date.now(),notes:'preserved'};
  s.ui={diagnosisWelcomeSeen:true,diagnosisIntroSeen:true};return s;
}
function releaseDim(h){const t=h.evaluate('guidanceClosingTimer');if(t&&!t.cancelled)t.fn();}
for(const c of cases){
  const v=registry.versions.find(v=>v.label===c.label);assert(v,`${c.label} is saved`);
  const source=fs.readFileSync('dist/'+v.path+'app.js','utf8');
  const harness=(saved,options={})=>baseHarness(saved,{...options,appSource:source});

  test(`${c.label} represents actual answered-question progress, never accuracy or invented activity`,()=>{
    for(const [answers,solved] of [[[],0],[[0],1],[[0,1],2],[[0,1,2],3],[[99,-1,null],0]]){
      const h=harness(active(answers)),art=h.node('#diagnosis-welcome-progress');
      assert.equal(art.getAttribute('data-art-kind'),c.kind);
      assert.equal(art.getAttribute('aria-valuenow'),String(Math.round(solved/3*100)));
      assert.equal(art.getAttribute('data-progress-stage'),solved===0?'empty':solved===3?'complete':'partial');
      for(let i=0;i<c.parts;i++){
        const part=Math.min(1,Math.max(0,solved/3*c.parts-i)),shift=Number(h.node('#diagnosis-art-level-'+i).style.transform.match(/[\d.]+/)[0]);
        assert(Math.abs(shift-c.height*(1-part))<.000001);
      }
      assert.equal(h.node('#diagnosis-art-count').textContent,solved?`${solved} / 3`:'');
      assert.equal(h.node('#diagnosis-art-count').getAttribute('visibility'),solved?'visible':'hidden');
      assert.equal(h.node('#diagnosis-art-preview-label').hidden,true);
      const actual=h.data('current().diagnosticSession');h.evaluate('render();render();syncGuidanceReminders()');assert.deepEqual(h.data('current().diagnosticSession'),actual);
    }
  });

  test(`${c.label} previews the complete fill and restores actual progress without changing answers or rewards`,()=>{
    const h=harness(active(),{reducedMotion:false}),before=h.data('current()'),sky=h.data('state.sky||null');
    h.click('test');assert(h.node('#test-panel').innerHTML.includes('채워지는 모션 보기'));
    h.click('welcome-preview-motion');releaseDim(h);
    assert.equal(h.node('#diagnosis-art-preview-label').hidden,false);
    assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('data-art-preview'),'true');
    assert.match(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuetext'),/실제 풀이 진도와 관계없어요/);
    for(const step of [1,2,3]){
      const run=h.evaluate('diagnosisArtPreview');assert.equal(run.timer.ms,2400);run.timer.fn();
      assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),String(Math.round(step/3*100)));
      assert.equal(h.node('#diagnosis-art-count').getAttribute('visibility'),'hidden');
    }
    assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('data-progress-stage'),'complete');
    assert.equal(h.evaluate('diagnosisArtPreview.timer.ms'),3600);h.evaluate('diagnosisArtPreview.timer.fn()');
    assert.equal(h.evaluate('diagnosisArtPreview'),null);assert.equal(h.node('#diagnosis-art-preview-label').hidden,true);
    assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'33');
    assert.equal(h.node('#diagnosis-art-count').textContent,'1 / 3');
    assert.deepEqual(h.data('current()'),before);assert.deepEqual(h.data('state.sky||null'),sky);
    const restored=harness(h.saved());assert.equal(restored.evaluate('diagnosisArtPreview'),null);
    assert.deepEqual(restored.data('current().diagnosticSession'),before.diagnosticSession);
  });

  test(`${c.label} pauses previews under dims, hidden tabs and suspension, and invalidates them when real diagnosis starts`,()=>{
    const h=harness(undefined,{reducedMotion:false});h.click('test');h.click('welcome-preview-motion');releaseDim(h);
    const run=h.evaluate('diagnosisArtPreview'),first=run.timer;
    h.document.visibilityState='hidden';h.emitDocument('visibilitychange');assert.equal(first.cancelled,true);assert.equal(run.timer,null);
    assert.equal(h.node('#diagnosis-welcome').getAttribute('data-welcome-motion'),'paused');
    h.document.visibilityState='visible';h.emitDocument('visibilitychange');first.fn();assert.equal(run.step,0);assert(run.timer);
    h.click('test');assert.equal(run.timer,null);h.click('close-panel');releaseDim(h);assert(run.timer);
    h.emitWindow('pagehide');assert.equal(run.timer,null);h.emitWindow('pageshow');assert(run.timer);
    const stale=run.timer;h.click('diagnosis');assert.equal(h.evaluate('diagnosisArtPreview'),null);assert.equal(h.evaluate('editing.intro'),true);
    stale.fn();assert.equal(h.evaluate('diagnosisArtPreview'),null);assert.equal(h.evaluate('editing.intro'),true);
    const reduced=harness();reduced.click('test');reduced.click('welcome-preview-motion');releaseDim(reduced);
    assert.equal(reduced.evaluate('diagnosisArtPreview.step'),3);
    const changed=harness(undefined,{reducedMotion:false});changed.click('test');changed.click('welcome-preview-motion');releaseDim(changed);
    changed.media.matches=true;changed.evaluate('observeDiagnosisWelcomeVisit()');assert.equal(changed.evaluate('diagnosisArtPreview.step'),3);
  });

  test(`${c.label} keeps SVG fragments in the actual native document and does not restart geometry on stable renders`,()=>{
    const h=harness(active());
    const href=`https://example.test/${c.label.toLowerCase().replaceAll('.','-')}.html?theme=green#top`;
    h.context.location={href};h.evaluate('syncDiagnosisArtReferences()');
    const page=href.split('#')[0];
    for(let i=0;i<c.parts;i++){
      assert.equal(h.node('#diagnosis-art-clip-'+i).getAttribute('clip-path'),`url("${page}#diagnosis-art-shape-${i}")`);
      assert.equal(h.node('#diagnosis-art-fill-'+i).getAttribute('fill'),`url("${page}#diagnosis-art-color")`);
    }
    let writes=0;const el=h.node('#diagnosis-art-level-0'),value=el.style.transform;
    Object.defineProperty(el.style,'transform',{get:()=>value,set(){writes++;},configurable:true});
    h.evaluate('render();render();syncGuidanceReminders()');assert.equal(writes,0);
  });
}

test('all three concepts have separately scoped native iPad entries, semantic colors and continuous but pausable motion',()=>{
  for(const c of cases){
    const v=registry.versions.find(v=>v.label===c.label),file=c.label.toLowerCase().replaceAll('.','-')+'.html';
    assert.equal(v.family,'v64');
    const html=fs.readFileSync('dist/'+file,'utf8');
    assert(html.includes(`data-version="${v.id}"`));assert(html.includes('data-v6-standalone="true"'));
    assert(html.includes('NanumSquareRoundR.woff2'));assert(!html.includes('<iframe'));assert(!html.includes('workspace.js'));
    const base=new URL(`/versions/${v.id}/`,'https://example.test');
    for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){
      const url=new URL(m[1],base);if(url.origin===base.origin)assert(fs.existsSync('dist'+decodeURIComponent(url.pathname)),url.pathname);
    }
    const css=fs.readFileSync('dist/'+v.path+'v6.css','utf8');assert(css.includes('var(--theme-accent)'));
    assert(css.includes('infinite'));assert(css.includes('animation-play-state:paused!important'));assert(css.includes('prefers-reduced-motion:reduce'));
    const art=html.slice(html.indexOf('class="welcome-art"'),html.indexOf('</section><div id="diagnosis-slot"'));
    const ids=[...art.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
    assert(!art.includes('sheet-paper'));assert(art.includes(`data-art-kind="${c.kind}"`));
  }
});
