import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, lstatSync, copyFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildReviewViews } from './build-review-views.mjs';

// Run after making a meaningful design change. Existing snapshots are immutable.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=join(root,'dist');
const require=createRequire(import.meta.url),Review=require(join(dist,'review-model.js'));
const args=process.argv.slice(2),changes=[];let title,family,labelOverride;
for(let i=0;i<args.length;i++){
  if(args[i]==='--title'&&args[i+1])title=args[++i];
  else if(args[i]==='--change'&&args[i+1])changes.push(args[++i]);
  else if(args[i]==='--family'&&args[i+1])family=args[++i];
  else if(args[i]==='--label'&&args[i+1])labelOverride=args[++i];
  else throw new Error('Usage: node scripts/save-design-version.mjs --title "제목" --change "변경 내용" [--change "추가 내용"] [--family v2] [--label V2.51]');
}
if(!title||!changes.length)throw new Error('제목과 변경 내용을 입력하세요.');
const registryPath=join(dist,'versions.json'),registry=Review.validate(JSON.parse(readFileSync(registryPath,'utf8')));
const familyVersion=family&&registry.versions.find(v=>v.id===family);
if(family&&!familyVersion)throw new Error('수정 이력을 이어갈 디자인 버전이 없습니다.');
if(labelOverride&&(!/^V\d+(?:\.\d+)*$/.test(labelOverride)||registry.versions.some(v=>v.label===labelOverride)||(family&&!labelOverride.startsWith(familyVersion.label+'.'))))throw new Error('사용할 수 없거나 이미 존재하는 버전 이름입니다.');
const revision=family?1+Math.max(0,...registry.versions.filter(v=>v.family===family).map(v=>v.revision||0)):0;
function inventory(dir){
  const result={};
  function walk(base,prefix=''){for(const name of readdirSync(base).sort()){const path=join(base,name),rel=prefix+name,stat=lstatSync(path);if(stat.isSymbolicLink())throw new Error('Symlinks are not allowed in design snapshots.');if(stat.isDirectory())walk(path,rel+'/');else if(rel!=='snapshot.json')result[rel]=createHash('sha256').update(readFileSync(path)).digest('hex');}}
  walk(dir);return result;
}
const working=join(dist,'working'),files=inventory(working),base=inventory(join(dist,registry.working.basedOn==='working'?'working':`versions/${registry.working.basedOn}`));
if(JSON.stringify(files)===JSON.stringify(base))throw new Error('현재 작업본에 디자인 변경이 없습니다. 같은 화면의 새 버전은 만들지 않습니다.');
const next=1+Math.max(...registry.versions.map(v=>Number(v.id.slice(1)))),id='v'+next,destination=join(dist,'versions',id),temporary=destination+'.pending';
if(existsSync(destination)||existsSync(temporary))throw new Error('버전 폴더가 이미 존재합니다. 덮어쓰지 않습니다.');
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
mkdirSync(temporary);
try{
  for(const name of Object.keys(files)){const target=join(temporary,name);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(working,name),target);}
  writeFileSync(join(temporary,'snapshot.json'),JSON.stringify({id,date,files},null,2)+'\n');
  const label=labelOverride||(family?`${familyVersion.label}.${revision}`:'V'+next);
  const version={id,label,title,path:`versions/${id}/`,date,createdAt:new Date().toISOString(),changes,...(family?{family,revision}:{})};registry.versions.push(version);Object.assign(registry.working,{basedOn:id,title:`${label} 기준 · 최신 작업본`,date,matchesBaseline:true,changes:[`${label} 시안과 같은 화면이에요.`,'다음 수정은 현재 작업본에서 이어갑니다.']});Review.validate(registry);
  renameSync(temporary,destination);writeFileSync(registryPath,JSON.stringify(registry,null,2)+'\n');
  const log=join(root,'CHANGELOG.md');writeFileSync(log,readFileSync(log,'utf8')+`\n## 디자인 ${label} — ${title} · ${date}\n\n${changes.map(x=>'- '+x).join('\n')}\n`);
  buildReviewViews(root);
  console.log(JSON.stringify({id,title,path:version.path,files:Object.keys(files).length}));
}catch(error){if(existsSync(temporary))rmSync(temporary,{recursive:true});throw error;}
