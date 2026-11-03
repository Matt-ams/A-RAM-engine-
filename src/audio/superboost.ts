/** V4 SUPERBOOST signature retained: short 23/41ms cross-room reflections.
 * V4.1: side-only high-pass and preflight correlation guard to reduce mono cancellation.
 * Depth sets reflection intensity, NOT measured listener distance.
 */
export async function superboostRoom(src:AudioBuffer,depth:number,focus:number):Promise<AudioBuffer>{
 if(src.numberOfChannels<2||depth<=0)return src;
 const sr=src.sampleRate,n=src.length,l=src.getChannelData(0),r=src.getChannelData(1);
 const out=new AudioBuffer({length:n,numberOfChannels:2,sampleRate:sr}),L=out.getChannelData(0),R=out.getChannelData(1);
 let lr=0,ll=0,rr=0;for(let i=0;i<n;i+=16){lr+=l[i]*r[i];ll+=l[i]*l[i];rr+=r[i]*r[i]}
 const correlation=lr/Math.sqrt(Math.max(1e-12,ll*rr));
 const safety=correlation<0?.25:correlation<.2?.55:1;
 const d1=Math.round(.023*sr),d2=Math.round(.041*sr),wet=.17*Math.min(1,Math.max(0,depth))*(1-.8*Math.min(1,Math.max(0,focus)))*safety;
 const hp=new Float32Array(n),a=Math.exp(-2*Math.PI*145/sr);let low=0;
 for(let i=0;i<n;i++){const side=(l[i]-r[i])*.5;low=a*low+(1-a)*side;hp[i]=side-low}
 for(let i=0;i<n;i++){
  const reflect1=i>=d1?-hp[i-d1]:0,reflect2=i>=d2?hp[i-d2]:0,room=wet*(reflect1+.55*reflect2);
  L[i]=l[i]+room;R[i]=r[i]-room;
 }
 return out;
}
