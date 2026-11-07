/* ================= 4 · vine from the garden ================= */
const VN={
  at(s,l){ // point on the stem at arc length l
    const L=s.ls; let lo=0,hi=L.length-1; l=clamp(l,0,L[hi]);
    while(hi-lo>1){const m=(lo+hi)>>1;if(L[m]<l)lo=m;else hi=m}
    const t=(l-L[lo])/((L[hi]-L[lo])||1), i0=lo, i1=hi;
    const x=lerp(s.xs[i0],s.xs[i1],t),y=lerp(s.ys[i0],s.ys[i1],t);
    const tx=s.xs[i1]-s.xs[i0],ty=s.ys[i1]-s.ys[i0],tl=Math.hypot(tx,ty)||1;
    return [x,y,tx/tl,ty/tl];
  },
  leaf(len,open,seed){
    if(open<=.01) return;
    const L=len*open,W=L*.34;
    g.beginPath();g.moveTo(0,0);g.bezierCurveTo(L*.25,-W*1.15,L*.7,-W*.9,L,0);g.bezierCurveTo(L*.7,W*.75,L*.25,W*.95,0,0);fillP();ink(.92,1.7);
    g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(L*.5,-L*.03,L*.96,0);
    for(let i=1;i<=3;i++){const x=L*(.18+i*.2);g.moveTo(x,-L*.02);g.lineTo(x+L*.12,-W*(.75-i*.12));g.moveTo(x,-L*.02);g.lineTo(x+L*.1,W*(.62-i*.1))}
    ink(.5,1.1);
  },
  flower(kind,R,open,seed,t){
    if(open<=.01) return; const o=open;
    if(kind===0){ // daisy
      const n=9;
      for(let i=0;i<n;i++){const a=i*TAU/n+Math.sin(t*.8+seed)*.05;g.save();g.rotate(a);g.beginPath();EL(R*.62*o,0,R*.42*o,R*.17*o+.3,seed+i,.3);fillP();ink(.95,1.6);g.restore()}
      circ(0,0,R*.3*Math.min(1,o*1.5));fillP();ink(.95,1.7);
      g.save();g.beginPath();g.arc(0,0,R*.3*Math.min(1,o*1.5),0,TAU);g.clip();hatch(-R,-R,R,R,3,.7,.6,1);g.restore();
    }else if(kind===1){ // tulip
      const h=R*1.5*o,w=R*.62*o;
      g.beginPath();g.moveTo(-w,-h*.1);g.bezierCurveTo(-w*1.25,-h*.8,-w*.5,-h*1.0,-w*.15,-h*1.15);g.bezierCurveTo(-w*.2,-h*.6,w*.2,-h*.6,w*.15,-h*1.15);g.bezierCurveTo(w*.5,-h*1.0,w*1.25,-h*.8,w,-h*.1);g.bezierCurveTo(w*.6,h*.28,-w*.6,h*.28,-w,-h*.1);fillP();ink(.95,1.7);
      g.beginPath();g.moveTo(0,-h*.95);g.quadraticCurveTo(-w*.45,-h*.5,-w*.1,h*.2);g.moveTo(0,-h*.95);g.quadraticCurveTo(w*.45,-h*.5,w*.1,h*.2);ink(.6,1.2);
    }else if(kind===2){ // marigold: two rings of rounded petals
      for(let r=0;r<2;r++){const n=r?9:12,rr=R*(r?.55:.95)*o;for(let i=0;i<n;i++){const a=i*TAU/n+r*.3;g.beginPath();g.arc(Math.cos(a)*rr*.8,Math.sin(a)*rr*.8,R*(r?.3:.34)*o+.2,0,TAU);fillP();ink(.9-.1*r,1.4)}}
      circ(0,0,R*.22*o);fillS(.75);
    }else{ // bell, facing down
      const w=R*.9*o,h=R*1.2*o;
      g.beginPath();g.moveTo(-w*.25,-h*.6);g.bezierCurveTo(-w*1.0,-h*.5,-w*.9,h*.3,-w*1.15,h*.65);g.quadraticCurveTo(-w*.6,h*.9,-w*.2,h*.65);g.quadraticCurveTo(0,h*.9,w*.2,h*.65);g.quadraticCurveTo(w*.6,h*.9,w*1.15,h*.65);g.bezierCurveTo(w*.9,h*.3,w,-h*.5,w*.25,-h*.6);g.closePath();fillP();ink(.95,1.7);
      g.beginPath();g.moveTo(-w*.35,-h*.3);g.lineTo(-w*.45,h*.55);g.moveTo(w*.35,-h*.3);g.lineTo(w*.45,h*.55);ink(.5,1.1);
      g.beginPath();g.moveTo(0,h*.3);g.lineTo(0,h*1.05);ink(.8,1.3);circ(0,h*1.1,1.8);fillS(.9);
    }
  },
  butterfly(x,y,rot,flap,sz,rest){
    g.save();g.translate(x,y);g.rotate(rot);g.scale(sz,sz);
    const f=rest?.55+.45*Math.cos(flap*.4):Math.abs(Math.cos(flap))*.9+.1;
    for(const sd of [-1,1]){g.save();g.scale(sd*f,1);
      g.beginPath();g.moveTo(0,-1);g.bezierCurveTo(10,-22,28,-12,20,1);g.bezierCurveTo(14,5,6,3,0,2);fillP();ink(.98,1.6);
      g.beginPath();g.moveTo(0,3);g.bezierCurveTo(12,4,19,13,12,20);g.bezierCurveTo(6,22,1,12,0,7);fillP();ink(.98,1.5);
      circ(14,-6,3);ink(.8,1.1);circ(9,13,1.8);ink(.8,1);g.restore()}
    g.beginPath();g.moveTo(0,-7);g.lineTo(0,14);ink(1,2.4);g.beginPath();g.moveTo(0,-7);g.quadraticCurveTo(-3,-14,-7,-14);g.moveTo(0,-7);g.quadraticCurveTo(3,-14,7,-14);ink(.9,1.2);
    g.restore();
  },
  spiral(x,y,r,turns,rot,p){
    g.beginPath();const n=Math.round(14*turns*p)+2;for(let i=0;i<=n;i++){const q=i/(14*turns),a=rot+q*turns*TAU,rr=r*(1-q*.92);const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;if(i)g.lineTo(px,py);else g.moveTo(px,py)}
  }
};
VAR[4]={name:'vine from the garden',short:'vine',
init(c){
  const w=c.w,h=c.h,rg=mulberry(c.seed*11+7),ph=rg()*6;
  const xs=[],ys=[],ls=[]; const A=w*(c.phone?.25:.26),P=c.phone?300:430;
  let acc=0;
  for(let y=h-14;y>=8;y-=5){
    const u=(h-14-y);
    const x=w*.5+A*Math.sin(u/P*TAU+ph)+A*.22*Math.sin(u/P*TAU*2.3+ph*2);
    if(xs.length){acc+=Math.hypot(x-xs[xs.length-1],y-ys[ys.length-1])}
    xs.push(x);ys.push(y);ls.push(acc);
  }
  const total=acc, sp=c.phone?48:60, nodes=[];
  for(let l=34,k=0;l<total-24;l+=sp*(.85+rg()*.3),k++){
    const side=k%2?1:-1; const ty=0;
    nodes.push({l,side,k,len:(c.phone?24:30)+rg()*10,t0:null,fl:(k%4===2)?{kind:Math.floor(rg()*4),R:(c.phone?13:16)+rg()*5,stalk:20+rg()*12,delay:.5+rg()*.5}:null,tend:(k%4===0&&k>0)?true:false,seed:rg()*50});
  }
  const bf={x:w*.5,y:h*.5,vx:0,vy:0,mode:'fly',tgt:null,rest:0,flap:0,rot:0,wait:0,ph:rg()*9};
  const sign=[w*.2+rg()*w*.2,h-8];
  return {xs,ys,ls,total,g:0,nodes,shoots:[],bf,clk:0,still:0,pm:null,grass:Array.from({length:Math.round(w/16)},(_,i)=>({x:8+i*16+rg()*8,hh:8+rg()*12,l:rg()-.5}))};
},
tap(c,s,x,y){
  // side shoot from the nearest grown stem point to the tap
  let best=null,bd=1e9;
  for(let l=0;l<=Math.max(s.g,10);l+=18){const p=VN.at(s,l);const d=Math.hypot(p[0]-x,p[1]-y);if(d<bd){bd=d;best=p}}
  if(!best) return;
  const sx=best[0],sy=best[1];
  const mx=(sx+x)/2+(sy-y)*.18*(x>sx?-1:1),my=(sy+y)/2-26;
  s.shoots.push({x0:sx,y0:sy,cx:mx,cy:my,x1:x,y1:y,t0:s.clk,kind:Math.floor(Math.random()*4),R:15+Math.random()*7,seed:Math.random()*40});
  if(s.shoots.length>14)s.shoots.shift();
  s.bf.mode='to';s.bf.tgt={x:x,y:y-4,wait:s.clk+1.2};
},
update(c,s,dt){
  s.clk+=dt; const clk=s.clk;
  const target=E.reduced?s.total:Math.min(s.total,c.prog*s.total*1.06+30);
  if(target>s.g) s.g=Math.min(target,s.g+Math.max(60,(target-s.g)*2.4)*dt);
  if(E.reduced) s.g=target;
  for(const n of s.nodes) if(n.t0===null&&s.g>=n.l) n.t0=clk;
  // butterfly
  const b=s.bf;
  let pv=0; if(c.mIn&&s.pm) pv=Math.hypot(c.mx-s.pm[0],c.my-s.pm[1])/Math.max(dt,1e-3);
  s.pm=c.mIn?[c.mx,c.my]:null;
  s.still=(c.mIn&&pv<90)?s.still+dt:0;
  b.flap+=dt*(b.mode==='rest'?3:22);
  const near=(x,y,R)=>{let bb=null,bd=R;for(const n of s.nodes){if(!n.fl||n.t0===null)continue;const p=VN.at(s,n.l);const fx=p[0]+n.side*(n.fl.stalk*.7),fy=p[1]-n.fl.stalk*.8;const d=Math.hypot(fx-x,fy-y);if(d<bd&&clk-n.t0>1.4){bd=d;bb={x:fx,y:fy-2}}}
    for(const sh of s.shoots){if(clk-sh.t0>1.6){const d=Math.hypot(sh.x1-x,sh.y1-y);if(d<bd){bd=d;bb={x:sh.x1,y:sh.y1-2}}}}return bb};
  if(b.mode==='rest'){
    if(pv>650&&c.mIn&&Math.hypot(c.mx-b.x,c.my-b.y)<140){b.mode='fly';b.tgt=null;b.vx=(b.x-c.mx)*3;b.vy=-120}
    else if(clk>b.rest&&!c.mIn){b.mode='fly';b.tgt=null}
  }else{
    if(s.still>.5&&c.mIn&&b.mode!=='to'){const f=near(c.mx,c.my,240);b.mode='to';b.tgt=f?{x:f.x,y:f.y,wait:clk+3}:{x:c.mx+10,y:c.my-6,wait:clk+2.5}}
    if(b.mode==='to'&&b.tgt){
      const dx=b.tgt.x-b.x,dy=b.tgt.y-b.y,d=Math.hypot(dx,dy);
      b.vx+=(dx/(d||1)*260-b.vx)*Math.min(1,dt*3.2);b.vy+=(dy/(d||1)*260-b.vy)*Math.min(1,dt*3.2);
      b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(d<5){b.mode='rest';b.rest=b.tgt.wait+2+rnd(clk)*3;b.vx=b.vy=0;b.x=b.tgt.x;b.y=b.tgt.y}
    }else{
      // wander along the vine, with small loops
      if(!b.tgt||Math.hypot(b.tgt.x-b.x,b.tgt.y-b.y)<24||rnd(clk,b.ph)<dt*.15){
        const l=Math.min(s.g,s.total)*rnd(Math.floor(clk/2),b.ph);const p=VN.at(s,l);b.tgt={x:p[0]+(rnd(clk,3)-.5)*140,y:p[1]-30-rnd(clk,4)*70};
        if(rnd(Math.floor(clk/4),b.ph+3)<.35){const f=near(b.x,b.y,500);if(f){b.mode='to';b.tgt={x:f.x,y:f.y,wait:clk+2}}}
      }
      const dx=b.tgt.x-b.x,dy=b.tgt.y-b.y,d=Math.hypot(dx,dy)||1;
      b.vx+=(dx/d*120+Math.sin(clk*7+b.ph)*80-b.vx)*Math.min(1,dt*2);b.vy+=(dy/d*120+Math.cos(clk*5+b.ph)*80-b.vy)*Math.min(1,dt*2);
      b.x+=b.vx*dt;b.y+=b.vy*dt;
    }
    b.x=clamp(b.x,16,c.w-16);b.y=clamp(b.y,10,c.h-16);
  }
  b.rot+=((b.mode==='rest'?0:clamp(b.vx*.004,-.5,.5))-b.rot)*Math.min(1,dt*6);
},
draw(c,s){
  const t=s.clk, w=c.w, h=c.h, wind=clamp(E.sv*.0004,-.25,.25);
  // ground
  g.beginPath();PL([[0,h-12],[w*.2,h-9],[w*.5,h-13],[w*.8,h-8],[w,h-12]],4,1.2);ink(.9,1.9);
  for(const gr of s.grass){g.beginPath();g.moveTo(gr.x,h-10);g.quadraticCurveTo(gr.x+gr.l*6+Math.sin(t*1.6+gr.x)*2+wind*40,h-10-gr.hh*.6,gr.x+gr.l*14+Math.sin(t*1.6+gr.x)*3+wind*60,h-10-gr.hh);ink(.55,1.2)}
  // garden sign
  { const sx=s.xs[0]>w*.5?w*.16:w*.84, sy=h-12;
    g.beginPath();g.moveTo(sx,sy);g.lineTo(sx,sy-34);ink(.9,1.8);
    g.beginPath();PL([[sx-30,sy-52],[sx+30,sy-52],[sx+38,sy-43],[sx+30,sy-34],[sx-30,sy-34]],9,.6,true);fillP();ink(.9,1.7);
    g.font='10px ui-monospace,Menlo,monospace';g.textAlign='center';g.fillStyle=SA(.95);g.fillText('garden',sx-2,sy-40);
    g.beginPath();g.moveTo(sx,sy-26);g.lineTo(sx,sy-18);g.moveTo(sx-3,sy-21);g.lineTo(sx,sy-18);g.lineTo(sx+3,sy-21);ink(.7,1.3);}
  // stem up to g
  const gl=s.g; if(gl<=0) return;
  const ls=s.ls;
  for(let band=0;band<3;band++){
    const wd=[3.6,2.6,1.7][band];
    g.beginPath();let started=false;
    for(let i=0;i<ls.length&&ls[i]<=gl;i++){
      const u=ls[i]/s.total; if(Math.min(2,Math.floor(u*3))!==band){ if(started)break; else continue }
      const sw=Math.sin(t*1.3+ls[i]*.012)*u*3+wind*ls[i]*.05;
      if(!started){const j=Math.max(0,i-1);g.moveTo(s.xs[j]+Math.sin(t*1.3+ls[j]*.012)*(ls[j]/s.total)*3,s.ys[j]);started=true}
      g.lineTo(s.xs[i]+sw,s.ys[i]);
    }
    if(started) ink(.95,wd);
  }
  // tip curl
  { const p=VN.at(s,gl); const sw=Math.sin(t*1.3+gl*.012)*(gl/s.total)*3; VN.spiral(p[0]+sw+p[2]*0,p[1]-6,7,1.7,t*.6,1);ink(.9,1.6); }
  // leaves, tendrils, flowers
  for(const n of s.nodes){
    if(n.t0===null) continue;
    const age=t-n.t0;
    const p=VN.at(s,n.l); if(p[1]<c.v0-80||p[1]>c.v1+80) continue;
    const sw=Math.sin(t*1.3+n.l*.012)*(n.l/s.total)*3;
    const a=Math.atan2(p[3],p[2])+n.side*.95+Math.sin(t*1.2+n.seed)*.07+wind*n.side;
    const op=sm(0,1.1,age);
    g.save();g.translate(p[0]+sw,p[1]);g.rotate(a+(1-op)*n.side*-.5);
    if(n.side<0)g.scale(1,-1);
    VN.leaf(n.len*(c.phone?1:1.15),op,n.seed);
    g.restore();
    if(n.tend){const tp=sm(.3,1.8,age);g.save();g.translate(p[0]+sw,p[1]);const ta=Math.atan2(p[3],p[2])-n.side*1.4;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(Math.cos(ta)*14*tp,Math.sin(ta)*14*tp,Math.cos(ta)*22*tp,Math.sin(ta)*22*tp);ink(.8,1.3);
      VN.spiral(Math.cos(ta)*22*tp+Math.cos(ta+PI/2*n.side)*6,Math.sin(ta)*22*tp+Math.sin(ta+PI/2*n.side)*6,6,1.6,ta+t*.5*0,tp);ink(.8,1.3);g.restore()}
    if(n.fl){
      const fa=sm(.6,1.4,age),open=sm(n.fl.delay+.8,n.fl.delay+2.0,age);
      if(fa>0){
        const L=n.fl.stalk*fa, ang=Math.atan2(p[3],p[2])-n.side*.7, ex=p[0]+sw+Math.cos(ang)*L*.9+n.side*L*.3,ey=p[1]+Math.sin(ang)*L*.9-L*.1;
        g.beginPath();g.moveTo(p[0]+sw,p[1]);g.quadraticCurveTo(p[0]+sw+Math.cos(ang)*L*.5,p[1]+Math.sin(ang)*L*.5,ex,ey);ink(.9,1.5);
        g.save();g.translate(ex,ey);g.rotate(Math.sin(t*1.1+n.seed)*.08+wind);VN.flower(n.fl.kind,n.fl.R*(c.phone?.95:1.2),open,n.seed,t);g.restore();
      }
    }
  }
  // side shoots made by taps
  for(const sh of s.shoots){
    const a=t-sh.t0, gp=sm(0,.8,a); const tt=gp;
    const x=(1-tt)*(1-tt)*sh.x0+2*(1-tt)*tt*sh.cx+tt*tt*sh.x1, y=(1-tt)*(1-tt)*sh.y0+2*(1-tt)*tt*sh.cy+tt*tt*sh.y1;
    g.beginPath();g.moveTo(sh.x0,sh.y0);const m=14;for(let i=1;i<=m;i++){const q=tt*i/m;g.lineTo((1-q)*(1-q)*sh.x0+2*(1-q)*q*sh.cx+q*q*sh.x1,(1-q)*(1-q)*sh.y0+2*(1-q)*q*sh.cy+q*q*sh.y1)}ink(.9,1.5);
    if(a>.5&&a<1.6){const q=tt*.5;const lx=(1-q)*(1-q)*sh.x0+2*(1-q)*q*sh.cx+q*q*sh.x1,ly=(1-q)*(1-q)*sh.y0+2*(1-q)*q*sh.cy+q*q*sh.y1;g.save();g.translate(lx,ly);g.rotate(-.9);VN.leaf(20,sm(.5,1.4,a),1);g.restore()}
    if(a>.7){g.save();g.translate(sh.x1,sh.y1);g.rotate(Math.sin(t*1.1+sh.seed)*.08);VN.flower(sh.kind,sh.R,sm(.8,2.0,a),sh.seed,t);g.restore()}
  }
  // butterfly
  const b=s.bf; VN.butterfly(b.x,b.y,b.rot,b.flap,c.phone?.9:1.15,b.mode==='rest');
}};
