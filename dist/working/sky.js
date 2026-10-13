(function(root){
const names=['북두칠성','카시오페이아','작은곰자리','백조자리','오리온자리','황소자리','쌍둥이자리','사자자리','처녀자리','천칭자리','전갈자리','궁수자리','염소자리','물병자리','물고기자리','양자리','독수리자리','거문고자리','페가수스자리','안드로메다자리','용자리','헤라클레스자리','큰개자리','작은개자리','고래자리','남십자자리','왕관자리','사냥개자리','토끼자리','마차부자리','목동자리','페르세우스자리'];
const defs=names.map((name,i)=>({id:i,name,latin:'Sample '+(i+1),zone:Math.floor(i/4),x:(Math.floor(i/4)%4)*800+[200,570,220,570][i%4],y:Math.floor(i/16)*650+[170,170,460,460][i%4],points:[[0,0],[60,-35],[120,5],[180,-20],[230,50]].slice(0,4+i%2),need:5,story:name+'를 완성했어요. 학습하며 모은 별 조각이 하늘의 별이 되었어요. (이야기 샘플)'}));
function item(){return {stars:0,pieces:0,viewed:false,seenStars:0,seenPieces:0};}
function create(){return {sample:true,items:defs.map(item),guide:null,guideDone:false,legacy:false,longGap:false,pending:null,newPieces:false,totalPieces:0,focus:0};}
function ensure(state){state.sky??=create();return state.sky;}
function current(s){return s.items.findIndex((x,i)=>x.stars<defs[i].points.length);}
function status(s,i){const x=s.items[i];if(x.stars===defs[i].points.length)return x.viewed?'seen':'unseen';return i===current(s)?'active':'idle';}
function addPieces(s,n){let left=Math.max(0,Math.floor(n));s.totalPieces+=left;s.newPieces=left>0;while(left>0){const i=current(s);if(i<0)break;const x=s.items[i],need=defs[i].need-x.pieces,take=Math.min(need,left);x.pieces+=take;left-=take;if(x.pieces===defs[i].need){x.pieces=0;x.stars++;}}s.focus=Math.max(0,current(s));}
function seen(s,i){if(status(s,i)==='idle')return false;s.items[i].viewed=s.items[i].stars===defs[i].points.length;s.items[i].seenStars=s.items[i].stars;s.items[i].seenPieces=s.items[i].pieces;return true;}
const scenarios=['최초 진입 · 가이드','일반 재진입 · 진행 중','조각만 증가 · 상세 변화','별 1개 완성','별자리 1개 완성 + 남은 조각','별자리 2개 완성','별자리 3개 완성','별자리 6개 완성 · 2배속','구역 완성 → 다음 구역','마지막 구역 완성','완성 · 미확인','완성 · 확인','30일 경과 · 조작 안내'];
function scenario(state,k){const s=create();s.guideDone=k!==0;s.guide=k===0?'intro':null;s.items[0].stars=2;s.items[0].pieces=1;s.focus=0;const final=s.items.map(x=>({...x})),steps=[];let completed=0;
const step=(kind,i,caption,duration,stars,pieces)=>steps.push({kind,focus:i,caption,duration,stars,pieces});
if(k===1){s.items[0].seenStars=2;s.items[0].seenPieces=1;}
if(k===2){s.items[0].pieces=4;s.items[0].seenStars=2;s.items[0].seenPieces=1;}
if(k===3){s.items[0].stars=2;s.items[0].pieces=4;final[0].stars=3;final[0].pieces=2;step('star',0,'별이 완성되고 다음 별을 모으기 시작해요.',200,3,2);}
if([4,5,6,7,8].includes(k)){completed=k===4?1:k===5?2:k===6?3:k===7?6:4;for(let i=0;i<completed;i++){s.items[i]=item();final[i]={...item(),stars:defs[i].points.length};if(completed<=2){for(let j=1;j<=defs[i].points.length;j++)step('star',i,j+'번째 별 완성',200,j,0);}else step('batch',i,'별자리 '+(i+1)+' 완성',completed>=6?500:1000,defs[i].points.length,0);step('picture',i,defs[i].name+' 그림 해금 · 미확인 상태',400,defs[i].points.length,0);if((i+1)%4===0){step('zone',i,(defs[i].zone+1)+'구역 전체 완성',1000);step('move',i+1,'다음 구역으로 이동',500);}}
final[completed]={...item(),stars:1,pieces:2};step('move',completed,'다음 순서의 별자리로 이동',400);step('star',completed,'남은 조각으로 별을 이어 완성해요.',200,1,2);}
if(k===9){for(let i=0;i<32;i++)s.items[i]={...item(),stars:defs[i].points.length,viewed:true};s.items[31]={...item(),stars:defs[31].points.length-1,pieces:4};for(let i=0;i<32;i++)final[i]={...s.items[i]};final[31].stars=defs[31].points.length;final[31].pieces=0;final[31].viewed=false;s.focus=31;step('star',31,'마지막 별 완성',200,defs[31].points.length,0);step('zone',31,'마지막 구역 완성',1000);step('all',31,'전체 하늘 완성!',1000);step('congratulations',31,'축하해요! 모든 별자리를 완성했어요.',1600);}
if(k===10||k===11){s.items[0].stars=defs[0].points.length;s.items[0].pieces=0;s.items[0].viewed=k===11;if(k===11)s.items[0].seenStars=defs[0].points.length;s.items[1].stars=1;s.items[1].pieces=2;s.focus=1;}
if(k===12)s.longGap=true;
if(steps.length)s.pending={steps,final,focus:k===9?31:completed||0,caseName:scenarios[k]};state.sky=s;return s;}
function applyStep(s,step){const x=s.items[step.focus];if(x&&step.stars!==undefined)x.stars=step.stars;if(x&&step.pieces!==undefined)x.pieces=step.pieces;s.focus=step.focus;}
function finish(s){if(!s.pending)return;s.items=s.pending.final.map(x=>({...x}));s.focus=s.pending.focus;s.pending=null;}
function search(s,term){const q=term.trim().toLowerCase();return defs.filter((d,i)=>status(s,i)!=='idle'&&(d.name.toLowerCase().startsWith(q)||d.latin.toLowerCase().startsWith(q))).slice(0,5);}
root.SkyModel={defs,create,ensure,current,status,addPieces,seen,scenarios,scenario,applyStep,finish,search};
})(typeof module==='object'?module.exports:window);
