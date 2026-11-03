/** Exportable stereo spatial master: frequency-dependent side gain, no artificial reverb. */
export function immersiveMaster(src:AudioBuffer,amount=.55):AudioBuffer{
 if(src.numberOfChannels<2)return src;
 const out=new AudioBuffer({length:src.length,numberOfChannels:2,sampleRate:src.sampleRate});
 const l=src.getChannelData(0),r=src.getChannelData(1),ol=out.getChannelData(0),or=out.getChannelData(1);
 const alpha=Math.exp(-2*Math.PI*180/src.sampleRate);let lowSide=0;
 const width=1+Math.max(0,Math.min(1,amount))*.18;
 for(let i=0;i<src.length;i++){
  const mid=(l[i]+r[i])*.5,side=(l[i]-r[i])*.5;
  lowSide=alpha*lowSide+(1-alpha)*side;
  const shaped=lowSide+(side-lowSide)*width;
  ol[i]=mid+shaped;or[i]=mid-shaped;
 }
 return out;
}