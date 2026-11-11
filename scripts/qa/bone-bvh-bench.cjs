// Run with BENCH_STAGING, BENCH_OUT, BENCH_PLAYWRIGHT and BENCH_CHROME set.
// Optional BENCH_HEAD defaults to this checkout. No measured tree is written.
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const output=process.env.BENCH_OUT;
const profiling=process.env.BENCH_PROFILE==='1';
const variants=profiling?[['head',process.env.BENCH_HEAD||root]]:[['staging',process.env.BENCH_STAGING],['head',process.env.BENCH_HEAD||root]];
let entry=fs.readFileSync(path.join(__dirname,'bone-bvh-entry.js'),'utf8');
if(profiling) entry=entry.replace('const start=performance.now();',`globalThis.__boneProfile={times:{},counts:{}};performance.mark('bone-frame-start');const start=performance.now();`)
  .replace('if(frame>=0) times.push(performance.now()-start);',`performance.mark('bone-frame-end');if(frame>=0) {times.push(performance.now()-start);profiles.push(globalThis.__boneProfile);}`)
  .replace('times=[],zones={}', 'times=[],profiles=[],zones={}')
  .replace('{times,zones,actorHits,shots,vertices:', '{times,profiles,zones,actorHits,shots,vertices:');
const git=(tree,...args)=>execFileSync('git',args,{cwd:tree,encoding:'utf8'}).trim();
function stats(times) {
  const sorted=[...times].sort((a,b)=>a-b);
  return {mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,p95:sorted[Math.ceil(sorted.length*.95)-1],p99:sorted[Math.ceil(sorted.length*.99)-1]};
}

