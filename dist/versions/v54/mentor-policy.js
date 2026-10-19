(function(root){
  'use strict';
  const catalog=typeof module!=='undefined'?require('./mentor-copy.js'):root.MentorCopy;
  const rules=new Map(catalog.rules.map(rule=>[rule.id,rule]));
  const complete=t=>t.diagnosis==='done'&&t.programs.every(p=>p.status==='passed');
  const attempted=t=>t.diagnosis==='done'&&t.programs.every(p=>p.progress>=100);
  const seconds=d=>(Number(d.minutes)||0)*60+(Number(d.seconds)||0);
  const dayDistance=(a,b)=>Math.floor((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
  function ensure(state,date){
    const b=state.mentorPolicy??={seen:{},rotations:{},queue:[],completedByDate:{}};
    b.seen??={};b.rotations??={};b.queue??=[];b.completedByDate??={};b.interrupted??={};if(b.date&&b.date!==date)b.queue=[];b.date=date;
    return b;
  }
  function snapshot(state){
    const topics={};state.grades.forEach((grade,g)=>grade.forEach((t,i)=>{
      topics[g+':'+i]={diagnosis:t.diagnosis,attempts:t.mentorDiagnosisEntries||0,programs:t.programs.map(p=>({id:p.id,status:p.status,progress:p.progress||0,reviewIndex:p.reviewSession?.index||0,reviewComplete:!!p.reviewSession?.complete,reviewCorrect:(p.reviewSession?.answers||[]).length-(p.reviewSession?.wrongFrames||[]).length})),complete:complete(t),attempted:attempted(t)};
    }));
    return {topics,target:state.daily?.target,seconds:seconds(state.daily||{}),grade:state.grade,index:state.index};
  }
  function createTracker(){
    let previous=null,owner=null,book=null,entryStarted=Date.now(),initial=true,observedDate=null;
    function offer(state,id,scope,values={},target=null,after=null){
      const b=ensure(state,state.daily.date),key=id+':'+scope;
      // The retired help feature has no live trigger, even though its copy is retained in the source catalog.
      if(['SB-022','SB-023'].includes(id)||b.seen[key]||b.queue.some(x=>x.key===key))return;
      const rule=rules.get(id);b.queue.push({id,key,scope,values,target,after,priority:rule.priority});
    }
    function visit(state,ctx){
      const d=state.daily,b=ensure(state,d.date),date=d.date,profile=state.profile||{},member=profile.memberType!=='trial';
      const dates=[...new Set([...Object.keys(state.history||{}),date])].sort();
      const first=profile.firstVisitDate||profile.startDate||date,elapsed=Math.max(1,dayDistance(first,date)+1);
      let streak=1,cursor=date;while(dates.includes(new Date(Date.parse(cursor+'T00:00:00Z')-86400000).toISOString().slice(0,10))){streak++;cursor=new Date(Date.parse(cursor+'T00:00:00Z')-86400000).toISOString().slice(0,10);}
      const meeting=(profile.meetingMilestones||[]).includes(elapsed),attendance=(profile.attendanceMilestones||[]).includes(streak);
      const values={'이름':profile.name||'재능','최초 접속 후 경과일 수':elapsed,'연속 출석일 수':streak};
      let id=null;
      if(member&&!b.welcomeShown&&d.entry==='first')id='SB-001';
      else if(member&&profile.birthday?.slice(-5)===date.slice(-5))id='SB-002';
      else if(elapsed>1&&(meeting||attendance))id=meeting&&attendance?'SB-003':meeting?'SB-004':'SB-005';
      else if(member)id=b.lastVisit===date&&ctx.reentry?'SB-007':'SB-006';
      if(id)offer(state,id,id==='SB-001'?'account':id==='SB-007'?ctx.entry:date,values);
      b.lastVisit=date;
    }
    function observe(state,ctx={}){
      const d=state.daily;if(!d)return;
      const b=ensure(state,d.date),now=ctx.now??Date.now();
      if(owner!==state||book!==b){owner=state;book=b;previous=null;initial=true;entryStarted=now;}
      if(observedDate!==d.date){initial=true;observedDate=d.date;entryStarted=now;}if(initial){visit(state,ctx);initial=false;}
      const prev=previous,values={'이름':state.profile?.name||'재능','목표 학습 시간':d.target||0,'추가 학습 시간':Math.floor(seconds(d)/60)-(d.target||0)};
      const selected=state.grade+':'+state.index;
      if(prev){
        if(d.target&&d.target!==prev.target)offer(state,'SB-008',d.date,values);
        state.grades.forEach((grade,g)=>grade.forEach((t,i)=>{
          const key=g+':'+i,old=prev.topics[key];if(!old)return;
          const v={...values,X:String.fromCharCode(65+g),'처방 프로그램 수':t.programs.length,'완료 프로그램 수':t.programs.length};
          if(old.diagnosis!=='done'&&t.diagnosis==='done'){
            if(t.programs.length){offer(state,'SB-031',key+':'+(t.diagnosticResult?.seconds||0),v,key);d.cleanStreak=0;}
            else {offer(state,'SB-030','grade:'+g,v,key);if(d.cleanStreak>=2)offer(state,'SB-032','streak:'+d.cleanStreak,{...v,'연속 통과 진단 수':d.cleanStreak},key);}
          }
          if(t.diagnosis==='active'&&t.mentorDiagnosisEntries>=3&&t.mentorDiagnosisEntries>old.attempts)offer(state,'SB-020',key,v,key);
          let justCompleted=false;
          t.programs.forEach(p=>{
            const op=old.programs.find(x=>x.id===p.id);if(!op)return;const scope=key+':'+p.id;
            if(p.progress>=100&&op.progress<100){
              justCompleted=true;b.completedByDate[d.date]=(b.completedByDate[d.date]||0)+1;
              if(!b.interrupted[scope])offer(state,'SB-028',d.date+':'+b.completedByDate[d.date],{...v,'당일 누적 완료 프로그램 수':b.completedByDate[d.date]},key);
              if(p.status==='passed'&&!b.interrupted[scope])offer(state,'SB-029',d.date,v,key);
            }
            if(op.status==='passed'&&(p.reviewSession?.index>op.reviewIndex||p.reviewSession?.complete&&!op.reviewComplete))offer(state,'SB-047',scope,v,key);
            if(p.status==='passed'&&op.status==='failed'){
              const remaining=grade.reduce((n,x)=>n+x.programs.filter(p=>p.status==='failed').length,0),blocked=b.seen['SB-046:grade:'+g];
              if(blocked&&remaining&&g<state.grades.length-1)offer(state,'SB-049',scope+':'+(p.reviewCount||0),{...v,'남은 미통과 프로그램 수':remaining},key);
              else if(!grade.every(attempted))offer(state,'SB-027',scope,v,key);
            }
            if(p.reviewSession?.complete&&!op.reviewComplete&&ctx.wrongNote){const correct=(p.reviewSession.answers||[]).length-(p.reviewSession.wrongFrames||[]).length;offer(state,correct?'SB-025':'SB-024',correct?scope+':'+(p.reviewCount||0):d.date,{...v,'정답 처리 문항 수':correct},key);}
          });
          if(t.programs.length&&justCompleted){
            const finished=t.programs.filter(p=>p.progress>=100).length,oldFinished=old.programs.filter(p=>p.progress>=100).length;
            const crossed=[[.25,'SB-034'],[.5,'SB-035'],[.75,'SB-036']].filter(([rate])=>oldFinished<Math.ceil(t.programs.length*rate)&&finished>=Math.ceil(t.programs.length*rate));
            if(crossed.length){const [,id]=crossed.at(-1);offer(state,id,key,v,key);}
          }
          if(!old.complete&&complete(t)){
            const achievement=t.programs.length?'SB-037':null;
            if(achievement)offer(state,achievement,key,v,key);
            if(i+1<grade.length&&grade[i+1].diagnosis==='idle')offer(state,'SB-048',g+':'+(i+1),v,key,achievement?achievement+':'+key:'SB-030:grade:'+g);
          }
        }));
        state.grades.forEach((grade,g)=>{
          const all=grade.every(complete),wasAll=grade.every((t,i)=>prev.topics[g+':'+i]?.complete),completed=grade.filter(complete).length;
          if(completed>=Math.ceil(grade.length/2)&&grade.filter((t,i)=>prev.topics[g+':'+i]?.complete).length<Math.ceil(grade.length/2))offer(state,'SB-033','grade:'+g,{...values,X:String.fromCharCode(65+g)});
          if(all&&!wasAll)offer(state,g===state.grades.length-1?'SB-039':'SB-038','grade:'+g,{...values,X:String.fromCharCode(66+g)});
          if(g<state.grades.length-1&&grade.every(attempted)&&!all&&!grade.every((t,i)=>prev.topics[g+':'+i]?.attempted))offer(state,'SB-046','grade:'+g,values);
        });
        if(selected!==prev.grade+':'+prev.index&&complete(state.grades[state.grade][state.index]))offer(state,'SB-045',selected+':'+ctx.entry,values,selected);
      }
      const total=seconds(d),trial=state.profile?.memberType==='trial',target=trial?600:(d.target||0)*60;
      if(target&&total>=target)offer(state,trial?'SB-010':'SB-009',d.date,values);
      if(!trial&&target&&total>=target*1.5)offer(state,'SB-019',d.date,values);
      if(total>0&&(!target||total<target)){
        const ratio=target?total/target:0;
        if(target){const step=Math.min(3,Math.floor(ratio*4));offer(state,'SB-'+String((trial?15:11)+step).padStart(3,'0'),d.date,values);}
      }
      const t=state.grades[state.grade][state.index],active=t.programs.find(p=>p.status==='active'&&p.progress<100),retryKey=active?t.groupId+':'+active.programId+':'+(active.completedFrames||0):null;
      if(retryKey&&(d.frameAttempts?.[retryKey]||0)>=5)offer(state,'SB-021',retryKey,values,selected);
      if(!trial&&total===0&&now-entryStarted>=600000)offer(state,'SB-040',d.date,values);
      previous=snapshot(state);
    }
    function next(state,ctx={}){
      const b=ensure(state,state.daily.date),target=state.grade+':'+state.index;
      b.queue=b.queue.filter(x=>!x.target||x.target===target);
      const trial=state.profile?.memberType==='trial',time=seconds(state.daily),goal=(state.daily.target||0)*60;
      b.queue=b.queue.filter(x=>{
        const n=Number(x.id.slice(3));
        if(trial&&[1,2,6,7,8,9,11,12,13,14,19,40,43].includes(n)||!trial&&[10,15,16,17,18,44].includes(n))return false;
        if(n===9)return goal>0&&time>=goal;
        if(n===19)return goal>0&&time>=goal*1.5;
        if(n>=11&&n<=18){const target=trial?600:goal;return target>0&&time>0&&time<target&&n===(trial?15:11)+Math.min(3,Math.floor(time/target*4));}
        return true;
      });
      const ready=b.queue.filter(x=>!x.after||b.seen[x.after]).sort((a,b)=>a.priority-b.priority);
      let item=ready[0];
      if(!item){
        const d=state.daily,trial=state.profile?.memberType==='trial',id=seconds(d)===0?'SB-041':trial&&seconds(d)>=600?'SB-044':!trial&&d.target&&seconds(d)>=d.target*60?'SB-043':'SB-042';
        offer(state,id,String(ctx.entry||0));item=b.queue.find(x=>x.id===id);
      }
      if(!item)return null;
      b.queue=b.queue.filter(x=>x.key!==item.key);b.seen[item.key]=true;
      if(item.id==='SB-001')b.welcomeShown=true;
      if(item.id==='SB-033')b.queue=b.queue.filter(x=>x.id!=='SB-032');
      if(['SB-038','SB-039','SB-046'].includes(item.id))b.queue=b.queue.filter(x=>!['SB-027','SB-028','SB-029','SB-034','SB-035','SB-036','SB-048'].includes(x.id));
      const rule=rules.get(item.id),variant=b.rotations[item.id]||0;b.rotations[item.id]=variant+1;
      const text=rule.messages[variant%rule.messages.length].replace(/\[([^\]]+)\]/g,(_,name)=>String(item.values[name]??(name==='이름'?state.profile?.name||'재능':'')));
      b.current={...item,text};
      return {...item,text};
    }
    function pending(state){const b=ensure(state,state.daily.date),target=state.grade+':'+state.index;return b.queue.some(x=>(!x.target||x.target===target)&&(!x.after||b.seen[x.after]));}
    function reset(){owner=null;previous=null;book=null;initial=true;}
    function preview(state){const b=ensure(state,state.daily.date),item=b.current;if(!item)return null;const rule=rules.get(item.id),variant=b.rotations[item.id]||0;b.rotations[item.id]=variant+1;return rule.messages[variant%rule.messages.length].replace(/\[([^\]]+)\]/g,(_,name)=>String(item.values[name]??(name==='이름'?state.profile?.name||'재능':'')));}
    return {observe,next,offer,pending,reset,preview};
  }
  const api={createTracker,snapshot,rules:catalog.rules};
  if(typeof module!=='undefined')module.exports=api;else root.MentorPolicy=api;
})(typeof window!=='undefined'?window:globalThis);
