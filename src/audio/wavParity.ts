/** Checks a 24-bit PCM WAV against the exact current audio buffer.
 * This is a byte-stream audit, NOT a decoding/playback effect.
 * Explicit error codes prevent claiming that external DSP coloration is solved.
 */
export type WavParityReport={
  matched:boolean;status:'match'|'mismatch';channels:number;sampleRate:number;frames:number;
  maxDifference:number;meanDifference:number;rmsDifference:number;peakOfReference:number;
  peakOfFile:number;differingSamples:number;worstAtSeconds:number;
};
const invalid=(reason:string):never=>{throw new Error(reason)};
const getFourCC=(v:DataView,at:number)=>String.fromCharCode(v.getUint8(at),v.getUint8(at+1),v.getUint8(at+2),v.getUint8(at+3));
export async function verifyMasterWav(fileData:ArrayBuffer,expected:AudioBuffer):Promise<WavParityReport>{
 if(fileData.byteLength<44)invalid('WAV file too short.');
 const view=new DataView(fileData);
 if(getFourCC(view,0)!=='RIFF'||getFourCC(view,8)!=='WAVE')invalid('Not a RIFF WAVE file.');
 let offset=12,format=0,channels=0,sampleRate=0,bits=0,dataStart=-1,dataBytes=0;
 while(offset+8<=view.byteLength){
  const chunk=getFourCC(view,offset),size=view.getUint32(offset+4,true),start=offset+8;
  if(size>view.byteLength-start)invalid('Malformed WAV chunk.');
  if(chunk==='fmt '){
   if(size<16)invalid('Invalid WAV format chunk.');
   format=view.getUint16(start,true);channels=view.getUint16(start+2,true);
   sampleRate=view.getUint32(start+4,true);bits=view.getUint16(start+14,true);
  }else if(chunk==='data'){dataStart=start;dataBytes=size;break}
  offset=start+size+(size%2);
 }
 if(format!==1||bits!==24||![1,2].includes(channels))invalid('This verifier accepts A$RAM-style uncompressed PCM 24-bit mono/stereo WAV only.');
 if(dataStart<0||dataBytes%(channels*3)!==0)invalid('Missing or invalid PCM data chunk.');
 const frames=dataBytes/(channels*3),expectedChannels=Math.min(2,expected.numberOfChannels);
 if(frames!==expected.length||channels!==expectedChannels||sampleRate!==expected.sampleRate)
  invalid('Audio format/length differs from the current ENGINE buffer. Reimport the same sources/preset and check you selected the correct export.');
 const reference=Array.from({length:channels},(_,i)=>expected.getChannelData(i));
 let maxDifference=0,squared=0,mean=0,differingSamples=0,worstFrame=0,refPeak=0,wavPeak=0;
 const count=frames*channels,chunkFrames=65536;
 for(let startFrame=0;startFrame<frames;startFrame+=chunkFrames){
  const to=Math.min(frames,startFrame+chunkFrames);
  for(let frame=startFrame;frame<to;frame++){
   const base=dataStart+frame*channels*3;
   for(let ch=0;ch<channels;ch++){
    const at=base+ch*3;
    let sample=view.getUint8(at)|(view.getUint8(at+1)<<8)|(view.getUint8(at+2)<<16);
    if(sample&0x800000)sample-=0x1000000;
    const output=sample/8388608,input=reference[ch][frame];
    const delta=Math.abs(output-input);
    if(delta>maxDifference){maxDifference=delta;worstFrame=frame}
    mean+=delta;squared+=delta*delta;refPeak=Math.max(refPeak,Math.abs(input));wavPeak=Math.max(wavPeak,Math.abs(output));
    if(delta>2/8388608)differingSamples++;
   }
  }
  // Yield periodically: avoid a long frozen UI for full songs.
  if(to<frames)await new Promise<void>(r=>setTimeout(r,0));
 }
 const meanDifference=mean/Math.max(1,count),rmsDifference=Math.sqrt(squared/Math.max(1,count));
 const matched=maxDifference<=2/8388608&&meanDifference<=1.5/8388608;
 return {matched,status:matched?'match':'mismatch',channels,sampleRate,frames,maxDifference,meanDifference,rmsDifference,peakOfReference:refPeak,peakOfFile:wavPeak,differingSamples,worstAtSeconds:worstFrame/sampleRate};
}
