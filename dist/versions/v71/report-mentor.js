(function(root){
 'use strict';
 const english=[
 '[이름], nice to meet you! Let’s start learning together.',
 'Happy birthday, [이름]!',
 'You have a [연속 출석일 수]-day streak in our [최초 접속 후 경과일 수] days together!',
 'We’ve been learning together for [최초 접속 후 경과일 수] days!',
 'You’ve learned with us [연속 출석일 수] days in a row!',
 'Welcome back, [이름]! Let’s learn together today.',
 'It’s lovely to see you again, [이름]!',
 'Great planning! Let’s work toward your goal.',
 'You reached your [목표 학습 시간]-minute goal today!',
 'You finished all 10 minutes of learning today!',
 'A lovely start. Keep going at your own pace!',
 'You’re steadily working toward your learning goal!',
 'You’re more than halfway to your learning goal!',
 'You’re getting close to your learning goal. Keep it up!',
 'A lovely start. Take it one step at a time!',
 'Your focused learning time is adding up!',
 'You’ve already spent 5 minutes learning. Well done!',
 'You’re nearly finished with today’s learning!',
 'You learned for [추가 학습 시간] extra minutes beyond your goal!',
 'I love how you keep trying!',
 'It’s great to revisit the tricky parts. Keep trying!',
 'Asking questions is a wonderful way to learn!',
 'Finding the help you need is a great learning habit!',
 'Well done for giving those tricky questions another try!',
 'You tried again and got [정답 처리 문항 수] questions right!',
 'Looking back at what you learned is a great habit!',
 'Amazing! You tried again and got every question right!',
 'You finished [당일 누적 완료 프로그램 수] lessons today. Well done!',
 'Wonderful focus! You passed on your first try!',
 'You really know this! You passed your skill check!',
 '[처방 프로그램 수] new lessons are ready for you!',
 'You passed [연속 통과 진단 수] skill checks in a row!',
 'You’re more than halfway through Level [X]!',
 'You’re off to a wonderful start!',
 'You’re already halfway there. Keep going!',
 'You’re nearly there. Keep going to the finish!',
 'You completed all [완료 프로그램 수] lessons you needed!',
 'Ready to discover something new in Level [X]?',
 'You completed every lesson. Congratulations!',
 'Ready to start learning?',
 'What would you like to start with today?',
 'Let’s keep learning and discover something new!',
 'You reached today’s goal! Ready for another challenge?',
 'You did wonderfully today. See you tomorrow!',
 'This is a record of learning you’ve completed!',
 'A few questions still need practice. Let’s try them again!',
 'I love how you’re strengthening your skills with review!',
 'A new skill check is ready. Shall we get started?',
 'You tried again and finished! Just [남은 미통과 프로그램 수] more lessons to go!'
 ];
 const rules=[];const variants={
  'SB-041':['What would you like to start with today?','Ready to discover something new?','Let’s begin today’s learning, one step at a time.'],
  'SB-040':['Ready to start learning?','Let’s grow your skills together!','Let’s enjoy learning, one step at a time.'],
  'SB-042':['Ready to keep learning a little longer?','Let’s discover something new together!','Keep learning and take another step forward.']
 };
 for(const rule of root.MentorCopy?.rules||[]){
  const index=Number(rule.id.slice(3))-1;
  rule.messages.forEach((message,i)=>{
   const keys=[];let source='',at=0;
   for(const m of message.matchAll(/\[([^\]]+)\]/g)){source+=message.slice(at,m.index).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(.+?)';keys.push(m[1]);at=m.index+m[0].length;}
   source+=message.slice(at).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   rules.push({regex:new RegExp('^'+source+'$'),keys,english:variants[rule.id]?.[i]||english[index]});
  });
 }
 root.JeiReportMentor={translate(copy){
  for(const rule of rules){const m=copy.match(rule.regex);if(!m)continue;const args=Object.fromEntries(rule.keys.map((k,i)=>[k,m[i+1]==='재능'?'Jaeneung':m[i+1]]));return rule.english.replace(/\[([^\]]+)\]/g,(_,key)=>args[key]||'');}
  return null;
 }};
})(typeof window!=='undefined'?window:globalThis);
