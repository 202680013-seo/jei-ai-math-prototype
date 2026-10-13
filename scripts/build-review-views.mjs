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
  for(const version of Review.entries(registry)){
    const source=join(dist,version.path);let html=readFileSync(join(source,'index.html'),'utf8');
    if(!/<head[\s>]/i.test(html)||!/<\/body>/i.test(html))throw new Error('Expected a complete HTML prototype.');
    // Real same-origin documents, loaded directly. No srcdoc, intermediate fetch or loading overlay.
    html=html.replace(/<head([^>]*)>/i,`<head$1><base href="../${version.path}"><script src="/preview-runtime.js?r=${runtimeHash}" data-version="${version.id}"></script>`);
    // Large identical catalog payloads are requested from one content-addressed URL.
    const catalog=join(source,'catalog.js');if(existsSync(catalog)){const bytes=readFileSync(catalog),name=`catalog-${hash(bytes)}.js`;writeFileSync(join(shared,name),bytes);html=html.replace(/src=(['"])catalog\.js\1/g,`src="/shared/${name}"`);}
    // Refresh changed working assets without making all requests uncacheable.
    html=html.replace(/\b(src|href)=(['"])([^'"?#]+\.(?:js|css))\2/g,(match,attr,quote,file)=>{if(file.startsWith('/')||file.includes('..')||file.includes(':'))return match;const local=join(source,file);return existsSync(local)?`${attr}=${quote}${file}?r=${hash(readFileSync(local))}${quote}`:match;});
    html=html.replace(/<\/body>/i,`<script src="/preview-controls.js?r=${controlsHash}"></script></body>`);writeFileSync(join(out,version.id+'.html'),html);
  }
  return {views:Review.entries(registry).length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(buildReviewViews()));
