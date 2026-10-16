const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('./helpers/ui-harness.cjs');
const {MathModel:M}=require('../dist/working/model.js');
const entry=fs.readFileSync('dist/working/v4-entry.js','utf8');
const STATE_KEY='ai-math-prototype-diagnosis-v1';
function seed({standalone=true,scenario='keep',saved}={}){
  const store=new Map(saved?[[STATE_KEY,saved]]:[]);
  const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  const c={MathModel:M,document:{documentElement:{getAttribute:()=>String(standalone)}},window:{__JEI_REVIEW__:{scenario}},localStorage};
  vm.runInNewContext(entry,c);return {store,c,state:store.has(STATE_KEY)?JSON.parse(store.get(STATE_KEY)):null};
}
test('V4 applies the supplied semantic palette locally without changing earlier themes',()=>{
  const c={window:{}};vm.runInNewContext(fs.readFileSync('dist/theme-model.js','utf8'),c);
  const T=c.window.JeiTheme,before=JSON.stringify(T.THEMES.teal);
  vm.runInNewContext(fs.readFileSync('dist/working/v4-theme.js','utf8'),c);
  const p=T.presetPalette('current');
  for(const [key,value]of Object.entries({'--theme-page':'#ffffff','--theme-title':'#414f62','--theme-active':'#0ec7ae','--theme-completed':'#e5f5fd','--theme-locked':'#fafbfc','--theme-disabled':'#b7bec3','--theme-primary':'#0c9f8b','--theme-on-active':'#ffffff'}))assert.equal(p[key],value);
  assert.equal(JSON.stringify(T.THEMES.teal),before);assert.equal(T.presetPalette('teal')['--theme-page'],'#edf8f8');
  assert.equal(require('../dist/theme-model.js').THEMES.current.roles.page,'#f7f9f4');
});
test('iPad V4 opens the SVG example once, preserves state on reload, and leaves selected test scenarios alone',()=>{
  const {state,c,store}=seed(),topic=state.grades[3][0];
  assert.equal(topic.diagnosis,'done');assert.equal(topic.programs.length,8);
  assert.equal(topic.programs[0].name,'모임의 크기 비교(짝짓기)');assert.equal(topic.programs[0].status,'passed');
  const current=M.currentProgram(topic);assert.equal(current.name,'수가 같은 모임');assert.equal(current.progress,50);
  assert(M.canStudy(topic,current));assert(!M.canStudy(topic,topic.programs[2]));
  topic.programs[1].progress=75;store.set(STATE_KEY,JSON.stringify(state));vm.runInNewContext(entry,c);
  assert.equal(JSON.parse(store.get(STATE_KEY)).grades[3][0].programs[1].progress,75);
  assert.equal(seed({standalone:false}).state,null);assert.equal(seed({scenario:'0'}).state,null);
});
test('V4 demo cards remain interactive and a reset replays the full first diagnosis intro',()=>{
  const h=harness(seed().state);h.click('program',0);assert.equal(h.node('#learning').open,true);assert.equal(h.evaluate('editing.intro'),true);
  h.click('close-learning');h.click('completed-card',1);assert.equal(h.evaluate('activityKind'),'completed-study');
  h.click('close-activity');h.click('test');h.click('preset',0);h.click('diagnosis');
  assert.equal(h.evaluate('editing.intro'),true);assert.match(h.node('#learning').innerHTML,/diagnosis-begin/);
  h.click('diagnosis-begin');assert.equal(h.evaluate('editing.intro'),false);
});
test('V4 iPad entry is a real responsive document with no external review pane or iframe',()=>{
  const registry=JSON.parse(fs.readFileSync('dist/versions.json','utf8')),version=registry.versions.find(v=>v.label==='V4');assert(version);
  const html=fs.readFileSync('dist/v4.html','utf8');
  assert.match(html,new RegExp('data-version="'+version.id+'"'));assert.match(html,/data-v4-standalone="true"/);
  assert.match(html,/width=device-width,initial-scale=1/);assert.match(html,/apple-mobile-web-app-capable/);
  assert(!html.includes('<iframe'));assert(!html.includes('workspace.js'));assert(!html.includes('id="version-list"'));
  assert.match(html,/NanumSquareRoundR\.woff2/);
  const base=new URL(`/versions/${version.id}/`,'https://example.test');
  for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const u=new URL(m[1],base);if(u.origin!==base.origin)continue;
    assert(fs.existsSync('dist'+decodeURIComponent(u.pathname)),'missing entry asset '+u.pathname);
  }
});
