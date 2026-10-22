import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const defaultRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function buildReviewViews(root=defaultRoot){
  const dist=join(root,'dist'),require=createRequire(import.meta.url),Review=require(join(dist,'review-model.js'));
  const registry=Review.validate(JSON.parse(readFileSync(join(dist,'versions.json'),'utf8'))),out=join(dist,'views'),shared=join(dist,'shared');mkdirSync(out,{recursive:true});mkdirSync(shared,{recursive:true});
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex').slice(0,16);
  const runtimeHash=hash(readFileSync(join(dist,'preview-runtime.js'))),controlsHash=hash(readFileSync(join(dist,'preview-controls.js')));
  const historyModelHash=hash(readFileSync(join(dist,'history-model.js'))),historyUiHash=hash(readFileSync(join(dist,'history-ui.js'))),historyCssHash=hash(readFileSync(join(dist,'history-ui.css')));
  const typographyHash=hash(readFileSync(join(shared,'typography.css')));
  const themeModelHash=hash(readFileSync(join(dist,'theme-model.js'))),themePreviewHash=hash(readFileSync(join(dist,'theme-preview.js')));
  function applyTypography(html){
    // Apply the user's global font choice without rewriting immutable snapshots.
    // Avoid fetching superseded fonts (e.g. V3's original Pretendard preload).
    html=html.replace(/<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bas=["']font["'])[^>]*>/gi,'');
    html=html.replace(/<link\b(?=[^>]*\bdata-jei-typography\b)[^>]*>/gi,'');
    return html.replace(/<\/head>/i,`<link data-jei-typography rel="preload" href="/shared/fonts/NanumSquareRoundR.woff2" as="font" type="font/woff2" crossorigin><link data-jei-typography rel="stylesheet" href="/shared/typography.css?r=${typographyHash}"></head>`);
  }
  for(const version of Review.entries(registry)){
    const source=join(dist,version.path);let html=readFileSync(join(source,'index.html'),'utf8');
    if(!/<head[\s>]/i.test(html)||!/<\/body>/i.test(html))throw new Error('Expected a complete HTML prototype.');
    // Real same-origin documents, loaded directly. No srcdoc, intermediate fetch or loading overlay.
    const designId=version.id==='working'&&version.matchesBaseline?version.basedOn:version.id;
    html=html.replace(/<head([^>]*)>/i,`<head$1><base href="../${version.path}"><script src="/history-model.js?r=${historyModelHash}"></script><script src="/preview-runtime.js?r=${runtimeHash}" data-version="${version.id}" data-design-id="${designId}"></script><link rel="stylesheet" href="/history-ui.css?r=${historyCssHash}">`);
    // Large identical catalog payloads are requested from one content-addressed URL.
    const catalog=join(source,'catalog.js');if(existsSync(catalog)){const bytes=readFileSync(catalog),name=`catalog-${hash(bytes)}.js`;writeFileSync(join(shared,name),bytes);html=html.replace(/src=(['"])catalog\.js\1/g,`src="/shared/${name}"`);}
    // Refresh changed working assets without making all requests uncacheable.
    html=html.replace(/\b(src|href)=(['"])([^'"?#]+\.(?:js|css))\2/g,(match,attr,quote,file)=>{if(file.startsWith('/')||file.includes('..')||file.includes(':'))return match;const local=join(source,file);return existsSync(local)?`${attr}=${quote}${file}?r=${hash(readFileSync(local))}${quote}`:match;});
    html=html.replace(/src=(["'])\/theme-model\.js(?:\?[^"']*)?\1/g,`src="/theme-model.js?r=${themeModelHash}"`).replace(/src=(["'])\/theme-preview\.js(?:\?[^"']*)?\1/g,`src="/theme-preview.js?r=${themePreviewHash}"`);
    html=html.replace(/<\/body>/i,`<script src="/preview-controls.js?r=${controlsHash}"></script><script src="/history-ui.js?r=${historyUiHash}"></script></body>`);writeFileSync(join(out,version.id+'.html'),applyTypography(html));
  }
  // A stable native document for iPad/Safari: no workspace, iframe or redirect.
  const nativeEntries=[];
  for(const family of ['V4','V5','V6']){
    const version=registry.versions.filter(version=>new RegExp('^'+family+'(?:\\.|$)').test(version.label)).at(-1);
    if(version)nativeEntries.push({family,version,file:family.toLowerCase()+'.html'});
  }
  // Named, native learner-only links keep the V6 concepts independently reviewable on iPad.
  for(const version of registry.versions.filter(version=>/^V6\.(?:2\.[123]|[34])$/.test(version.label)))
    nativeEntries.push({family:'V6',version,file:version.label.toLowerCase().replaceAll('.','-')+'.html'});
  for(const {family,version,file} of nativeEntries){
    let html=readFileSync(join(out,version.id+'.html'),'utf8');
    html=html.replace(/<html([^>]*)>/i,`<html$1 data-${family.toLowerCase()}-standalone="true">`);
    html=html.replace(/<base\b[^>]*>/i,`<base href="/versions/${version.id}/">`);
    html=html.replace(/<\/head>/i,`<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="AI 수학 ${family}"><meta name="theme-color" content="#ffffff"></head>`);
    if(version.label==='V6.2.2'){
      html=html.replace('name="apple-mobile-web-app-title" content="AI 수학 V6"','name="apple-mobile-web-app-title" content="AI 수학 6.2.2"');
      html=html.replace(/<\/head>/i,'<link rel="manifest" href="/v6-2-2.webmanifest" crossorigin="use-credentials"><link rel="apple-touch-icon" sizes="180x180" href="/app-icons/v6-2-2-180.png"><link rel="icon" type="image/png" sizes="192x192" href="/app-icons/v6-2-2-192.png"><meta name="mobile-web-app-capable" content="yes"><meta name="application-name" content="AI 수학 6.2.2"></head>');
    }
    writeFileSync(join(dist,file),html);
  }
  for(const name of ['index.html','preview.html']){const file=join(dist,name);let html=applyTypography(readFileSync(file,'utf8'));for(const asset of ['workspace.css','workspace.js','theme-model.js','review-model.js','preview.js'])html=html.replace(new RegExp(`(src|href)=(["'])${asset.replaceAll('.','\\.')}[?]?[^"']*\\2`,'g'),`$1="${asset}?r=${hash(readFileSync(join(dist,asset)))}"`);writeFileSync(file,html);}
  return {views:Review.entries(registry).length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(buildReviewViews()));
