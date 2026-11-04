/** Test browser audio suspension and recovery WITHOUT page reload or STEM loss. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4323','--strictPort'],{cwd:root,stdio:'ignore'});
function wav(freq=145){const sr=44100,frames=sr*10,bytes=Buffer.alloc(44+frames*4);bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);bytes.writeUInt32LE(sr,24);bytes.writeUInt32LE(sr*4,28);bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(frames*4,40);for(let i=0;i<frames;i++){const v=Math.round(9000*Math.sin(i*2*Math.PI*freq/sr));bytes.writeInt16LE(v,44+i*4);bytes.writeInt16LE(v,46+i*4)}return bytes}
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch('http://127.0.0.1:4323/')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,250))}
 assert(ready,'Vite not ready');
 const engine=process.env.PLAYWRIGHT_BROWSER==='webkit'?webkit:chromium;
 browser=await engine.launch({headless:true,args:engine===webkit?[]:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 await page.addInitScript(()=>{
  const Original=window.AudioContext;
  window.AudioContext=class extends Original{
    constructor(...a){super(...a);window.__lastAudioContext=this;window.__ctxCount=(window.__ctxCount??0)+1}
  };
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4323/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/STEMS/}).first().click();
 const inputs=page.locator('input[type=file][accept*="audio"]');
 await inputs.nth(0).setInputFiles({name:'beat.wav',mimeType:'audio/wav',buffer:wav(124)});
 await inputs.nth(1).setInputFiles({name:'lead.wav',mimeType:'audio/wav',buffer:wav(264)});
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:45000});
 await page.getByRole('button',{name:'Play audio'}).click();
 await page.getByRole('button',{name:'Pause audio'}).waitFor({timeout:25000});
 assert.equal(await page.evaluate(()=>window.__lastAudioContext.state),'running','audio context must start running');
 await page.evaluate(async()=>{await window.__lastAudioContext.suspend()});
 await page.getByText(/AUDIO INTERRUPTED · SESSION SAFE/).waitFor({timeout:25000});
 await page.getByRole('button',{name:'Play audio'}).click();
 await page.getByRole('button',{name:'Pause audio'}).waitFor({timeout:25000});
 assert.equal(await page.evaluate(()=>window.__lastAudioContext.state),'running','suspended audio context must resume on Play');
 await page.getByRole('button',{name:'Pause audio'}).click();
 await page.evaluate(async()=>{await window.__lastAudioContext.suspend();window.__lastAudioContext.resume=async()=>{throw Error('forced-resume-failure')}});
 await page.getByRole('button',{name:'Play audio'}).click();
 await page.getByText(/Unable to start audio/).waitFor({timeout:25000});
 const oldCount=await page.evaluate(()=>window.__ctxCount);
 await page.getByRole('button',{name:'REPAIR AUDIO'}).click();
 await page.waitForFunction(()=>window.__ctxCount>1&&window.__lastAudioContext.state==='running',{timeout:25000});
 assert((await page.evaluate(()=>window.__ctxCount))>oldCount,'repair must create a fresh context');
 assert.equal(await page.getByRole('button',{name:'Play audio'}).count(),1);
 assert.equal(await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).count(),1,'ROOM layout should be preserved');
 await page.getByRole('button',{name:'Play audio'}).click();
 await page.getByRole('button',{name:'Pause audio'}).waitFor({timeout:25000});
 await page.locator('.stemSourceManager summary').click();
 assert(await page.getByText('beat.wav').count()>0 && await page.getByText('lead.wav').count()>0,'source files retained across audio repair');
 assert.equal(errors.length,0,errors.join(' / '));
 console.log('AUDIO RECOVERY PASS',JSON.stringify({engine:engine===webkit?'webkit':'chromium',oldCount,newCount:await page.evaluate(()=>window.__ctxCount),sourcePreserved:true}));
}finally{await browser?.close();server.kill('SIGTERM')}
