/**
 * Multi-version signal-fidelity audit:
 * V5 pre-Orbits frozen vs V4.6 Orbits OFF (and HRTF preselected).
 * Same 24-bit input files, same V5 preset, same Room/Halo + Superboost DSP.
 * Optional ON is evaluated in independent narrow event windows.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const oldPort=4391,newPort=4392;
const original='/tmp/asram-pre-orbits-audit';
const root=process.cwd();
const servers=[
 spawn(process.execPath,[root+'/node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(oldPort),'--strictPort'],{cwd:original,stdio:'ignore'}),
 spawn(process.execPath,[root+'/node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(newPort),'--strictPort'],{cwd:root,stdio:'ignore'})
];
function wav(freq){
 const sr=44100,n=sr*4,b=Buffer.alloc(44+n*4);
 b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(4*sr,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*4,40);
 for(let i=0;i<n;i++){let t=i/sr;
  // Beat has low-frequency pulse and sustained synth harmonic; lead has two phrases separated by a break.
  let voice=freq>200?((t>.4&&t<1.2)||(t>2.75&&t<3.65)?1:.02):1;
  let x=voice*(.15*Math.sin(2*Math.PI*freq*t)+.085*Math.sin(2*Math.PI*(freq*3)*t));
  if(freq<200)x+=.075*Math.sin(2*Math.PI*70*t)*Math.exp(-((t*2)%1)*7);
  if(freq>700)x=(t>1.5&&t<2.2)?(.20*Math.sin(2*Math.PI*freq*t)):0;
  let sample=Math.round(Math.max(-.9,Math.min(.9,x))*32767);
  b.writeInt16LE(sample,44+i*4);b.writeInt16LE(sample,46+i*4)
 }
 return b;
}
const files=[
 {name:'beat-audit.wav',mimeType:'audio/wav',buffer:wav(125)},
 {name:'lead-audit.wav',mimeType:'audio/wav',buffer:wav(310)},
 {name:'adlibs-audit.wav',mimeType:'audio/wav',buffer:wav(1150)}
];
const sign=(b,i)=>{let x=b[i]|b[i+1]<<8|b[i+2]<<16;return x&0x800000?x-0x1000000:x};
const compare=(a,b,start=0,end=9999)=>{
 assert.equal(a.length,b.length,'PCM length / source rate changed');
 assert.equal(a.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',0,4),'RIFF');
 const n=(a.length-44)/6,sr=44100;
 let abs=0,max=0,changed=0,meanL=0,meanR=0,peakL=0,peakR=0,count=0;
 for(let sample=Math.floor(start*sr);sample<Math.min(n,Math.floor(end*sr));sample++){
  for(let ch=0;ch<2;ch++){
   const v=sign(a,44+(sample*2+ch)*3)/8388608,w=sign(b,44+(sample*2+ch)*3)/8388608;
   const diff=Math.abs(v-w);abs+=diff;max=Math.max(max,diff);if(diff>1e-7)changed++;meanL+=v*v;meanR+=w*w;peakL=Math.max(peakL,Math.abs(v));peakR=Math.max(peakR,Math.abs(w));count++;
  }
 }
 return {max,meanDiff:abs/Math.max(count,1),changed,referenceRms:Math.sqrt(meanL/Math.max(count,1)),testRms:Math.sqrt(meanR/Math.max(count,1)),referencePeak:peakL,testPeak:peakR};
};
let browser;
try{
 for(const port of [oldPort,newPort]){let ready=false;for(let i=0;i<90;i++){try{ready=(await fetch('http://127.0.0.1:'+port+'/')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,200))}assert(ready,'server '+port)}
 browser=await (process.env.PLAYWRIGHT_BROWSER==='webkit'?webkit:chromium).launch({headless:true,args:process.env.PLAYWRIGHT_BROWSER==='webkit'?[]:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1360,height:940},acceptDownloads:true});
 const errors=[];const pre=await context.newPage();pre.on('pageerror',e=>errors.push('pre:'+e.message));
 await pre.goto('http://127.0.0.1:'+oldPort+'/',{waitUntil:'networkidle'});
 await pre.getByRole('button',{name:/STEMS/}).first().click();
 for(const [i,file] of files.entries())await pre.locator('.stemGrid .stemChannel').nth(i===2?3:i).locator('input[type=file]').setInputFiles(file);
 await pre.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();await pre.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 await pre.getByRole('button',{name:/ROOM V4.3 · CENTER \+ HALO/}).click();
 await pre.getByRole('button',{name:/SUPERBOOST OFF/}).click();
 await pre.getByRole('button',{name:/REBUILD ROOM BUS/}).click();await pre.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:60000});
 await pre.waitForFunction(()=>{const e=document.querySelector('button.export');return e&&!e.hasAttribute('disabled')},null,{timeout:90000});
 const presetEvent=pre.waitForEvent('download');await pre.getByRole('button',{name:/SAVE SETTINGS/}).click();
 const preset=JSON.parse(await readFile(await (await presetEvent).path(),'utf8'));
 assert.equal(preset.version,5);assert.equal(preset.haloMode,true);assert.equal(preset.superboostOn,true);
 const preExport=pre.waitForEvent('download');await pre.locator('button.export').click();
 const pcmPre=await readFile(await (await preExport).path());
 const current=await context.newPage();current.on('pageerror',e=>errors.push('orbits:'+e.message));
 await current.goto('http://127.0.0.1:'+newPort+'/',{waitUntil:'networkidle'});
 await current.getByRole('button',{name:/STEMS/}).first().click();
 await current.locator('.earlyPresetLoader input[type=file]').setInputFiles({name:'original-v5-preset.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(preset))});
 for(const [i,file] of files.entries())await current.locator('.stemGrid .stemChannel').nth(i===2?3:i).locator('input[type=file]').setInputFiles(file);
 await current.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();await current.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:60000});
 await current.waitForFunction(()=>{const e=document.querySelector('button.export');return e&&!e.hasAttribute('disabled')},null,{timeout:90000});
 const orbitsPanel=current.getByRole('region',{name:'Rear Orbits Micro Events'});
 assert.equal(await orbitsPanel.getByRole('button',{name:'ORBIT ENGINE · OFF'}).count(),1);
 const offExport=current.waitForEvent('download');await current.locator('button.export').click();const pcmOff=await readFile(await (await offExport).path());
 const dryParity=compare(pcmPre,pcmOff);
 assert(dryParity.max<.00035,'pre-Orbits and Orbit OFF differ beyond independent WebAudio render tolerance');
 // Nontrivial disabled scene: HRTF ON, 100% wet and rear, event in same break.
 await orbitsPanel.getByRole('slider',{name:'Orbit wet intensity'}).fill('100');
 await orbitsPanel.getByRole('slider',{name:'Orbit rear depth'}).fill('100');
 await orbitsPanel.getByRole('button',{name:/\+ DETAIL AT PLAYHEAD/}).click();
 await orbitsPanel.getByRole('combobox',{name:'Orbit event source'}).selectOption('adlibs');
 await orbitsPanel.getByRole('slider',{name:'Orbit event time'}).fill('1.5');
 await orbitsPanel.getByRole('slider',{name:'Orbit event duration'}).fill('0.7');
 await orbitsPanel.getByRole('combobox',{name:'Orbit event route'}).selectOption('front-to-rear-right');
 const stillOff=current.waitForEvent('download');await current.locator('button.export').click();const pcmOffWithScene=await readFile(await (await stillOff).path());
 const bypassParity=compare(pcmOff,pcmOffWithScene);
 assert(bypassParity.max<.00035,'OFF with 100% wet, HRTF and event fails true bypass');
 await orbitsPanel.getByRole('button',{name:'ORBIT ENGINE · OFF'}).click();
 await current.waitForFunction(()=>{const e=document.querySelector('button.export');return e&&!e.hasAttribute('disabled')},null,{timeout:90000});
 const withHrtf=current.waitForEvent('download');await current.locator('button.export').click();const pcmHrtf=await readFile(await (await withHrtf).path());
 const hrtfBreak=compare(pcmOff,pcmHrtf,1.5,2.5),hrtfQuiet=compare(pcmOff,pcmHrtf,0,.8),hrtfEnd=compare(pcmOff,pcmHrtf,3,3.75);
 // Separate toggles retain old room bus and audio mastering.
 await orbitsPanel.getByRole('button',{name:/3D HRTF/}).click();
 await current.waitForFunction(()=>{const e=document.querySelector('button.export');return e&&!e.hasAttribute('disabled')},null,{timeout:90000});
 const withoutHrtf=current.waitForEvent('download');await current.locator('button.export').click();const pcmNoHrtf=await readFile(await (await withoutHrtf).path());
 const noHrtfBreak=compare(pcmOff,pcmNoHrtf,1.5,2.5),noHrtfQuiet=compare(pcmOff,pcmNoHrtf,0,.8);
 assert(hrtfBreak.max>.00001&&noHrtfBreak.max>.00001,'ON failed to create requested localized event');
 // Determine how much global PCM processing changed outside the local event windows.
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('CROSS VERSION ORBIT/ROOM PCM AUDIT PASS',JSON.stringify({engine:process.env.PLAYWRIGHT_BROWSER==='webkit'?'webkit':'chromium',sourceVersion:'V5 pre-orbits',currentVersion:'V4.6',presetVersion:preset.version,dryParity,bypassParity,hrtfBreak,hrtfQuiet,hrtfEnd,noHrtfBreak,noHrtfQuiet,offWavBytes:pcmOff.length,sourceFiles:files.map(f=>f.name)}));
}finally{await browser?.close();for(const s of servers)s.kill('SIGTERM')}
