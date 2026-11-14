/** Release-gate smoke tests for strictly read-only Master Inspector and Orbit density schema. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
const moduleFromSource=async path=>{
 const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
 const {code}=await transform(source,{loader:'ts',format:'esm',target:'es2022'});
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
};
const orbit=await moduleFromSource('src/audio/microOrbits.ts');
assert.equal(orbit.ORBIT_MAX_EVENTS,75);
assert.deepEqual(orbit.ORBIT_DENSITY_LIMITS,{subtle:20,cinematic:40,experimental:75});
for(const mode of ['subtle','cinematic','experimental']){
 assert(orbit.validOrbitSettings({...orbit.orbitDefaults,densityMode:mode}));
}
assert(orbit.validOrbitSettings(orbit.orbitDefaults),'old V6 preset without densityMode must load');
assert(!orbit.validOrbitSettings({...orbit.orbitDefaults,densityMode:'invalid'}));
const inspector=await moduleFromSource('src/audio/masterInspector.ts');
const input={peak:-4,truePeak:-3.8,lufs:-19,rms:-22,crest:18,correlation:.9,dc:.0001,sub:.1,low:.2,mid:.5,high:.2};
const output={...input,lufs:-14,truePeak:-1.2,crest:12,correlation:.7};
let review=inspector.reviewMaster(input,output,{busy:false,roomPending:false,originalLock:false});
assert.equal(review.ready,true);
assert.equal(review.loudnessDelta,5);
assert.equal(review.crestDelta,-6);
assert.equal(review.findings.filter(x=>x.level==='review').length,0);
review=inspector.reviewMaster(input,{...output,truePeak:.3,correlation:-.1},{busy:false,roomPending:false,originalLock:false});
assert.equal(review.sampleOver,true);
assert.equal(review.monoRisk,true);
assert(review.findings.some(x=>x.name==='INTER-SAMPLE OVER'));
assert(review.findings.some(x=>x.name==='MONO / PHASE'));
review=inspector.reviewMaster(input,output,{busy:false,roomPending:true,originalLock:true});
assert.equal(review.ready,false);
assert(review.findings.some(x=>x.name==='ROOM STALE'));
assert(review.findings.some(x=>x.name==='ORIGINAL LOCK'));
assert.equal(inspector.reviewMaster(input,null,{busy:false,roomPending:false,originalLock:false}).ready,false);
console.log('PASS orbit 20/40/75 preset compatibility + read-only master inspector QA gates');
