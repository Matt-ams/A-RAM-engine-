/** V4 PRECISION: sub-mono guard and DC block, with no intentional loudness boost. */
export function studioQuality(src:AudioBuffer,monoSubHz=110):AudioBuffer{
 const sr=src.sampleRate,n=src.length,ch=Math.min(2,src.numberOfChannels);
 const out=new AudioBuffer({numberOfChannels:ch,length:n,sampleRate:sr});
 const a=Math.exp(-2*Math.PI*monoSubHz/sr),dcA=Math.exp(-2*Math.PI*8/sr);
 const L=src.getChannelData(0),R=src.getChannelData(ch===2?1:0),l=out.getChannelData(0),r=ch===2?out.getChannelData(1):null;
 let lowL=0,lowR=0,dcL=0,dcR=0,prevL=0,prevR=0;
 for(let i=0;i<n;i++){
  const x=L[i],y=R[i];lowL=a*lowL+(1-a)*x;lowR=a*lowR+(1-a)*y;
  const common=(lowL+lowR)*.5,xl=x-lowL+common,yr=y-lowR+common;
  dcL=xl-prevL+dcA*dcL;dcR=yr-prevR+dcA*dcR;prevL=xl;prevR=yr;
  l[i]=dcL;if(r)r[i]=dcR;
 }
 return out;
}
