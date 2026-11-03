/** V4.3.1: UI workflow regression, no PCM/DSP tuning. Browser: Chromium. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4311','--strictPort'],{cwd:root,stdio:'ignore'});
function wav(freq=160){
 const sr=44100,frames=Math.round(sr*1.3),bytes=Buffer.alloc(44+frames*4);
 bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);
 bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);
 bytes.writeUInt32LE(sr,24);bytes.writeUInt32LE(sr*4,28);bytes.writeUInt16LE(4,32);
 bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(frames*4,40);
 for(let i=0;i<frames;i++){const value=Math.round(12000*Math.sin(2*Math.PI*freq*i/sr));bytes.writeInt16LE(value,44+i*4);bytes.writeInt16LE(value,46+i*4)}
 return bytes;
}
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch('http://127.0.0.1:4311/')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,250))}
 assert(ready,'Vite not ready');
 browser=await (process.env.PLAYWRIGHT_BROWSER==='webkit'?webkit:chromium).launch({headless:true,args:process.env.PLAYWRIGHT_BROWSER==='webkit'?[]:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:860},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4311/',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:/STEMS/}).first().click();
 const inputs=page.locator('input[type=file][accept*="audio"]');
 await inputs.nth(0).setInputFiles({name:'beat.wav',mimeType:'audio/wav',buffer:wav(110)});
 await inputs.nth(1).setInputFiles({name:'lead.wav',mimeType:'audio/wav',buffer:wav(260)});
 await page.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:50000});
 assert((await page.locator('.roomVersion button.sel').innerText()).includes('CLASSIC'));
 await page.getByRole('button',{name:/ROOM V4.3 · CENTER \+ HALO/}).click();
 assert(await page.locator('button.export').isDisabled());
 assert(await page.locator('.roomEditNotice').isVisible());
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:50000});
 await page.locator('button.export').waitFor({state:'visible'});
 await page.waitForFunction(()=>{const x=document.querySelector('button.export');return x&&!x.hasAttribute('disabled')},{timeout:50000});
 const slider=page.locator('.haloPanel input[type=range]').first();
 await slider.scrollIntoViewIfNeeded();
 const beforeSlider=await page.evaluate(()=>scrollY);
 await slider.click({position:{x:Math.round((await slider.boundingBox()).width*.8),y:10}});
 const afterSlider=await page.evaluate(()=>scrollY);
 assert(Math.abs(afterSlider-beforeSlider)<85,'slider caused excessive viewport scroll');
 assert((await page.locator('.roomVersion span').innerText()).includes('PENDING'));
 // Drag the beat endpoint across the physical room with 25 pointer-move events.
 const svg=page.locator('svg[viewBox="0 0 600 420"]');
 await svg.scrollIntoViewIfNeeded();
 const handle=svg.locator('g').first();
 const box=await handle.boundingBox();assert(box);
 const startScroll=await page.evaluate(()=>scrollY);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+130,box.y+box.height/2+35,{steps:25});
 await page.mouse.up();
 const endScroll=await page.evaluate(()=>scrollY);
 assert(Math.abs(endScroll-startScroll)<110,'drag caused excessive viewport scroll');
 assert((await page.locator('.roomVersion span').innerText()).includes('PENDING'));
 assert(await page.locator('button.export').isDisabled());
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:50000});
 // Replace a stem AFTER an active bus exists. The previous export must be invalidated.
 await page.locator('.stemSourceManager summary').click();
 const sourceInputs=page.locator('.stemSourceManager input[type=file]');
 await sourceInputs.nth(1).setInputFiles({name:'lead-new.wav',mimeType:'audio/wav',buffer:wav(280)});
 await page.locator('.roomVersion span').filter({hasText:'PENDING'}).waitFor({timeout:12000});
 assert(await page.locator('button.export').isDisabled(),'replaced stem must invalidate export');
 await page.getByRole('button',{name:/ROOM V4.1 · CLASSIC/}).click();
 await page.getByRole('button',{name:/REBUILD ROOM BUS/}).click();
 await page.locator('.roomVersion span').filter({hasText:'SYNCED'}).waitFor({timeout:50000});
 assert.equal(errors.length,0,errors.join(' / '));
 const mobile=await browser.newPage({viewport:{width:390,height:844}});
 await mobile.goto('http://127.0.0.1:4311/',{waitUntil:'networkidle'});
 await mobile.getByRole('button',{name:/STEMS/}).first().click();
 const mobileInputs=mobile.locator('input[type=file][accept*="audio"]');
 await mobileInputs.nth(0).setInputFiles({name:'beat.wav',mimeType:'audio/wav',buffer:wav(105)});
 await mobileInputs.nth(1).setInputFiles({name:'lead.wav',mimeType:'audio/wav',buffer:wav(275)});
 await mobile.getByRole('button',{name:/BUILD REAL STEM BUS/}).click();
 await mobile.locator('.stemSourceManager summary').click();
 const mobileSizes=await mobile.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
 assert(mobileSizes.content<=mobileSizes.viewport+2,'mobile source manager overflows width');
 await mobile.close();
 console.log('ROOM V4.3.1 UI PASS',JSON.stringify({engine:process.env.PLAYWRIGHT_BROWSER??'chromium',sliderScrollDelta:afterSlider-beforeSlider,dragScrollDelta:endScroll-startScroll,stemChangeInvalidates:true,classicRebuild:true,mobileSizes}));
}finally{await browser?.close();server.kill('SIGTERM')}
