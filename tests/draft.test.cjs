const assert=require('node:assert/strict'),M=require('../dist/working/model.js').MathModel;let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},has=(s,t)=>{assert(s.includes(t),s+' did not include '+t);checks++;};
const snippets=['만나서 반가워요','오늘도 반가워요','잘하고','오늘','조금 더','차분하게','실력이 완벽','반 이상','순조로운','마지막까지'];
for(let i=0;i<12;i++){const s=M.create();M.ensureDaily(s,'2026-10-13');M.draftPreset(s,i);if(i<10)has(M.message(s),snippets[i]);if(i===0||i===1)eq(M.recommend(s).kind,'goal');if(i===2)eq(M.recommend(s).kind,'today');if(i===3)eq(M.recommend(s).kind,'report');if(i===10)eq(M.recommend(s).kind,'answers');if(i===11)eq(M.recommend(s).kind,'wrongnotes');}
let s=M.create();M.ensureDaily(s,'2026-10-13');eq(s.daily.entry,'first');s.daily.target=20;s.daily.minutes=21;eq(M.recommend(s).kind,'report');s.daily.unreadAnswers=1;eq(M.recommend(s).kind,'answers');M.draftPreset(s,11);s.daily.target=20;s.daily.minutes=21;eq(M.recommend(s).kind,'wrongnotes');s.daily.unreadAnswers=1;eq(M.recommend(s).kind,'answers');M.ensureDaily(s,'2026-10-14');eq(s.daily.minutes,0);eq(s.daily.target,null);eq(s.daily.entry,'today');
M.draftPreset(s,5);has(M.message(s),'차분하게');const set=s.grades[s.grade][s.index],p=M.currentProgram(set);M.setProgress(p,75);assert(!M.message(s).includes('차분하게'));checks++;
M.draftPreset(s,3);const variants=[];for(let i=0;i<3;i++){s.daily.variant=i;variants.push(M.message(s));}eq(new Set(variants).size,3);
M.draftPreset(s,7);eq(s.grades[9].filter(x=>x.diagnosis==='done').length,39);eq(M.wrongEntries(s).length,0);
console.log(checks+' draft policy assertions passed');
