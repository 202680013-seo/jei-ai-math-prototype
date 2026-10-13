"""Build the browser catalog from the supplied TSV without modifying its source."""
import csv,json,re,sys,pathlib,collections
source=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2])
rows=list(csv.reader(source.open(encoding='utf-8-sig',newline=''),delimiter='\t'))
programs={};current=None;duplicates=0;marks=collections.Counter()
for line,row in enumerate(rows[2:],3):
 mark,pid,title,fid,ftitle,logic,order=[v.strip() for v in row]
 if pid:
  if pid=='MF012736':pid='M1.H99.16'
  if not re.fullmatch(r'M1\.[A-J]\d+\.\d+',pid):raise ValueError((line,pid))
  current=programs.setdefault(pid,{'programId':pid,'name':title,'frames':[]})
  if current['name']!=title:raise ValueError(('conflicting title',pid))
 if fid:
  frame={'frameId':fid,'name':ftitle,'logic':logic,'order':int(order) if order else None,'sourceRow':line,'annotation':mark}
  previous=next((x for x in current['frames'] if all(x[k]==frame[k] for k in ['frameId','name','logic','order'])),None)
  if previous:
   duplicates+=1
   previous.setdefault('duplicateSourceRows',[]).append(line)
   if mark and mark not in previous['annotation'].split(' / '):previous['annotation']=' / '.join(filter(None,[previous['annotation'],mark]))
   continue
  current['frames'].append(frame)
  if mark:marks[mark]+=1
for p in programs.values():p['frames'].sort(key=lambda f:(f['order'] is None,f['order'] or 0,f['sourceRow']))
grades=[]
for letter in 'ABCDEFGHIJ':
 groups={}
 for pid,p in programs.items():
  group=pid.rsplit('.',1)[0]
  if group.split('.')[1][0]!=letter:continue
  groups.setdefault(group,{'groupId':group,'name':group.split('.')[1],'programs':[]})['programs'].append(p)
 ordered=sorted(groups.values(),key=lambda g:int(g['name'][1:]))
 for g in ordered:g['programs'].sort(key=lambda p:int(p['programId'].rsplit('.',1)[1]))
 grades.append({'grade':letter,'groups':ordered})
marks=collections.Counter(mark for p in programs.values() for f in p['frames'] for mark in f['annotation'].split(' / ') if mark)
meta={'source':source.name,'correction':{'MF012736':'M1.H99.16'},'rawFrameRows':sum(bool(r[3]) for r in rows[2:]),'programs':len(programs),'groups':sum(len(g['groups']) for g in grades),'frameAssociations':sum(len(p['frames']) for p in programs.values()),'exactDuplicateFramesRemoved':duplicates,'annotationsRetained':dict(marks),'grouping':'program ID prefix before the final dot','prescription':'Simulation only; selection uses the first N programs in source order, not diagnostic scoring.'}
if len(sys.argv)>3:
 diagnosis=pathlib.Path(sys.argv[3]);dg=list(csv.reader(diagnosis.open(encoding='utf-8-sig',newline=''),delimiter='\t'))[2:]
 meta['prefixGroups']=meta['groups'];meta['diagnosisSource']=diagnosis.name;meta['grouping']='Explicit diagnosis-group ID and name from diagnosis TSV';meta['missingGroupProgramMapping']=True
 for g in grades:
  g['programPool']=[p for x in g['groups'] for p in x['programs']]
  g['groups']=[{'groupId':r[1].strip(),'name':r[2].strip(),'programs':[],'mapped':False} for r in dg if r[1].strip().startswith('M1.DG.'+g['grade']+'.')]
  g['groups'].sort(key=lambda x:int(x['groupId'].rsplit('.',1)[1]))
 meta['groups']=sum(len(g['groups']) for g in grades)
 meta['prescription']='Unmapped simulation: select first N programs from the same-grade program pool. No diagnosis-group association asserted.'
catalog={'meta':meta,'grades':grades}
out.write_text('(function(root){root.MathCatalog='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';})(typeof module===\'object\'?module.exports:window);\n')
print(json.dumps(meta,ensure_ascii=False));print('COUNTS',[len(g['groups']) for g in grades])
