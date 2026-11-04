/** V4.5 Rear Orbits: real front/rear HRTF motion, V6 scenes, replace vocal without stale orbit, dry preserve. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4384','--strictPort'],{cwd:root,stdio:'ignore'});
function wav(freq=145){
 const sr=44100,n=sr*3,bytes=Buffer.alloc(44+n*4);
 bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);bytes.writeUInt32LE(sr,24);bytes.writeUInt32LE(sr*4,28);bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){const v=Math.round(12000*(.7*Math.sin(2*Math.PI*freq*i/sr)+.17*Math.sin(2*Math.PI*freq*4*i/sr)));bytes.writeInt16LE(v,44+i*4);bytes.writeInt16LE(v,46+i*4)}return bytes;
}
const files=[{name:'beat.wav',mimeType:'audio/wav',buffer:wav(122)},{name:'lead.wav',mimeType:'audio/wav',buffer:wav(330)},{name:'adlibs.wav',mimeType:'audio/wav',buffer:wav(935)}];
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch('http://127.0.0.1:4384/')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,250))}
 assert(ready,'Vite server');
 const engine=process.env.PLAYWRIGHT_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch({headless:true,args:engine===webkit?[]:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1360,height:920},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4384/',{waitUntil:'networkidle'});
 const dsp=await page.evaluate(async()=>{
  const {renderMicroOrbits,scoutMicroOrbits,orbitDefaults,orbitPathPositions,validOrbitSettings,orbitVoicePriorityGain}=await import('/src/audio/microOrbits.ts');
  const sr=44100,n=sr*3,mix=new AudioBuffer({sampleRate:sr,length:n,numberOfChannels:2});
  const lead=new AudioBuffer({sampleRate:sr,length:n,numberOfChannels:1});
  const adlibs=new AudioBuffer({sampleRate:sr,length:n,numberOfChannels:1});
  for(let i=0;i<n;i++){
   const t=i/sr;
   const low=.12*Math.sin(2*Math.PI*95*t);
   const hi=t>.85&&t<1.10?.13*Math.sin(2*Math.PI*1100*t):0;
   mix.getChannelData(0)[i]=low+hi;mix.getChannelData(1)[i]=low*.94+hi;
   lead.getChannelData(0)[i]=t>.85&&t<1.10?.23*Math.sin(2*Math.PI*970*t):0;
   adlibs.getChannelData(0)[i]=t>1.68&&t<1.96?.26*Math.sin(2*Math.PI*1810*t):0;
  }
  const stems={lead:{buffer:lead,mute:false,solo:false},doubles:{buffer:null,mute:false,solo:false},adlibs:{buffer:adlibs,mute:false,solo:false}};
  const events=[{id:1,source:'lead',at:.83,duration:.70,path:'front-to-rear-left',band:'voice',level:.9}];
  const overlappingLead=new AudioBuffer({sampleRate:sr,length:n,numberOfChannels:1});
  for(let i=0;i<n;i++){const t=i/sr;overlappingLead.getChannelData(0)[i]=t>1.66&&t<2.06?.27*Math.sin(2*Math.PI*260*t):0}
  const activeVoice=orbitVoicePriorityGain(overlappingLead,1.82,.9);
  const quietVoice=orbitVoicePriorityGain(overlappingLead,.70,.9);
  const unprotected=orbitVoicePriorityGain(overlappingLead,1.82,0);
  const protectiveStems={...stems,lead:{buffer:overlappingLead,mute:false,solo:false}};
  const overlappingEvent=[{id:2,source:'adlibs',at:1.7,duration:.34,path:'rear-drift-right',band:'detail',level:.85}];
  const withoutDucking=await renderMicroOrbits(mix,protectiveStems,overlappingEvent,{...orbitDefaults,enabled:true,hrtf:false,amount:.7,voicePriority:0,trail:0});
  const withDucking=await renderMicroOrbits(mix,protectiveStems,overlappingEvent,{...orbitDefaults,enabled:true,hrtf:false,amount:.7,voicePriority:1,trail:0});
  const wetEnergy=buffer=>{let sum=0;const p=buffer.getChannelData(0),base=mix.getChannelData(0);for(let i=Math.floor(1.76*sr);i<Math.floor(2.08*sr);i++){const delta=p[i]-base[i];sum+=delta*delta}return Math.sqrt(sum/Math.floor(.32*sr))};
  const overlapWetWithout=wetEnergy(withoutDucking),overlapWetWith=wetEnergy(withDucking);
  const disabled=await renderMicroOrbits(mix,stems,events,{...orbitDefaults,enabled:false});
  const zero=await renderMicroOrbits(mix,stems,events,{...orbitDefaults,enabled:true,amount:0});
  const enabled=await renderMicroOrbits(mix,stems,events,{...orbitDefaults,enabled:true,hrtf:false,amount:.7});
  const enabledHrtf=await renderMicroOrbits(mix,stems,events,{...orbitDefaults,enabled:true,hrtf:true,amount:.7,motion:1,trail:.4});
  const f2r=orbitPathPositions('front-to-rear-right',.8,1);
  const r2f=orbitPathPositions('rear-to-front-left',.8,1);
  const around=orbitPathPositions('full-orbit-cw',.8,1);
  const settingsValidated=validOrbitSettings({...orbitDefaults,motion:1,trail:.6});
  const badSettingsRejected=!validOrbitSettings({...orbitDefaults,motion:5});
  const compare=(a,b,begin,end)=>{
   const left=a.getChannelData(0),right=b.getChannelData(0);
   let maximum=0,mean=0,finite=true,num=0;
   for(let i=Math.floor(begin*sr);i<Math.floor(end*sr);i++){const d=Math.abs(left[i]-right[i]);maximum=Math.max(maximum,d);mean+=d;finite=finite&&Number.isFinite(left[i])&&Number.isFinite(right[i]);num++}
   return {maximum,mean:mean/Math.max(1,num),finite};
  };
  return {sameObject:disabled===mix,zeroSame:zero===mix,early:compare(mix,enabled,0,.75),during:compare(mix,enabled,.87,1.26),later:compare(mix,enabled,1.7,2.5),hrtfs:compare(mix,enabledHrtf,.87,1.26),rate:enabled.sampleRate,length:enabled.length,f2r,r2f,around,settingsValidated,badSettingsRejected,activeVoice,quietVoice,unprotected,overlapWetWithout,overlapWetWith,
   suggested:scoutMicroOrbits(mix,stems,'stems',5).map(x=>({source:x.source,at:x.at,path:x.path})),
   stereo:scoutMicroOrbits(mix,{},'stereo',5).map(x=>x.source)};
 });
 assert.equal(dsp.sameObject,true,'OFF must return original source buffer by identity');
 assert.equal(dsp.zeroSame,true,'intensity=0 must bypass original by identity');
 assert.equal(dsp.rate,44100);assert.equal(dsp.length,44100*3);
 assert(dsp.settingsValidated&&dsp.badSettingsRejected,'new motion and persistence validate strictly');
 assert(dsp.activeVoice<.6&&dsp.quietVoice===1&&dsp.unprotected===1,'voice priority only ducks under audible LEAD');
 assert(dsp.overlapWetWith<dsp.overlapWetWithout*.8,'vocal activity must reduce Orbit wet reflections without changing original');
 assert(dsp.f2r[0][1]<0&&dsp.f2r.at(-1)[1]>0,'FRONT to REAR crosses listener plane');
 assert(dsp.r2f[0][1]>0&&dsp.r2f.at(-1)[1]<0,'REAR to FRONT crosses listener plane');
 assert.equal(dsp.around.length,9,'full 360 trajectory must contain multiple directional waypoints');
 assert(dsp.around.some(p=>p[1]<0)&&dsp.around.some(p=>p[1]>0)&&dsp.around.some(p=>p[0]<0)&&dsp.around.some(p=>p[0]>0),'full 360 must cover front/back/left/right');
 assert(dsp.early.finite&&dsp.during.finite&&dsp.later.finite&&dsp.hrtfs.finite);
 assert(dsp.early.maximum<1e-7&&dsp.later.maximum<1e-7,'wet-only event must not alter dry audio outside event window');
 assert(dsp.during.maximum>0.00001,'moving wet fragment must be audible in PCM');
 assert(dsp.hrtfs.maximum>0.000001,'HRTF path must process when enabled');
 assert(dsp.suggested.every(x=>['lead','adlibs','doubles'].includes(x.source)),'STEM scout must never pick BEAT or full MIX');
 assert(dsp.stereo.every(x=>x==='mix'),'stereo path should identify filtered excerpts only');
 await page.getByRole('button',{name:/STEMS/}).first().click();
 for(let i=0;i<files.length;i++)await page.locator('.stemGrid .stemChannel').nth(i===2?3:i).locator('input[type=file]').setInputFiles(files[i]);
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 await page.getByRole('button',{name:/ROOM V4.3 · CENTER \+ HALO/}).click();
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 const panel=page.getByRole('region',{name:'Rear Orbits Micro Events'});await panel.waitFor({timeout:10000});
 assert.equal(await panel.getByRole('button',{name:'ORBIT ENGINE · OFF'}).count(),1,'OFF by default');
 await page.waitForFunction(()=>{const e=document.querySelector('button.export');return e&&!e.hasAttribute('disabled')},null,{timeout:90000});
 const before=page.waitForEvent('download',{timeout:30000});await page.locator('button.export').click();const baseline=await readFile(await (await before).path());
 const mainSeek=page.locator('input.seek');
 const miniSeek=page.getByRole('slider',{name:'Orbit synced timeline seek'});
 await miniSeek.fill('1.25');
 assert(Math.abs(Number(await mainSeek.inputValue())-1.25)<.02,'Orbit seek and main seek are the same transport clock');
 assert(Math.abs(Number((await page.locator('[data-testid=orbit-synced-playhead]').getAttribute('style')).match(/left:\\s*([\d.]+)%/)?.[1]??0)-1.25/3*100)<1,'mini cursor follows main playhead');
 await panel.getByRole('button',{name:'Play from Orbit timeline'}).click();
 await panel.getByRole('button',{name:'Pause from Orbit timeline'}).waitFor({timeout:20000});
 await page.waitForTimeout(120);
 assert(Number(await miniSeek.inputValue())>1.25,'mini progress must move during actual playback');
 await panel.getByRole('button',{name:'Pause from Orbit timeline'}).click();
 await panel.getByRole('button',{name:/SCOUT THIS BREAK/}).click();
 const sourceInput=panel.getByRole('combobox',{name:'Orbit event source'});
 assert(await sourceInput.count()>0,'Auto scout must propose lead/adlib events');
 assert.notEqual(await sourceInput.inputValue(),'mix','STEM scout should select a real vocal detail');
 await panel.getByRole('combobox',{name:'Orbit event route'}).selectOption('front-to-rear-right');
 await panel.getByRole('slider',{name:'Orbit trajectory span'}).fill('90');
 await panel.getByRole('slider',{name:'Orbit rear persistence'}).fill('55');
 await panel.getByRole('slider',{name:'Orbit voice priority'}).fill('80');
 await panel.getByRole('button',{name:/3D HRTF/}).click();
 await panel.getByRole('button',{name:/3D HRTF/}).click();
 await panel.getByRole('button',{name:'ORBIT ENGINE · OFF'}).click();
 assert.equal(await panel.getByRole('button',{name:'ORBIT ENGINE · ON'}).count(),1);
 await page.waitForFunction(()=>{const e=document.querySelector('button.export');return e&&!e.hasAttribute('disabled')},null,{timeout:90000});
 const after=page.waitForEvent('download',{timeout:30000});await page.locator('button.export').click();const orbitWav=await readFile(await (await after).path());
 assert.equal(orbitWav.length,baseline.length,'Orbit output remains same PCM length');
 assert(!orbitWav.equals(baseline),'ON with proposed events must create changed WAV');
 const saved=page.waitForEvent('download');await page.getByRole('button',{name:/SAVE SETTINGS · V6/}).click();const preset=JSON.parse(await readFile(await (await saved).path(),'utf8'));
 assert.equal(preset.version,6);assert.equal(preset.orbitSettings.enabled,true);assert(preset.orbitEvents.length>0);
 assert.equal(preset.orbitSettings.motion,.9);assert.equal(preset.orbitSettings.trail,.55);assert.equal(preset.orbitSettings.voicePriority,.8);
 assert.equal(preset.orbitEvents[0].path,'front-to-rear-right');
 assert.equal(preset.superboostOn,false);assert.equal(preset.haloMode,true);
 await panel.getByRole('button',{name:'ORBIT ENGINE · ON'}).click();
 await page.waitForFunction(()=>{const e=document.querySelector('button.export');return e&&!e.hasAttribute('disabled')},null,{timeout:90000});
 const nowOff=page.waitForEvent('download');await page.locator('button.export').click();const offWav=await readFile(await (await nowOff).path());
 assert.equal(offWav.length,baseline.length);
 // OFF produces the original chain: allow tiny floating-point variance between independent offline render passes.
 const maxSampleDelta=(a,b)=>{let max=0;for(let i=44;i<a.length;i+=3){let x=a[i]|a[i+1]<<8|a[i+2]<<16,y=b[i]|b[i+1]<<8|b[i+2]<<16;if(x&0x800000)x-=0x1000000;if(y&0x800000)y-=0x1000000;max=Math.max(max,Math.abs(x-y)/8388608)}return max};
 assert(maxSampleDelta(offWav,baseline)<.0003,'OFF master must numerically match baseline');
 await page.getByRole('button',{name:/NEW SESSION/}).click();await page.getByRole('button',{name:/STEMS/}).first().click();
 await page.locator('.earlyPresetLoader input[type=file]').setInputFiles({name:'rear-orbits-v6.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(preset))});
 await page.getByText(/V6 COMPLETE · ROOM \+ MASTER \+ STEM MIX/).waitFor();
 for(let i=0;i<files.length;i++)await page.locator('.stemGrid .stemChannel').nth(i===2?3:i).locator('input[type=file]').setInputFiles(files[i]);
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 assert.equal(await page.getByRole('button',{name:'ORBIT ENGINE · ON'}).count(),1);
 const loadedEvents=page.locator('.orbitMarker');
 assert.equal(await loadedEvents.count(),preset.orbitEvents.length);
 assert.equal(await page.getByRole('slider',{name:'Orbit trajectory span'}).inputValue(),'90');
 assert.equal(await page.getByRole('slider',{name:'Orbit rear persistence'}).inputValue(),'55');
 assert.equal(await page.getByRole('slider',{name:'Orbit voice priority'}).inputValue(),'80');
 // The edited source file is not auto-reloaded: explicitly replace the LEAD.
 await page.locator('.stemSourceManager summary').click();
 await page.locator('.stemSourceManager .stemManageRow').nth(1).locator('input[type=file]').setInputFiles({name:'lead-cleaned-in-daw.wav',mimeType:'audio/wav',buffer:wav(510)});
 await page.getByText(/LEAD REPLACEMENT · ROOM must be rebuilt/).waitFor({timeout:15000});
 assert.equal(await page.getByRole('button',{name:'ORBIT ENGINE · OFF'}).count(),1,'replacement forcibly disables any Orbit scene');
 assert.equal(await page.getByRole('button',{name:/SMART SCOUT/}).isDisabled(),true,'cannot scout stale original ROOM after reimport');
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 assert.equal(await page.getByRole('button',{name:'ORBIT ENGINE · OFF'}).count(),1,'user must re-enable Orbit after vocal replacement');
 assert.equal(await page.locator('.orbitMarker').count(),preset.orbitEvents.length,'scene remains editable after source replacement');
 await page.getByRole('button',{name:'ORBIT ENGINE · OFF'}).click();
 await page.waitForFunction(()=>{const e=document.querySelector('button.export');return e&&!e.hasAttribute('disabled')},null,{timeout:90000});
 assert.equal(errors.length,0,errors.join(' / '));
 console.log('REAR ORBITS V4.6 PASS',JSON.stringify({engine:engine===webkit?'webkit':'chromium',dsp,uiEvents:preset.orbitEvents.length,offMaxDelta:maxSampleDelta(offWav,baseline),enabledWav:true,v6Imported:true,leadReplacementSafe:true,miniTimelineSynced:true,voicePriorityValidated:true}));
}finally{await browser?.close();server.kill('SIGTERM')}
