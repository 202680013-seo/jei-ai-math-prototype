const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {harness}=require('./helpers/ui-harness.cjs');
const {MathModel:M}=require('../dist/working/model.js');
const registry=JSON.parse(fs.readFileSync('dist/versions.json'));
const version=registry.versions.find(v=>v.label==='보고용 V1'),base='dist/'+version.path;
const read=name=>fs.readFileSync(base+name,'utf8');
function language(){
 const storage=new Map(),root={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 for(const name of ['report-copy.js','report-catalog.js'])vm.runInNewContext(read(name),{window:root,Map,Date});
 root.MentorCopy=require('../dist/working/mentor-copy.js');vm.runInNewContext(read('report-mentor.js'),{window:root});
 return {I:root.JeiReportI18n,root,storage};
}
test('the report is a distinct native version and does not replace V6.4 or working',()=>{
 assert.equal(registry.working.basedOn,'v69');assert.equal(registry.working.matchesBaseline,true);
 assert(version.id!=='v69');assert.equal(registry.versions.find(v=>v.id==='v69').label,'V6.4');
 const html=fs.readFileSync('dist/report-v1.html','utf8');assert(html.includes('data-report-presentation="true"'));
 assert(html.includes('data-version="'+version.id+'"'));assert(!html.includes('class="settings-trigger"'));
 for(const file of ['report-copy.js','report-catalog.js','report-mentor.js','report.js','report.css'])assert(html.includes(file));
 assert(fs.readFileSync('dist/v6-4.html','utf8').includes('data-version="v69"'));
});
test('language switching translates main flows, dynamic metrics and all curriculum labels without changing learning storage',()=>{
 const {I,root,storage}=language();const saved=JSON.stringify(M.create());storage.set('ai-math-prototype-diagnosis-v1',saved);I.setLanguage('en');
 for(const copy of ['비교와 분류','나의 실력을 알아볼까요?','실력알기 결과 확인','모임의 크기 비교(<,>)','활동을 고르고 있어요','저장하고 나가기','계속 풀기','실력알기를 통과했어요!','카드를 눌러 복습해보세요!','정답 2개 · 오답 1개','2 / 3문제 · 67%']){
  const en=I.t(copy);assert.notEqual(en,copy,copy);assert(!/[가-힣]/.test(en),en);I.setLanguage('ko');assert.equal(I.t(en),copy);I.setLanguage('en');
 }
 assert.equal(I.t('3 다음에 오는 수를 골라요.'),'Which number comes after 3?');
 const labels=Object.entries(root.JeiReportCatalog);assert(labels.length>1300);for(const [ko,en]of labels){assert(en.trim());assert(!/[가-힣]/.test(en),ko);}
 assert.equal(storage.get('ai-math-prototype-diagnosis-v1'),saved);
});
test('all mentor event templates have English copy, and the app measures full English sentences before paging',()=>{
 const {I,root}=language();I.setLanguage('en');
 for(const r of root.MentorCopy.rules)for(const template of r.messages){const ko=template.replace(/\[이름\]/g,'재능').replace(/\[X\]/g,'D').replace(/\[[^\]]+\]/g,'3');assert(!/[가-힣]/.test(I.t(ko)),r.id+' '+I.t(ko));}
 const h=harness(undefined,{appSource:read('app.js')});h.context.JeiReportI18n=I;
 h.evaluate("const reportRun={fullText:'오늘은 무엇부터 시작해 볼까요?',index:0};prepareMentorPages(reportRun)");
 assert.equal(h.evaluate('reportRun.fullText'),'What would you like to start with today?');assert(h.evaluate('reportRun.pages.length')>0);
});
test('the report starts with its own representative fixture and never overwrites saved or explicit validation state',()=>{
 for(const [existing,scenario,seeded]of [[null,'keep',true],['saved-progress','keep',false],[null,'0',false]]){
  const store=new Map(existing?[['ai-math-prototype-diagnosis-v1',existing]]:[]);
  vm.runInNewContext(read('report-seed.js'),{MathModel:M,window:{__JEI_REVIEW__:{scenario}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}});
  const value=store.get('ai-math-prototype-diagnosis-v1');if(seeded){const p=JSON.parse(value).grades[3][0].programs;assert.equal(p.length,8);assert.deepEqual(p.slice(0,3).map(p=>p.status),['passed','failed','active']);assert.equal(p[2].progress,50);}else assert.equal(value,existing||undefined);
 }
});
test('report diagnosis retains the two-answer resume and clean-pass reward/rail handoff',()=>{
 const h=harness(undefined,{appSource:read('app.js')});h.click('diagnosis');h.click('diagnosis-begin');
 for(let i=0;i<2;i++){h.click('diagnosis-answer',h.evaluate('DEMO['+i+'].correct'));h.click('diagnosis-next');}
 h.click('close-learning');h.click('diagnosis-leave');assert.equal(h.node('#diagnosis-welcome-progress').getAttribute('aria-valuenow'),'67');
 const restored=harness(h.saved(),{appSource:read('app.js')});assert.equal(restored.node('#diagnosis-welcome-progress').getAttribute('data-progress-stage'),'partial');
 restored.click('diagnosis');restored.click('diagnosis-answer',restored.evaluate('DEMO[2].correct'));restored.click('diagnosis-next');restored.click('diagnosis-outcome-confirm');
 for(let i=0;restored.evaluate('!!diagnosisOutcomeRun')&&i<12;i++){const timer=restored.evaluate('diagnosisOutcomeTimer');assert(timer&&!timer.cancelled);timer.fn();}
 assert.equal(restored.evaluate('diagnosisOutcomeRun'),null);assert.equal(restored.evaluate('state.index'),1);assert.equal(restored.evaluate('skyState().totalPieces'),3);
});
test('Theme 2 uses original white Figma exports in their native-sized slots',()=>{
 const manifest=JSON.parse(read('assets/report-theme2/manifest.json'));assert.equal(manifest.frame,'74:719');
 for(const file of manifest.assets){const data=fs.readFileSync(base+'assets/report-theme2/'+file.file);assert(data.length>100);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),file.sha256);assert(data.toString().startsWith('<svg'));}
 const css=read('report.css');assert(css.includes('background:#0ec7ae'));assert(css.includes('background:#0cad98'));assert(css.includes('background:#f1fcfa'));
 assert(!css.includes('width:100%;height:100%'));assert(read('report.js').includes("dialogs.at(-1)||document.body"));
});
