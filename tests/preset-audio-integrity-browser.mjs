/** A$RAM ENGINE V5 audio integrity: preset Superboost recall + audition + tab-return state. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4371','--strictPort'],{cwd:root,stdio:'ignore'});
function wav(freq=150){
 const sr=44100,frames=sr*3,bytes=Buffer.alloc(44+frames*4);bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);
 bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);bytes.writeUInt32LE(sr,24);bytes.writeUInt32LE(sr*4,28);bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);
 bytes.write('data',36);bytes.writeUInt32LE(frames*4,40);
 for(let i=0;i<frames;i++){const v=Math.round(12000*(.65*Math.sin(i*2*Math.PI*freq/sr)+.22*Math.sin(i*2*Math.PI*(freq*2.8)/sr)+.13*Math.sin(i*2*Math.PI*3500/sr)));bytes.writeInt16LE(v,44+i*4);bytes.writeInt16LE(v,46+i*4)}
 return bytes;
}
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch('http://127.0.0.1:4371/')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,240))}
 assert(ready,'server');
 const engine=process.env.PLAYWRIGHT_BROWSER==='webkit'?webkit:chromium;browser=await engine.launch({headless:true,args:engine===webkit?[]:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Original=window.AudioContext;window.AudioContext=class extends Original{constructor(...a){super(...a);window.__latestCtx=this}}});
 await page.goto('http://127.0.0.1:4371/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/STEMS/}).first().click();
 const originalFiles=[{name:'beat.wav',mimeType:'audio/wav',buffer:wav(115)},{name:'lead.wav',mimeType:'audio/wav',buffer:wav(280)}];
 for(let i=0;i<2;i++)await page.locator('.stemGrid .stemChannel').nth(i).locator('input[type=file]').setInputFiles(originalFiles[i]);
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:40000});
 await page.getByRole('button',{name:/ROOM V4.3 · CENTER \+ HALO/}).click();
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 await page.getByRole('button',{name:/SUPERBOOST OFF/}).click();
 await page.waitForFunction(()=>{const b=document.querySelector('button.export');return b&&!b.hasAttribute('disabled')},null,{timeout:90000});
 assert((await page.getByRole('button',{name:/SUPERBOOST ON/}).count())===1,'Superboost enabled visibly');
 const first=page.waitForEvent('download');await page.getByRole('button',{name:/SAVE SETTINGS · V6/}).click();
 const preset=JSON.parse(await readFile(await (await first).path(),'utf8'));
 assert.equal(preset.superboostOn,true);assert.equal(preset.bypass.space,false);assert.equal(preset.haloMode,true);
 const expA=page.waitForEvent('download');await page.locator('button.export').click();const pcmA=await readFile(await (await expA).path());
 // A fresh session must restore the same audible path.
 await page.getByRole('button',{name:/NEW SESSION/}).click();await page.getByRole('button',{name:/STEMS/}).first().click();
 await page.locator('.earlyPresetLoader input[type=file]').setInputFiles({name:'boost-v5.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(preset))});
 await page.getByText(/SUPERBOOST SAVED ON · ACTIVE WHEN ENGINE B RENDER IS READY/).waitFor({timeout:15000});
 for(let i=0;i<2;i++)await page.locator('.stemGrid .stemChannel').nth(i).locator('input[type=file]').setInputFiles(originalFiles[i]);
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:40000});
 assert.equal(await page.getByRole('button',{name:/SUPERBOOST ON · WAV/}).count(),1,'Superboost correctly restored ON');
 assert((await page.locator('.signalAudit').innerText()).includes('SUPERBOOST: ON · INCLUDED IN ENGINE B'));
 await page.waitForFunction(()=>{const b=document.querySelector('button.export');return b&&!b.hasAttribute('disabled')},null,{timeout:90000});
 const expB=page.waitForEvent('download');await page.locator('button.export').click();const pcmB=await readFile(await (await expB).path());
 assert.equal(pcmB.length,pcmA.length);
 // Browser WebAudio may be non-bit-exact. Require close normalized PCM parity.
 const signed=(b,i)=>{const x=b[i]|b[i+1]<<8|b[i+2]<<16;return x&0x800000?x-0x1000000:x};
 let maxDelta=0,averageDelta=0;
 for(let i=44;i<pcmB.length;i+=3){const d=Math.abs(signed(pcmB,i)-signed(pcmA,i))/8388608;maxDelta=Math.max(maxDelta,d);averageDelta+=d}
 averageDelta/=((pcmB.length-44)/3);
 assert(maxDelta<0.0003&&averageDelta<0.00005,`preset Superboost PCM changed by ${maxDelta}`);
 // Space bypass is deliberately retained; UI must not pretend Superboost is active.
 await page.getByRole('button',{name:/SPACE ACTIVE/}).click();
 assert.equal(await page.getByRole('button',{name:/SUPERBOOST ON · BLOCKED BY SPACE BYPASS/}).count(),1);
 assert(await page.getByText(/SUPERBOOST IS SAVED ON BUT INAUDIBLE/).count()>0);
 assert((await page.locator('.signalAudit').innerText()).includes('BLOCKED BY SPACE BYPASS'));
 const blocked=page.waitForEvent('download');await page.getByRole('button',{name:/SAVE SETTINGS · V6/}).click();const blockedPreset=JSON.parse(await readFile(await (await blocked).path(),'utf8'));
 assert.equal(blockedPreset.superboostOn,true);assert.equal(blockedPreset.bypass.space,true);
 await page.getByRole('button',{name:/NEW SESSION/}).click();await page.getByRole('button',{name:/STEMS/}).first().click();
 await page.locator('.earlyPresetLoader input[type=file]').setInputFiles({name:'blocked-v5.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(blockedPreset))});
 await page.getByText(/SUPERBOOST SAVED ON BUT SPACE IS BYPASSED/).waitFor({timeout:15000});
 for(let i=0;i<2;i++)await page.locator('.stemGrid .stemChannel').nth(i).locator('input[type=file]').setInputFiles(originalFiles[i]);
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 assert.equal(await page.getByRole('button',{name:/SUPERBOOST ON · BLOCKED BY SPACE BYPASS/}).count(),1);
 await page.waitForFunction(()=>{const b=document.querySelector('button.export');return b&&!b.hasAttribute('disabled')},null,{timeout:90000});
 // Returning to the tab after Safari-like suspension must preserve active session and playhead.
 await page.getByRole('button',{name:'Play audio'}).click();await page.getByRole('button',{name:'Pause audio'}).waitFor({timeout:30000});
 await page.waitForTimeout(120);
 await page.evaluate(async()=>await window.__latestCtx.suspend());
 await page.getByText(/AUDIO PAUSED · SESSION SAFE/).waitFor({timeout:15000});
 assert.equal(await page.getByRole('button',{name:'RESUME AUDIO'}).count(),1);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'))});
 await page.getByRole('button',{name:'RESUME AUDIO'}).click();
 await page.getByRole('button',{name:'Pause audio'}).waitFor({timeout:30000});
 assert.equal(await page.evaluate(()=>window.__latestCtx.state),'running');
 await page.locator('.stemSourceManager summary').click();
 assert(await page.getByText('beat.wav').count()>0);
 assert.equal(errors.length,0,errors.join(' / '));
 console.log('PRESET SOUND & SAFARI TAB RETURN PASS',JSON.stringify({engine:engine===webkit?'webkit':'chromium',superboostRestored:true,blockedTruthfully:true,maxDelta,averageDelta,tabReturn:true,stemsRetained:true}));
}finally{await browser?.close();server.kill('SIGTERM')}
