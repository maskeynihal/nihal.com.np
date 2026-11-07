/* ================= 8 · dog on a walk ================= */
const DG={
  head(a,pant,t){ // origin at the neck, pointing +x; a = nose-down angle
    g.save();g.rotate(a);
    g.beginPath();g.moveTo(5,-12);g.quadraticCurveTo(0,-4,3,8);g.quadraticCurveTo(10,4,11,-6);g.closePath();fillP();ink(.95,1.6);
    g.beginPath();g.moveTo(4,-7);g.quadraticCurveTo(8,-14,16,-13);g.quadraticCurveTo(24,-12,29,-5);g.quadraticCurveTo(33,-3,32,1);g.quadraticCurveTo(30,5,22,5);g.quadraticCurveTo(12,7,6,3);g.quadraticCurveTo(1,-1,4,-7);fillP();ink(.98,1.9);
    g.beginPath();g.moveTo(8,-12);g.quadraticCurveTo(2,-4,5,5);g.quadraticCurveTo(12,-1,13,-10);g.closePath();fillP();ink(.95,1.6);
    circ(31,-1.5,2.3);fillS(1);circ(18,-6,1.6);fillS(1);
    g.beginPath();g.moveTo(31,2);g.quadraticCurveTo(24,5,18,4);ink(.8,1.2);
    if(pant){const o=Math.sin(t*10)*1.2;g.beginPath();g.moveTo(21,4);g.quadraticCurveTo(22,10+o,25,9+o);g.quadraticCurveTo(26,6,25,3);fillS(.55);ink(.9,1.2)}
    g.restore();
  },
  stand(ph,gait,headA,tailW,pant,t,ball){
    const hips=[[20,-23],[14,-23],[-14,-23],[-20,-23]],offs=[0,PI,PI,0];
    const leg=(i)=>{const h=hips[i],p=ph+offs[i],amp=11*gait,lift=7*gait;const fx=h[0]+Math.sin(p)*amp+(gait>0?0:(i<2?1:-1)),fy=-Math.max(0,Math.cos(p))*lift;const kx=(h[0]+fx)/2+(i<2?-3:3),ky=(h[1]+fy)/2;
      g.beginPath();g.moveTo(h[0],h[1]);g.lineTo(kx,ky);g.lineTo(fx,fy);ink(i===1||i===2?.6:.98,2.4);g.beginPath();g.moveTo(fx-1,fy);g.lineTo(fx+4,fy);ink(i===1||i===2?.6:.98,2.4)};
    leg(1);leg(2);
    // tail
    const tw=Math.sin(t*(tailW>.5?14:7))*tailW*9;
    g.beginPath();g.moveTo(-29,-32);g.quadraticCurveTo(-39,-38+tw*.3,-42+tw*.5,-50+Math.abs(tw)*.2);ink(.98,2.6);
    g.beginPath();g.moveTo(-30,-31);g.bezierCurveTo(-30,-42,-14,-44,0,-43);g.bezierCurveTo(12,-42,20,-44,26,-48);g.bezierCurveTo(32,-40,28,-24,22,-19);g.bezierCurveTo(10,-15,-8,-16,-20,-18);g.bezierCurveTo(-28,-20,-31,-25,-30,-31);fillP();ink(.98,2);
    g.beginPath();g.moveTo(-10,-37);g.quadraticCurveTo(0,-39,10,-37);ink(.3,1);
    leg(0);leg(3);
    g.save();g.translate(25,-46);DG.head(headA,pant,t);
    if(ball){g.save();g.rotate(headA);circ(33,2,5);fillP();ink(1,1.6);g.beginPath();g.arc(33,2,3.6,PI*.2,PI*.9);ink(.8,1.1);g.restore()}
    g.restore();
  },
  sit(headA,tailW,pant,t,ball){
    const tw=Math.sin(t*12)*tailW*5;
    g.beginPath();g.moveTo(-26,-5);g.quadraticCurveTo(-38,-2,-48,-5-Math.abs(tw)*.6);ink(.98,2.6);
    g.beginPath();g.moveTo(22,-30);g.lineTo(22,-3);g.moveTo(14,-30);g.lineTo(14,-3);ink(.98,2.4);g.beginPath();g.moveTo(21,-1);g.lineTo(27,-1);g.moveTo(13,-1);g.lineTo(19,-1);ink(.98,2.4);
    g.beginPath();g.moveTo(-28,-5);g.bezierCurveTo(-34,-24,-24,-38,-8,-44);g.bezierCurveTo(4,-48,14,-54,20,-56);g.bezierCurveTo(30,-46,28,-30,22,-24);g.bezierCurveTo(14,-14,8,-4,2,-2);g.lineTo(-28,-2);g.closePath();fillP();ink(.98,2);
    g.beginPath();g.ellipse(-12,-13,15,12,-.2,0,TAU);ink(.6,1.5);g.beginPath();g.moveTo(-4,-3);g.lineTo(10,-3);ink(.98,2.4);
    g.save();g.translate(20,-54);DG.head(headA-.12,pant,t);
    if(ball){g.save();g.rotate(headA-.12);circ(33,2,5);fillP();ink(1,1.6);g.restore()}
    g.restore();
  },
  paw(x,y,a,al){g.save();g.translate(x,y);g.rotate(a);g.beginPath();g.ellipse(0,0,3.2,2.6,0,0,TAU);ink(al,1.3);for(const [dx,dy] of [[-4,-3],[-1,-5],[3,-4]]){g.beginPath();g.arc(dx+3,dy,1.1,0,TAU);ink(al,1.1)}g.restore()},
  ball(x,y,r=5.5){circ(x,y,r);fillP();ink(1,1.7);g.beginPath();g.arc(x,y,r*.72,PI*.15,PI*.85);g.arc(x,y,r*.72,PI*1.15,PI*1.85);ink(.7,1.1)},
  tree(x,y,sz,t){g.beginPath();g.moveTo(x-3*sz,y);g.lineTo(x-2*sz,y-26*sz);g.moveTo(x+3*sz,y);g.lineTo(x+2*sz,y-26*sz);ink(.9,1.8);
    const sw=Math.sin(t*1.1+x)*1.5;
    for(const [dx,dy,r] of [[0,-44,17],[-13,-34,13],[13,-35,13],[0,-30,12]]){g.beginPath();g.arc(x+dx*sz+sw*(1+dy/-40),y+dy*sz,r*sz,0,TAU);fillP();ink(.88,1.7)}
    g.beginPath();for(let i=0;i<5;i++){g.moveTo(x-12*sz+i*6*sz,y-42*sz);g.lineTo(x-16*sz+i*6*sz,y-32*sz)}ink(.35,1.1)},
  sign(x,y,sz,txt){g.beginPath();g.moveTo(x,y);g.lineTo(x,y-50*sz);ink(.95,2);g.beginPath();PL([[x-6*sz,y-48*sz],[x+34*sz,y-48*sz],[x+42*sz,y-41*sz],[x+34*sz,y-34*sz],[x-6*sz,y-34*sz]],5,.5,true);fillP();ink(.95,1.7);
    g.font=`${9*sz}px ui-monospace,Menlo,monospace`;g.textAlign='left';g.fillStyle=SA(.95);g.fillText(txt,x-2*sz,y-38*sz);
    g.beginPath();PL([[x+6*sz,y-30*sz],[x-30*sz,y-30*sz],[x-36*sz,y-24*sz],[x-30*sz,y-18*sz],[x+6*sz,y-18*sz]],6,.5,true);fillP();ink(.95,1.7)},
  pond(x,y,sz,t){for(let i=0;i<2;i++){g.beginPath();g.ellipse(x,y,(44-i*14)*sz,(11-i*3)*sz,0,0,TAU);ink(.85-i*.2,1.6)}
    for(let i=0;i<2;i++){const r=((t*10+i*14)%26);g.beginPath();g.ellipse(x+8*sz,y,r*sz,r*.25*sz,0,0,TAU);ink(Math.max(0,.6-r/26*.6),1.2)}
    for(const dx of [-50,-44,50]){g.beginPath();g.moveTo(x+dx*sz,y+2);g.quadraticCurveTo(x+(dx+2)*sz,y-14*sz,x+(dx+(dx>0?4:-3))*sz,y-26*sz);ink(.8,1.5);g.beginPath();g.ellipse(x+(dx+(dx>0?4:-3))*sz,y-27*sz,2.4*sz,5*sz,.1,0,TAU);fillS(.7)}},
  lamp(x,y,sz,glow){g.beginPath();g.moveTo(x,y);g.lineTo(x,y-64*sz);ink(.95,2.2);g.beginPath();g.moveTo(x-9*sz,y-64*sz);g.lineTo(x+9*sz,y-64*sz);g.lineTo(x+6*sz,y-74*sz);g.lineTo(x-6*sz,y-74*sz);g.closePath();fillP();ink(.95,1.8);g.beginPath();g.moveTo(x-5*sz,y);g.lineTo(x+5*sz,y);ink(.9,2);
    if(glow>.02){CB.glow(x,y-62*sz,60*sz,.42*glow);g.beginPath();g.moveTo(x-4*sz,y-62*sz);g.lineTo(x-16*sz,y-40*sz);g.moveTo(x+4*sz,y-62*sz);g.lineTo(x+16*sz,y-40*sz);ink(.5*glow,1.2)}},
  rock(x,y,sz){g.beginPath();PL([[x-22*sz,y],[x-18*sz,y-12*sz],[x-6*sz,y-19*sz],[x+8*sz,y-16*sz],[x+20*sz,y-6*sz],[x+22*sz,y]],8,.8,true);fillP();ink(.9,1.8);g.beginPath();g.moveTo(x-8*sz,y-12*sz);g.lineTo(x-2*sz,y-6*sz);g.moveTo(x+4*sz,y-12*sz);g.lineTo(x+10*sz,y-5*sz);ink(.4,1.1)},
  fence(x,y,sz){for(let i=0;i<5;i++){g.beginPath();g.moveTo(x+i*13*sz,y);g.lineTo(x+i*13*sz,y-26*sz);g.lineTo(x+i*13*sz+3*sz,y-30*sz);g.lineTo(x+i*13*sz+6*sz,y-26*sz);g.lineTo(x+i*13*sz+6*sz,y);ink(.85,1.6)}
    g.beginPath();g.moveTo(x,y-20*sz);g.lineTo(x+58*sz,y-20*sz);g.moveTo(x,y-10*sz);g.lineTo(x+58*sz,y-10*sz);ink(.8,1.5)},
  flowers(x,y,sz,t){for(let i=0;i<3;i++){const fx=x+(i-1)*14*sz,fh=(22+i*5)*sz,sw=Math.sin(t*1.5+i)*2;g.beginPath();g.moveTo(fx,y);g.quadraticCurveTo(fx+sw*.5,y-fh*.5,fx+sw,y-fh);ink(.85,1.5);
      for(let k=0;k<6;k++){const a=k*TAU/6;g.beginPath();g.ellipse(fx+sw+Math.cos(a)*5*sz,y-fh+Math.sin(a)*5*sz,4*sz,2.2*sz,a,0,TAU);fillP();ink(.9,1.3)}circ(fx+sw,y-fh,2.4*sz);fillS(.8)}},
  chai(x,y,sz,t){g.beginPath();g.rect(x-26*sz,y-34*sz,52*sz,34*sz);fillP();ink(.9,1.7);g.beginPath();PL([[x-32*sz,y-34*sz],[x-24*sz,y-48*sz],[x+24*sz,y-48*sz],[x+32*sz,y-34*sz]],4,.5,true);fillP();ink(.95,1.8);
    for(let i=0;i<5;i++){g.beginPath();g.moveTo(x-28*sz+i*14*sz,y-48*sz);g.lineTo(x-30*sz+i*15*sz,y-34*sz);ink(.4,1)}
    g.beginPath();g.rect(x-10*sz,y-24*sz,20*sz,14*sz);ink(.8,1.4);g.beginPath();g.rect(x+12*sz,y-22*sz,8*sz,12*sz);ink(.7,1.2);
    g.font=`${8*sz}px ui-monospace,Menlo,monospace`;g.textAlign='center';g.fillStyle=SA(.95);g.fillText('chai',x,y-37*sz);
    for(let i=0;i<2;i++){g.beginPath();g.moveTo(x-4*sz+i*8*sz,y-26*sz);g.bezierCurveTo(x-8*sz+i*8*sz,y-34*sz+Math.sin(t*3+i)*2,x+i*8*sz,y-40*sz,x-3*sz+i*8*sz,y-48*sz);ink(.4,1.1)}},
  wheel(x,y,sz){g.beginPath();g.moveTo(x-12*sz,y);g.lineTo(x-12*sz,y-34*sz);g.moveTo(x+12*sz,y);g.lineTo(x+12*sz,y-34*sz);ink(.9,1.8);
    g.beginPath();g.rect(x-10*sz,y-32*sz,20*sz,22*sz);fillP();ink(.95,1.8);for(let i=0;i<3;i++){g.beginPath();g.moveTo(x-8*sz,y-28*sz+i*6*sz);g.lineTo(x+8*sz,y-28*sz+i*6*sz);ink(.5,1.1)}
    g.beginPath();g.moveTo(x-6*sz,y-34*sz);g.lineTo(x,y-44*sz);g.lineTo(x+6*sz,y-34*sz);ink(.9,1.5)},
  bench(x,y,sz){g.beginPath();g.moveTo(x-28*sz,y-18*sz);g.lineTo(x+28*sz,y-18*sz);g.moveTo(x-28*sz,y-26*sz);g.lineTo(x+28*sz,y-26*sz);g.moveTo(x-24*sz,y-18*sz);g.lineTo(x-24*sz,y);g.moveTo(x+24*sz,y-18*sz);g.lineTo(x+24*sz,y);g.moveTo(x-26*sz,y-34*sz);g.lineTo(x-26*sz,y-18*sz);g.moveTo(x+26*sz,y-34*sz);g.lineTo(x+26*sz,y-18*sz);ink(.9,2);
    g.beginPath();g.moveTo(x-28*sz,y-34*sz);g.lineTo(x+28*sz,y-34*sz);ink(.9,2)},
  mailbox(x,y,sz){g.beginPath();g.moveTo(x,y);g.lineTo(x,y-34*sz);ink(.95,2);g.beginPath();PL([[x-14*sz,y-34*sz],[x-14*sz,y-48*sz],[x+12*sz,y-48*sz],[x+14*sz,y-34*sz]],3,.5,true);fillP();ink(.95,1.8);g.beginPath();g.moveTo(x+12*sz,y-46*sz);g.lineTo(x+12*sz,y-56*sz);g.lineTo(x+20*sz,y-56*sz);ink(.9,1.6)},
  hydrant(x,y,sz){g.beginPath();PL([[x-8*sz,y],[x-8*sz,y-22*sz],[x-11*sz,y-26*sz],[x-6*sz,y-34*sz],[x+6*sz,y-34*sz],[x+11*sz,y-26*sz],[x+8*sz,y-22*sz],[x+8*sz,y]],3,.5,true);fillP();ink(.95,1.8);g.beginPath();g.moveTo(x-12*sz,y-18*sz);g.lineTo(x+12*sz,y-18*sz);ink(.8,1.5)}
};
VAR[8]={name:'dog on a walk',short:'dog',
init(c){
  const w=c.w,h=c.h,rg=mulberry(c.seed*29+13),u=clamp(w/540,.8,1.1),ph=rg()*3;
  const A=w*.27,P=c.phone?270:380;
  const px=[],py=[],ls=[0];
  for(let y=34;y<=h-30;y+=6){const x=w*.5+A*Math.sin((y-34)/P*TAU+ph)+A*.15*Math.sin((y-34)/P*TAU*2.2);px.push(x);py.push(y);if(px.length>1)ls.push(ls[ls.length-1]+Math.hypot(px[px.length-1]-px[px.length-2],y-py[py.length-2]))}
  const L=ls[ls.length-1];
  const kinds=['tree','chai','sign','pond','lamp','flowers','rock','wheel','fence','bench','mailbox','hydrant','tree'];
  const lm=[];let ki=0;
  const nearest=(x,y)=>{let b=1e9;for(let i=0;i<px.length;i+=2){const d=Math.hypot(px[i]-x,py[i]-y);if(d<b)b=d}return b};
  for(let y=100;y<h-80;y+=(c.phone?150:175)){
    const i=Math.min(px.length-1,Math.round((y-34)/6)),x0=px[i];
    let best=null,bs=-1;for(const sd of [-1,1]){const dist=(c.phone?86:100)*u;const x=clamp(x0+sd*dist,40*u,w-40*u);const sc=nearest(x,y);if(sc>bs){bs=sc;best={x,y:y+10}}}
    lm.push({kind:kinds[ki++%kinds.length],x:best.x,y:best.y,sz:(0.95+rg()*.3)*u*(c.phone?.9:1.1)});
  }
  const dog={s:Math.min(L,((E.sy-c.t+E.H*.5)/Math.max(h,1))*L*0),x:px[0],y:py[0],face:1,mode:'path',ph:0,gait:0,t:0,head:0,tail:.6,idle:0,ball:false,pant:false};
  const i0=Math.max(0,Math.min(px.length-1,Math.round((clamp(E.sy-c.t+E.H*.5,40,h-50)-34)/6)));dog.s=ls[i0];dog.x=px[i0];dog.y=py[i0];
  return {px,py,ls,L,lm,dog,prints:[],ball:null,u,pm:null,pstill:0,near:0,t:0,pmv:0,away:0};
},
pathAt(s,d){const ls=s.ls;let lo=0,hi=ls.length-1;d=clamp(d,0,s.L);while(hi-lo>1){const m=(lo+hi)>>1;if(ls[m]<d)lo=m;else hi=m}const t=(d-ls[lo])/((ls[hi]-ls[lo])||1);return [lerp(s.px[lo],s.px[hi],t),lerp(s.py[lo],s.py[hi],t)]},
tap(c,s,x,y){
  s.ball={x:x,y:y-80,x1:x,y1:y,t:0,state:'fall',vy:0,rest:0,carried:false};
  s.dog.mode='fetch';
},
update(c,s,dt){
  const d=s.dog,u=s.u;s.t+=dt;d.t+=dt;
  const t=s.t;
  // pointer
  let pv=0;if(c.mIn&&s.pm)pv=Math.hypot(c.mx-s.pm[0],c.my-s.pm[1])/Math.max(dt,1e-3);
  s.pm=c.mIn?[c.mx,c.my]:null;
  s.pmv=lerp(s.pmv,pv,.2);
  if(c.mIn)s.away=0;else s.away+=dt;
  const dist=(x,y)=>Math.hypot(x-d.x,y-d.y);
  const go=(tx,ty,sp,stopAt=0)=>{const dx=tx-d.x,dy=ty-d.y,L=Math.hypot(dx,dy);if(L<=stopAt+.5){d.sp=0;return 0}const mv=Math.min(L-stopAt,sp*dt);d.x+=dx/L*mv;d.y+=dy/L*mv;d.sp=mv/dt;if(Math.abs(dx)>3)d.face=dx>0?1:-1;return L-mv};
  d.sp=0;
  // the ball
  const b=s.ball;
  if(b){
    if(b.state==='fall'){b.vy+=1500*dt;b.y+=b.vy*dt;if(b.y>=b.y1){b.y=b.y1;b.vy=-b.vy*.45;b.bn=(b.bn||0)+1;if(b.bn>2||Math.abs(b.vy)<90){b.state='rest';b.vy=0}}}
    else if(b.state==='carried'){b.x=d.x+d.face*36*u;b.y=d.y-48*u}
    else if(b.state==='dropped'){b.rest+=dt;if(b.rest>5)s.ball=null}
  }
  // mode transitions
  const ytar=clamp(E.sy-c.t+E.H*.5,40,c.h-50);
  if(d.mode!=='fetch'&&d.mode!=='bring'){
    if(c.mIn&&s.pmv>80&&d.mode!=='chase'&&d.mode!=='pet'&&dist(c.mx,c.my)>90){d.mode='chase'}
    if((d.mode==='chase'||d.mode==='pet')&&s.away>1.6){d.mode='return'}
  }
  // find the home point of the path: where the viewport is
  const sT=(()=>{const i=Math.max(0,Math.min(s.px.length-1,Math.round((ytar-34)/6)));return s.ls[i]})();
  if(d.mode==='path'){
    const diff=sT-d.s;
    if(Math.abs(diff)>8){const sp=Math.min(320,50+Math.abs(diff)*2.2);const step=Math.sign(diff)*Math.min(Math.abs(diff),sp*dt);d.s+=step;d.sp=Math.abs(step)/dt;d.idle=0;const q=VAR[8].pathAt(s,d.s);if(Math.abs(q[0]-d.x)>1)d.face=q[0]>d.x?1:-1;d.x=q[0];d.y=q[1]}
    else{d.idle+=dt;const q=VAR[8].pathAt(s,d.s);d.x=q[0];d.y=q[1]}
    d.pose=d.idle<.01?'walk':(d.idle<2.6?'sniff':'sit');
  }else if(d.mode==='chase'){
    const L=go(c.mx,c.my+18,330,52);d.pose='walk';
    if(L<3&&s.pmv<120){d.mode='pet'}
    if(!c.mIn&&s.away>1.6)d.mode='return';
  }else if(d.mode==='pet'){
    d.pose='sit';if(c.mIn){d.face=c.mx>d.x?1:-1}
    if(c.mIn&&dist(c.mx,c.my+18)>130)d.mode='chase';
    if(!c.mIn&&s.away>1.6)d.mode='return';
  }else if(d.mode==='return'){
    // nearest path point
    let bi=0,bd=1e9;for(let i=0;i<s.px.length;i+=2){const dd=Math.hypot(s.px[i]-d.x,s.py[i]-d.y);if(dd<bd){bd=dd;bi=i}}
    const L=go(s.px[bi],s.py[bi],250,0);d.pose='walk';
    if(L<4){d.s=s.ls[bi];d.mode='path';d.idle=0}
  }else if(d.mode==='fetch'){
    if(!b){d.mode='path'}
    else if(b.state==='fall'){d.pose='walk';d.sp=0;if(Math.abs(b.x1-d.x)>3)d.face=b.x1>d.x?1:-1;}
    else if(b.state==='rest'){const L=go(b.x-d.face*0,b.y+8,340,6);d.pose='walk';if(L<3){b.state='carried';b.carried=true;d.mode='bring';d.home=c.mIn?[c.mx,c.my+18]:VAR[8].pathAt(s,d.s)}}
  }else if(d.mode==='bring'){
    const hx=d.home[0],hy=d.home[1];const tgt=c.mIn?[c.mx,c.my+18]:d.home;
    const L=go(tgt[0],tgt[1],300,56);d.pose='walk';
    if(L<4){if(b){b.state='dropped';b.rest=0;b.carried=false;b.x=d.x+d.face*40*u;b.y=d.y}d.mode='pet';d.petT=0}
  }
  // gait
  const moving=d.sp>20;
  if(moving)d.ph+=dt*(d.sp/22+4);
  d.gait=lerp(d.gait,moving?clamp(d.sp/260,.45,1):0,Math.min(1,dt*10));
  d.pant=d.sp>200||d.pose==='sit';
  // paw prints
  if(moving){s.lastPaw=s.lastPaw||{x:d.x,y:d.y};if(Math.hypot(d.x-s.lastPaw.x,d.y-s.lastPaw.y)>26*u){s.prints.push({x:d.x,y:d.y+1,a:Math.atan2(d.y-s.lastPaw.y,d.x-s.lastPaw.x),t:t,side:s.prints.length%2?1:-1});s.lastPaw={x:d.x,y:d.y};if(s.prints.length>26)s.prints.shift()}}
  const sniffAmt=d.pose==='sniff'?1:0;d.head=lerp(d.head,sniffAmt*.85+(moving?.05*Math.sin(d.ph*2):0)-(d.pose==='sit'?.18:0),Math.min(1,dt*6));
  d.tail=lerp(d.tail,d.pose==='sit'||d.mode==='pet'?1:(moving?.5:.7),Math.min(1,dt*4));
},
draw(c,s){
  const d=s.dog,u=s.u,t=s.t,D=E.day,h=c.h,w=c.w;
  // the trail: a dashed line, plus the walked part in solid
  const px=s.px,py=s.py;
  g.beginPath();g.setLineDash([9,9]);g.moveTo(px[0],py[0]);for(let i=1;i<px.length;i++)g.lineTo(px[i],py[i]);ink(.6,1.8);g.setLineDash([]);
  // landmarks
  const gl=sm(.5,0,D);
  for(const l of s.lm){if(l.y<c.v0-90||l.y>c.v1+40)continue;
    const k=l.kind;
    if(k==='tree')DG.tree(l.x,l.y,l.sz,t);else if(k==='sign')DG.sign(l.x,l.y,l.sz,l.y%3<1?'garden':l.y%3<2?'daboo':'ktm');else if(k==='pond')DG.pond(l.x,l.y,l.sz,t);else if(k==='lamp')DG.lamp(l.x,l.y,l.sz,gl);
    else if(k==='rock')DG.rock(l.x,l.y,l.sz);else if(k==='fence')DG.fence(l.x-30*l.sz,l.y,l.sz);else if(k==='flowers')DG.flowers(l.x,l.y,l.sz,t);else if(k==='chai')DG.chai(l.x,l.y,l.sz,t);
    else if(k==='wheel')DG.wheel(l.x,l.y,l.sz);else if(k==='bench')DG.bench(l.x,l.y,l.sz);else if(k==='mailbox')DG.mailbox(l.x,l.y,l.sz);else DG.hydrant(l.x,l.y,l.sz);
    g.beginPath();g.moveTo(l.x-30*l.sz,l.y+1);g.lineTo(l.x+30*l.sz,l.y+1);ink(.35,1.2);
  }
  // paw prints
  for(const p of s.prints){const age=t-p.t;if(age>7)continue;DG.paw(p.x+Math.sin(p.a)*5*p.side*-1,p.y+Math.cos(p.a)*5*p.side*0,p.a,.6*(1-age/7))}
  // ball
  const b=s.ball;if(b&&b.state!=='carried'){const a=b.state==='dropped'?Math.min(1,(5-b.rest)*1.2):1;g.globalAlpha=a;DG.ball(b.x,b.y,6*u);if(b.state==='fall'){g.beginPath();g.ellipse(b.x1,b.y1+7,7,2,0,0,TAU);ink(.5,1.2)}g.globalAlpha=1}
  // the dog
  if(d.y>c.v0-120&&d.y<c.v1+60){
    const sc=u*(c.phone?1.15:1.45);
    g.save();g.translate(d.x,d.y);g.scale(d.face*sc,sc);
    if(d.pose==='sit')DG.sit(d.head,d.tail,d.pant,t,b&&b.carried);
    else DG.stand(d.ph,d.gait,d.head,d.tail,d.pant&&d.gait>.5,t,b&&b.carried);
    g.restore();
    g.beginPath();g.ellipse(d.x,d.y+1,24*sc*.6,3,0,0,TAU);ink(.25,1.1);
  }
  if(b&&b.state==='carried'){DG.ball(b.x,b.y,6*u)}
}};
