/** Optional V5 local-browser Whisper. Lazy model fetch only after explicit click.
 * Never uploads user PCM. Downloads public ONNX model weights to browser cache.
 * Sung lyrics can be hallucinated: every result is UNVERIFIED.
 */
import {pipeline,env} from '@huggingface/transformers';
env.allowLocalModels=false;
type Job={type:'transcribe';id:number;audio:Float32Array;sampleRate:16000;duration:number};
type Chunk={text:string;timestamp:[number,number]};
let decoder:unknown=null;
async function getDecoder(){
 if(decoder)return decoder;
 const createAsr=pipeline as unknown as (task:string,model:string,options:Record<string,unknown>)=>Promise<unknown>;
 decoder=await createAsr('automatic-speech-recognition','Xenova/whisper-tiny.en',{
  progress_callback:(progress:unknown)=>{
   if(progress&&typeof progress==='object'&&'progress'in progress){
    const p=progress as {progress?:number;file?:string};
    self.postMessage({type:'model-progress',progress:Math.round(Number(p.progress)||0),file:String(p.file||'model').slice(0,100)});
   }
  }
 });
 return decoder;
}
self.onmessage=async(e:MessageEvent<Job>)=>{
 const task=e.data;
 if(!task||task.type!=='transcribe'||!Number.isInteger(task.id)||!(task.audio instanceof Float32Array)||task.sampleRate!==16000)return;
 const id=task.id,duration=Math.min(Math.max(0,task.duration),task.audio.length/16000);
 try{
  const transcriber=await getDecoder();
  self.postMessage({type:'model-ready',id});
  const chunks=Math.ceil(duration/18);
  for(let j=0;j<chunks;j++){
   const from=j*18,to=Math.min(duration,from+18);
   const fragment=task.audio.slice(Math.floor(from*16000),Math.floor(to*16000));
   // This is isolated LEAD/DOUBLES/ADLIBS audio; no beat, no cloud inference.
   const result=await (transcriber as any)(fragment,{return_timestamps:'word',language:'english',task:'transcribe'});
   const r=result as {text?:string;chunks?:Chunk[]};
   const words=(Array.isArray(r.chunks)?r.chunks:[]).filter(x=>x&&Array.isArray(x.timestamp)&&Number.isFinite(x.timestamp[0])&&Number.isFinite(x.timestamp[1])&&x.timestamp[1]>x.timestamp[0]&&x.timestamp[0]>=0&&x.timestamp[1]<=18.5)
    .slice(0,250).map(x=>({text:String(x.text).slice(0,160),start:x.timestamp[0]+from,end:x.timestamp[1]+from}));
   self.postMessage({type:'segment',id,index:j,total:chunks,words,text:String(r.text||'').slice(0,2400),from,to});
  }
  self.postMessage({type:'done',id,total:chunks});
 }catch(error){self.postMessage({type:'error',id,message:error instanceof Error?error.message:String(error)})}
};
