export function peakLimitLookahead(buffer:AudioBuffer,ceilingDb:number,driveDb:number=0){
 const channels=Array.from({length:Math.min(2,buffer.numberOfChannels)},(_,c)=>buffer.getChannelData(c));
 const len=buffer.length,sr=buffer.sampleRate,look=Math.max(1,Math.round(sr*.005)),release=Math.exp(-1/(sr*.12));
 const target=Math.pow(10,Math.min(-.5,ceilingDb)/20),drive=Math.pow(10,driveDb/20);
 const out=new AudioBuffer({length:len,numberOfChannels:channels.length,sampleRate:sr});
 // Precomputed sliding-window maximum: monotonic deque O(n), shared stereo envelope.
 const peaks=new Float32Array(len),dq=new Int32Array(len);let head=0,tail=0;
 for(let i=0;i<len;i++){let pk=0;for(const ch of channels)pk=Math.max(pk,Math.abs(ch[i]*drive));peaks[i]=pk}
 const maxAhead=new Float32Array(len);
 for(let i=0;i<len;i++){const end=Math.min(len-1,i+look);while(tail>head&&peaks[dq[tail-1]]<=peaks[end])tail--;dq[tail++]=end;while(tail>head&&dq[head]<i)head++;maxAhead[i]=peaks[dq[head]]}
 let gain=1;
 for(let i=0;i<len;i++){const desired=Math.min(1,target/Math.max(1e-12,maxAhead[i]));gain=desired<gain?desired:desired+(gain-desired)*release;for(let c=0;c<channels.length;c++)out.getChannelData(c)[i]=channels[c][i]*drive*gain}
 return out;
}