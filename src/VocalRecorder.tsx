import {useEffect,useRef,useState} from 'react';
type Props={onTake:(file:File)=>void};
export default function VocalRecorder({onTake}:Props){
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),chunks=useRef<Blob[]>([]);
 const [recording,setRecording]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState(''),[last,setLast]=useState<File|null>(null);
 const stopTracks=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null};
 useEffect(()=>()=>{if(recorder.current?.state==='recording')recorder.current.stop();stopTracks()},[]);
 const start=async()=>{setError('');try{
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('Microphone recording unsupported in this browser');
  const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
  stream.current=mic;chunks.current=[];
  const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(x=>MediaRecorder.isTypeSupported(x));
  const rec=new MediaRecorder(mic,mime?{mimeType:mime}:undefined);recorder.current=rec;
  rec.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};
  rec.onerror=()=>{setError('Microphone recorder failed');setRecording(false);stopTracks()};
  rec.onstop=async()=>{setRecording(false);stopTracks();setWorking(true);try{
   const blob=new Blob(chunks.current,{type:rec.mimeType||'audio/webm'});
   if(!blob.size)throw Error('Empty recording');
   const ctx=new AudioContext();
   try{const decoded=await ctx.decodeAudioData(await blob.arrayBuffer());
    const count=Math.min(2,decoded.numberOfChannels),bytes=decoded.length*count*3;
    const raw=new ArrayBuffer(44+bytes),v=new DataView(raw);
    const str=(o:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
    str(0,'RIFF');v.setUint32(4,36+bytes,true);str(8,'WAVE');str(12,'fmt ');
    v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,count,true);
    v.setUint32(24,decoded.sampleRate,true);v.setUint32(28,decoded.sampleRate*count*3,true);
    v.setUint16(32,count*3,true);v.setUint16(34,24,true);str(36,'data');v.setUint32(40,bytes,true);
    let o=44;for(let i=0;i<decoded.length;i++)for(let c=0;c<count;c++){const x=Math.max(-1,Math.min(1,decoded.getChannelData(c)[i]));const q=Math.round(x<0?x*8388608:x*8388607);v.setUint8(o++,q&255);v.setUint8(o++,(q>>8)&255);v.setUint8(o++,(q>>16)&255)}
    const take=new File([raw],'ASRAM_VOCAL_TAKE_'+new Date().toISOString().replace(/[:.]/g,'-')+'.wav',{type:'audio/wav'});setLast(take);
   }finally{await ctx.close()}
  }catch(e){setError('Could not decode microphone recording on this browser. Try Chrome.')}finally{setWorking(false)}};
  rec.start(250);setRecording(true);
 }catch(e){setError(e instanceof Error?e.message:'Microphone permission denied');stopTracks()}};
 const stop=()=>{if(recorder.current?.state==='recording')recorder.current.stop()};
 const download=()=>{if(!last)return;const url=URL.createObjectURL(last),a=document.createElement('a');a.href=url;a.download=last.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 return <section style={{padding:18,border:'1px solid #555',borderRadius:12,margin:'16px 0',background:'#17171b',color:'#f1f1f1'}}>
  <div style={{fontWeight:800,letterSpacing:2}}>● VOCAL BOOTH · LOCAL TAKE RECORDER</div>
  <p style={{opacity:.7,fontSize:12}}>Record a microphone take locally. WAV 24-bit conversion after capture; browser capture may use lossy compression. Use headphones to prevent bleed. Not yet multitrack overdubbing.</p>
  <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
   <button disabled={working} onClick={recording?stop:start} style={{padding:'10px 18px',background:recording?'#8f2638':'#313138',color:'white',borderRadius:7}}>{recording?'■ STOP RECORDING':working?'PROCESSING…':'● RECORD VOICE'}</button>
   {last&&<><button onClick={download}>↓ SAVE TAKE WAV</button><button onClick={()=>onTake(last)}>OPEN TAKE IN ENGINE</button></>}
  </div>
  {error&&<p role='alert' style={{color:'#ff9ca9'}}>{error}</p>}
 </section>
}