const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/ui-harness.cjs');
const {MathModel:M}=require('../dist/versions/v71/model.js');
const appSource=fs.readFileSync('dist/versions/v74/app.js','utf8');
function finish(h){h.click('diagnosis-outcome-confirm');for(let i=0;h.evaluate('!!diagnosisOutcomeRun')&&i<20;i++){
 const stage=h.evaluate('diagnosisOutcomeRun.target.diagnosisOutcome.stage');assert(!['reward','collecting'].includes(stage));
 const timer=h.evaluate('diagnosisOutcomeTimer');assert(timer&&!timer.cancelled);timer.fn();
}assert.equal(h.evaluate('diagnosisOutcomeRun'),null);assert.equal(h.node('#learning-workspace').inert,false);}
test('V4 diagnosis omits reward screens for every result and still opens prescriptions or the next set',()=>{
 for(const answers of [[0,1],[0,0],[1,1],[1,0]]){
 const h=harness(undefined,{appSource,mathModel:M});h.click('diagnosis');
 for(const answer of answers){h.click('diagnosis-answer',answer);h.click('diagnosis-next');}
 assert.equal(h.node('#composition-copy').textContent,'');
 finish(h);const correct=Number(answers[0]===0)+Number(answers[1]===1);
 assert.equal(h.evaluate('skyState().totalPieces'),correct);
 if(correct===2)assert.equal(h.evaluate('state.index'),1);else assert(h.evaluate('current().programs.length')>0);
 }
});
test('V4 normal and review outcomes return without reward delays or duplicated completion copy',()=>{
 for(const review of [false,true])for(const failed of [false,true]){
 const h=harness(undefined,{appSource,mathModel:M});
 if(review){h.seed('passed',true);h.click('completed-card',0);h.click('study-choice-review');}
 else{h.evaluate("current().diagnosis='done';current().programs=M.programs(2);render()");h.click('program',0);}
 h.click('learner-answer',0);h.click('learner-next');h.click('learner-answer',failed?0:1);h.click('learner-next');
 assert.equal(h.node('#composition-copy').textContent,'');assert(!h.node('#diagnosis-inline-summary').innerHTML.includes('report-set-complete-note'));
 finish(h);assert.equal(h.evaluate('skyState().totalPieces'),failed?1:2);assert.equal(h.evaluate('state.index'),0);
 }
});
