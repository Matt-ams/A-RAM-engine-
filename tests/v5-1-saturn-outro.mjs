/** V5.1 SATURN OUTRO: event validity, stereo trajectory and no legacy route regressions.
 * This is a deterministic DSP-configuration test, NOT a substitute for TT4 ears-on listening.
 */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/audio/saturn.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const saturn=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const event={id:12,source:'lead',at:121.5,duration:5.7,path:'head-orbit-cw',level:.93};
assert.equal(saturn.SATURN_MAX_DURATION,6.5);
assert.ok(saturn.validSaturnEvent(event),'reviewed 5.7 second vocal phrase accepted');
assert.equal(saturn.validSaturnEvent({...event,duration:6.6}),false,'limit protects rendering');
assert.equal(saturn.validSaturnEvent({...event,source:'beat'}),false,'never move instrumental BEAT');
assert.equal(saturn.validSaturnEvent({...event,at:-1}),false);
for(const route of ['head-orbit-cw','head-orbit-ccw']){
 const p=saturn.saturnPathPoints(route,.88,.96);
 assert.ok(p.length>=7,'full head movement with intermediate positions');
 assert.ok(p.some(z=>z[0]<-.45),'reaches left');
 assert.ok(p.some(z=>z[0]>.45),'reaches right');
 assert.ok(p.some(z=>z[1]<-.5),'passes front');
 assert.ok(p.some(z=>z[1]>.7),'passes behind');
 assert.deepEqual(p[0],p[p.length-1],'closes the full circular path');
 assert.ok(p.every(v=>v.every(Number.isFinite)));
}
assert.ok(saturn.validSaturnEvent({...event,path:'rear-loop-cw',duration:.58}),'old SATURN presets remain accepted');
console.log('V5.1 SATURN OUTRO: 6.5s vocal route, full circle and legacy compatibility PASS');
