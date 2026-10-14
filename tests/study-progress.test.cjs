const test=require('node:test'),assert=require('node:assert/strict');
const {MathModel:M}=require('../dist/working/model.js');

test('diagnosis progress counts selected answers, including answer zero, without changing state',()=>{
  const state=M.create(),s=state.grades[state.grade][state.index];
  assert.equal(M.studyProgress(s).value,0);
  s.diagnosis='active';s.diagnosticSession={answers:[0,undefined,1]};
  const before=JSON.stringify(s);
  assert.equal(M.studyProgress(s).value,67);
  assert.equal(JSON.stringify(s),before);
  s.diagnosticSession.answers=[0,1,1];assert.equal(M.studyProgress(s).value,100);
  s.diagnosis='done';s.diagnosticSession=null;
  assert.equal(M.studyProgress(s).phase,'complete');assert.equal(M.studyProgress(s).value,100);
});

test('prescribed progress weights actual questions instead of averaging differently sized cards',()=>{
  const s={diagnosis:'done',programs:[{frames:[1],progress:100,status:'passed'},{frames:[1,2,3],progress:0,status:'idle'}]};
  assert.equal(M.studyProgress(s).value,25);
  s.programs[1].progress=100;s.programs[1].status='failed';
  const before=JSON.stringify(s);
  assert.equal(M.studyProgress(s).value,100);
  assert.equal(M.studyProgress(s).label,'맞춤 학습 풀이');
  assert.equal(M.status(s),'failed');assert.equal(JSON.stringify(s),before);
});

test('sample and invalid progress stay finite and bounded',()=>{
  const s={diagnosis:'done',programs:[{frames:[],progress:Infinity},{progress:-50},{frames:[1],progress:200}]};
  assert.equal(M.studyProgress(s).value,33);
  s.programs=[{frames:[],progress:50}];assert.equal(M.studyProgress(s).value,50);
  s.programs=[{frames:Array(200).fill(1),progress:100},{frames:[1],progress:50}];
  assert.equal(M.studyProgress(s).value,99); // remaining questions never round up to complete
  s.programs=[];s.diagnosis='active';s.diagnosticSession={answers:[0,1,2,3]};
  assert.equal(M.studyProgress(s).value,100);
});
