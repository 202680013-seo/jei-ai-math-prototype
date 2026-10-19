const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {harness}=require('./helpers/ui-harness.cjs');
const folder='dist/working/assets/figma-v4-1/';
const manifest=JSON.parse(fs.readFileSync(folder+'manifest.json','utf8'));

test('all original Figma SVGs are local, unchanged, retain their root dimensions and are wired into the UI',()=>{
  assert.equal(manifest.fileKey,'QmDlOvkNKFdZJHCY89h0vY');assert.equal(manifest.assets.length,19);
  const source=['index.html','app.js','v4.css'].map(f=>fs.readFileSync('dist/working/'+f,'utf8')).join('\n');
  assert(!/https:\/\/www\.figma\.com\/api\/mcp\/asset\//.test(source));
  for(const a of manifest.assets){
    const bytes=fs.readFileSync(folder+a.file);assert(bytes.length>100,a.file);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256,a.file+' was modified');
    const root=bytes.toString().match(/<svg\b[^>]*>/)[0];
    for(const [attribute,value]of Object.entries({width:a.svgWidth,height:a.svgHeight,viewBox:a.viewBox}))assert(root.includes(`${attribute}="${value}"`),a.file+' '+attribute);
    assert(source.includes('figma-v4-1/'+a.file)||(['passed.svg','failed.svg','locked.svg'].includes(a.file)&&source.includes('figma-v4-1/${kind}.svg')),a.file+' has no UI callsite');
  }
});

test('the Figma status assets belong to their real card and rail states without changing interaction gates',()=>{
  const h=harness();h.seed('failed');h.click('groups');
  assert(h.node('#programs').innerHTML.includes('figma-v4-1/failed.svg'));
  assert(h.node('#programs').innerHTML.includes('figma-v4-1/locked.svg'));
  assert(h.node('#group-panel').innerHTML.includes('figma-v4-1/rail-locked.svg'));
  assert(h.node('#group-panel').innerHTML.includes('figma-v4-1/grade-arrow.svg'));
  const before=h.data('current().programs');h.click('select-group',1);assert.equal(h.evaluate('state.index'),0);
  h.click('close-panel');h.click('failed-card',0);assert.equal(h.evaluate('activityKind'),'completed-study');
  assert.deepEqual(h.data('current().programs'),before);
});