async function measure(name,tree,repeat) {
  const {createServer}=await import(pathToFileURL(path.join(root,'client/node_modules/vite/dist/node/index.js')).href);
  let browser,server;const errors=[];
  try {
    server=await createServer({root:path.join(tree,'client'),configFile:false,cacheDir:path.join(output,`vite-${name}-${repeat}`),server:{host:'127.0.0.1',port:0,fs:{allow:[tree,output,fs.realpathSync(path.join(tree,'client/node_modules'))]}},plugins:[{
      name:'bone-bvh-benchmark',
      enforce:'pre',
      configureServer(s) {s.middlewares.use((req,res,next)=>{
        if(req.url==='/__bone-bench') {res.setHeader('Content-Type','text/html');res.end('<script type="module" src="/__bone-entry.js"></script>');}
        else next();
      });},
      resolveId(id) {if(id==='/__bone-entry.js') return '\0bone-entry';},
      load(id) {if(id==='\0bone-entry') return entry;},
      transform(code,id) {
        if(profiling && id.replaceAll('\\','/').endsWith('/player/hitSurface.ts')) return require('./bone-bvh-profile.cjs').instrument(code);
        if(name!=='staging' || !id.replaceAll('\\','/').endsWith('/player/hitSurface.ts')) return;
        // Same cheap cumulative triangle counter as the head query, in memory
        // only. No timing instrumentation and no changes to frozen staging.
        for(const anchor of ['let skinnedVertexCount=0;','surfaces.push(...cached);',"Object.defineProperty(query,'skinnedVertexCount'"]) if(!code.includes(anchor)) throw Error(`Staging counter anchor missing: ${anchor}`);
        return code.replace('let skinnedVertexCount=0;','let skinnedVertexCount=0,candidateTriangleCount=0;')
          .replace('surfaces.push(...cached);','surfaces.push(...cached);candidateTriangleCount+=cached[0].indices.length/3;')
          .replace("Object.defineProperty(query,'skinnedVertexCount'","Object.defineProperty(query,'candidateTriangleCount',{get:()=>candidateTriangleCount});Object.defineProperty(query,'skinnedVertexCount'");
      },
    }]});
    await server.listen();
    const {chromium}=require(process.env.BENCH_PLAYWRIGHT||'playwright');
    browser=await chromium.launch({headless:true,...(process.env.BENCH_CHROME?{executablePath:process.env.BENCH_CHROME}:{})});
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
    const failedResponse=new Promise((_,reject)=>page.on('response',r=>{
      if(r.status()>=400) reject(Error(`HTTP ${r.status()} ${r.url()}`));
    }));
    failedResponse.catch(()=>{}); // A response may fail before page.goto resolves.
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__bone-bench`);
    await Promise.race([page.waitForFunction(()=>window.ready,null,{timeout:180000}),failedResponse]);
    const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const trace=[];
    if(profiling) {
      cdp.on('Tracing.dataCollected',e=>trace.push(...e.value));
      await cdp.send('Tracing.start',{categories:'v8,devtools.timeline,blink.user_timing',options:'record-as-much-as-possible'});
      await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
    }
    const cases=await page.evaluate(()=>window.runBoneBvhBench());
    if(profiling) {
      fs.writeFileSync(path.join(output,'cpu-profile.json'),JSON.stringify((await cdp.send('Profiler.stop')).profile));
      const finished=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');await finished;
      fs.writeFileSync(path.join(output,'trace.json'),JSON.stringify({traceEvents:trace}));
    }
    if(errors.length) throw Error(errors.join('\n'));
    const hash=createHash('sha256');
    for(const file of ['client/src/player/hitSurface.ts','client/src/player/bindPoseBvh.ts','client/src/player/boneBvhPadding.ts','client/src/game/projectileSystem.ts','shared/projectileCollider.ts']) {
      hash.update(file);if(fs.existsSync(path.join(tree,file))) hash.update(fs.readFileSync(path.join(tree,file)));
    }
    return {name,repeat,sha:git(tree,'rev-parse','HEAD'),dirty:git(tree,'status','--short'),sourceHash:hash.digest('hex'),browser:await browser.version(),cases};
  } finally {await browser?.close();await server?.close();}
}

module.exports={stats};
if(require.main===module) (async()=>{
  if(!output || !process.env.BENCH_STAGING) throw Error('Set BENCH_OUT and BENCH_STAGING');
  fs.mkdirSync(output,{recursive:true});const runs=[];
  for(let repeat=0;repeat<(profiling?1:3);repeat++) for(const [name,tree] of variants) {
    console.log(`BEGIN ${name} repeat ${repeat}`);
    const run=await measure(name,tree,repeat);runs.push(run);
    fs.writeFileSync(path.join(output,`${name}-${repeat}.json`),JSON.stringify(run,null,2));
    console.log(JSON.stringify(Object.fromEntries(Object.entries(run.cases).map(([key,c])=>[key,{...stats(c.times),zones:c.zones,actorHits:c.actorHits,verticesPerShot:c.vertices/c.shots,trianglesPerShot:c.triangles/c.shots}]))));
  }
  if(profiling) return;
  const summary={protocol:{phase:'FLOATING',animation:'Alien_Swimming',dt:1/60,players:8,throttle:4,warmup:40,frames:240,repeats:3,order:['staging','head'],timer:'ProjectileSystem.update only'},versions:{}};
  for(const [name] of variants) {
    const subset=runs.filter(r=>r.name===name),cases={};
    if(new Set(subset.map(r=>r.sourceHash)).size!==1) throw Error(`${name} source changed between repeats`);
    for(const key of Object.keys(subset[0].cases)) {
      const values=subset.map(r=>r.cases[key]),zones={};
      for(const c of values) for(const [zone,count] of Object.entries(c.zones)) zones[zone]=(zones[zone]||0)+count;
      const shots=values.reduce((n,c)=>n+c.shots,0);
      cases[key]={...stats(values.flatMap(c=>c.times)),zones,shots,actorHits:values.reduce((n,c)=>n+c.actorHits,0),verticesPerShot:values.reduce((n,c)=>n+c.vertices,0)/shots,trianglesPerShot:values.reduce((n,c)=>n+c.triangles,0)/shots,boneMatricesPerShot:values.reduce((n,c)=>n+c.bones,0)/shots};
    }
    summary.versions[name]={sha:subset[0].sha,sourceHash:subset[0].sourceHash,cases};
  }
  summary.zoneParity=Object.keys(summary.versions.head.cases).every(key=>{
    const a=summary.versions.staging.cases[key],b=summary.versions.head.cases[key];
    return a.actorHits===b.actorHits && a.shots===b.shots && JSON.stringify(a.zones)===JSON.stringify(b.zones) && [0,1,2].every(repeat=>{
      const x=runs.find(r=>r.name==='staging' && r.repeat===repeat).cases[key],y=runs.find(r=>r.name==='head' && r.repeat===repeat).cases[key];
      return x.actorHits===y.actorHits && x.shots===y.shots && JSON.stringify(x.zones)===JSON.stringify(y.zones);
    });
  });
  summary.acceptance={hitEvery1P95:summary.versions.head.cases.hit_every1.p95<16.67,missEvery10Mean:summary.versions.head.cases.miss_every10.mean<=1.04};
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
