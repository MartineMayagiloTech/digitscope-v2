const $=id=>document.getElementById(id);
const WS="wss://api.derivws.com/trading/v1/options/ws/public";
const S={ws:null,ticks:[],bt:[],results:[],runs:JSON.parse(localStorage.getItem("ds2-runs")||"[]"),journal:JSON.parse(localStorage.getItem("ds2-journal")||"[]"),lastKey:""};
function digit(q){const s=String(q).replace(/[^0-9]/g,"");return Number(s.at(-1))}
function count(ds){const c=Array(10).fill(0);ds.forEach(d=>c[d]++);return c}
function ent(c,n){return n?-c.reduce((a,x)=>x?a+(x/n)*Math.log2(x/n):a,0):0}
function streak(ds){if(!ds.length)return{d:null,n:0,long:0};let n=1;for(let i=1;i<ds.length&&ds[i]===ds[0];i++)n++;let run=1,long=1;for(let i=1;i<ds.length;i++){run=ds[i]===ds[i-1]?run+1:1;long=Math.max(long,run)}return{d:ds[0],n,long}}
function analyze(ds){const n=ds.length;if(n<30)return null;const c=count(ds),r=ds.slice(0,Math.min(50,n)),rc=count(r),st=streak(ds);const score=c.map((x,d)=>.55*x/n+.30*rc[d]/r.length+(r.includes(d)?(r.length-1-r.indexOf(d))/(r.length*8):0)-(st.d===d?Math.min(.15,st.n*.02):0));const ma=score.indexOf(Math.max(...score)),di=score.indexOf(Math.min(...score)),e=ent(c,n),bal=Math.max(0,100-Math.round((Math.max(...c)-Math.min(...c))/n*1000));return{c,ma,di,ms:Math.max(0,Math.min(99,Math.round(50+(score[ma]-.1)*300))),ds:Math.max(0,Math.min(99,Math.round(50+(.1-score[di])*300))),mf:c[ma]/n,df:c[di]/n,e,bal,q:Math.max(0,Math.min(100,Math.round((100-Math.abs(3.321928-e)*28)*.65+bal*.35))),st}}function decision(a, threshold){

    if(!a) return null;

    if(a.ms >= threshold && a.ms > a.ds){

        return{
            action:"BUY MATCHES",
            digit:a.ma,
            confidence:a.ms,
            color:"green"
        };

    }

    if(a.ds >= threshold && a.ds > a.ms){

        return{
            action:"BUY DIFFERS",
            digit:a.di,
            confidence:a.ds,
            color:"red"
        };

    }

    return{

        action:"WAIT",

        digit:"-",

        confidence:0,

        color:"gray"

    };

}
function status(on,t){$("liveStatus").textContent="● "+t;$("liveStatus").className="status "+(on?"online":"offline");$("connectBtn").disabled=on;$("disconnectBtn").disabled=!on}
function badge(el,s,t){el.textContent=s>=t?"QUALIFIED":"WAIT";el.className="badge "+(s>=t?"good":s>=t-5?"warn":"neutral")}
function bars(c,n){const m=Math.max(...c,1);$("digitBars").innerHTML=c.map((x,d)=>`<div class="bar-wrap"><span class="bar-pct">${n?(x/n*100).toFixed(1):0}%</span><div class="bar" style="height:${Math.max(3,x/m*135)}px"></div><span class="bar-label">${d}</span></div>`).join("")}
function journal(){ $("journalBody").innerHTML=S.journal.length?S.journal.slice(0,60).map(x=>`<tr><td>${new Date(x.t).toLocaleTimeString()}</td><td>${x.type}</td><td>${x.d}</td><td>${x.s}%</td><td>${x.q}%</td></tr>`).join(""):'<tr><td colspan="5" class="empty">No qualified signals yet.</td></tr>'}
function live(){const n=+$("liveWindow").value,ds=S.ticks.slice(0,n).map(x=>x.d),a=analyze(ds);$("liveSample").textContent=ds.length;$("distributionLabel").textContent=ds.length+" ticks";$("latestQuote").textContent=S.ticks[0]?.q||"—";$("latestDigit").textContent=S.ticks[0]?.d??"—";$("tickClock").textContent=S.ticks[0]?new Date(S.ticks[0].t*1000).toLocaleTimeString():"—";bars(a?.c||Array(10).fill(0),ds.length);$("recentDigits").innerHTML=ds.slice(0,120).map((d,i)=>`<span class="digit-pill ${i?"":"latest"}">${d}</span>`).join("")||'<span class="empty">Waiting…</span>';journal();if(!a)return;let hot=a.c.indexOf(Math.max(...a.c)),cold=a.c.indexOf(Math.min(...a.c));$("matchDigit").textContent=a.ma;$("diffDigit").textContent=a.di;$("matchScore").textContent=a.ms+"%";$("diffScore").textContent=a.ds+"%";$("matchFreq").textContent=(a.mf*100).toFixed(1)+"%";$("diffFreq").textContent=(a.df*100).toFixed(1)+"%";$("matchStreak").textContent=a.st.d===a.ma?a.st.n:0;$("diffStreak").textContent=a.st.d===a.di?a.st.n:0;$("hotDigit").textContent=hot+" ("+a.c[hot]+")";$("coldDigit").textContent=cold+" ("+a.c[cold]+")";$("entropy").textContent=a.e.toFixed(3);$("balance").textContent=a.bal+"%";$("latestStreak").textContent=a.st.d+" × "+a.st.n;$("longestStreak").textContent=a.st.long;$("liveQuality").textContent=a.q+"%";const th=+$("signalThreshold").value;const d = decision(a, th);

if (d) {

    $("signalAction").textContent = d.action;

    $("signalDigit").textContent = d.digit;

    $("signalConfidence").textContent =
        d.confidence + "%";

}badge($("matchBadge"),a.ms,th);badge($("diffBadge"),a.ds,th);if(a.q>=th){const k=Math.floor(Date.now()/60000)+"-"+a.ma+"-"+a.di;if(k!==S.lastKey){S.lastKey=k;S.journal.unshift({t:Date.now(),type:"MATCH",d:a.ma,s:a.ms,q:a.q},{t:Date.now(),type:"DIFFERS",d:a.di,s:a.ds,q:a.q});S.journal=S.journal.slice(0,100);localStorage.setItem("ds2-journal",JSON.stringify(S.journal));journal()}}}
function connect(){disconnect();status(false,"Connecting…");S.ws=new WebSocket(WS);S.ws.onopen=()=>{status(true,"Live");S.ws.send(JSON.stringify({ticks:$("symbol").value,subscribe:1,req_id:1}))};S.ws.onmessage=e=>{try{const x=JSON.parse(e.data);if(x.msg_type==="tick"){S.ticks.unshift({q:x.tick.quote,d:digit(x.tick.quote),t:x.tick.epoch});if(S.ticks.length>1000)S.ticks.pop();live()}}catch(_){}};S.ws.onerror=()=>status(false,"Error");S.ws.onclose=()=>status(false,"Offline")}
function disconnect(){if(S.ws)try{S.ws.close()}catch(_){}S.ws=null;status(false,"Offline")}
function loadBT(){const ws=new WebSocket(WS);$("loadHistoryBtn").disabled=true;$("btStatus").textContent="Loading historical ticks…";ws.onopen=()=>ws.send(JSON.stringify({ticks_history:$("btSymbol").value,count:+$("btCount").value,end:"latest",style:"ticks",req_id:7}));ws.onmessage=e=>{const x=JSON.parse(e.data);if(x.msg_type==="history"){S.bt=(x.history.prices||[]).map((q,i)=>({q,d:digit(q),t:(x.history.times||[])[i]}));$("btStatus").textContent=`Loaded ${S.bt.length.toLocaleString()} ticks. Ready.`;$("runBacktestBtn").disabled=false;$("loadHistoryBtn").disabled=false;ws.close()}};ws.onerror=()=>{$("btStatus").textContent="Could not load historical data.";$("loadHistoryBtn").disabled=false}}
function runBT(){const ds=S.bt.map(x=>x.d),w=+$("btWindow").value,th=+$("btThreshold").value,type=$("btType").value,stake=+$("btStake").value||1;if(ds.length<=w+1)return;let r=[],eq=0,wins=0,loss=0,lossrun=0,maxloss=0;for(let i=ds.length-w-1;i>=0;i--){const a=analyze(ds.slice(i+1,i+1+w));if(!a)continue;const arr=[];if(type==="both"||type==="match")arr.push({type:"MATCH",d:a.ma,s:a.ms});if(type==="both"||type==="differs")arr.push({type:"DIFFERS",d:a.di,s:a.ds});arr.filter(x=>x.s>=th).forEach(x=>{const win=x.type==="MATCH"?ds[i]===x.d:ds[i]!==x.d;win?(wins++,eq+=stake,lossrun=0):(loss++,eq-=stake,lossrun++,maxloss=Math.max(maxloss,lossrun));r.push({type:x.type,d:x.d,s:x.s,actual:ds[i],win,eq})})}S.results=r;const n=r.length,rate=n?wins/n*100:0,run={date:Date.now(),market:$("btSymbol").value,type,window:w,threshold:th,signals:n,wins,losses:loss,rate,pnl:eq,maxLoss:maxloss};S.runs.unshift(run);S.runs=S.runs.slice(0,50);localStorage.setItem("ds2-runs",JSON.stringify(S.runs));$("btSignals").textContent=n;$("btWins").textContent=wins;$("btLosses").textContent=loss;$("btWinRate").textContent=rate.toFixed(2)+"%";$("btPnl").textContent=(eq>=0?"+":"")+eq.toFixed(2);$("btMaxLoss").textContent=maxloss;$("btStatus").textContent=`Backtest complete: ${n} qualified signals.`;$("equityLabel").textContent=rate.toFixed(2)+"% win rate";renderBT();draw(r.map(x=>x.eq));perf()}
function renderBT(){$("btBody").innerHTML=S.results.length?S.results.slice(0,500).map((x,i)=>`<tr><td>${i+1}</td><td>${x.type}</td><td>${x.d}</td><td>${x.s}%</td><td>${x.actual}</td><td>${x.win?"WIN":"LOSS"}</td><td>${x.eq.toFixed(2)}</td></tr>`).join(""):'<tr><td colspan="7" class="empty">No results.</td></tr>'}
function draw(v){const c=$("equityCanvas"),x=c.getContext("2d"),w=c.width,h=c.height;x.clearRect(0,0,w,h);if(!v.length)return;const mn=Math.min(0,...v),mx=Math.max(0,...v),rg=mx-mn||1;x.strokeStyle="#4da3ff";x.lineWidth=3;x.beginPath();v.forEach((z,i)=>{const px=10+i*(w-20)/Math.max(1,v.length-1),py=h-10-(z-mn)/rg*(h-20);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()}
function perf(){const p=S.runs,n=p.reduce((a,x)=>a+x.signals,0),w=p.reduce((a,x)=>a+x.wins,0),rate=n?w/n*100:0;$("perfRuns").textContent=p.length;$("perfSignals").textContent=n;$("perfWins").textContent=w;$("perfRate").textContent=n?rate.toFixed(2)+"%":"—";$("perfBest").textContent=p.length?Math.max(...p.map(x=>x.rate)).toFixed(2)+"%":"—";$("perfWorst").textContent=p.length?Math.min(...p.map(x=>x.rate)).toFixed(2)+"%":"—";const z=p[0];$("perfMarket").textContent=z?.market||"—";$("perfType").textContent=z?.type||"—";$("perfThreshold").textContent=z?z.threshold+"%":"—";$("perfLatestSignals").textContent=z?.signals??"—";$("perfLatestRate").textContent=z?z.rate.toFixed(2)+"%":"—";$("riskReview").textContent=z?`Latest run: ${z.signals} signals, ${z.rate.toFixed(2)}% win rate, maximum losing streak ${z.maxLoss}. A high losing streak or small sample size is a warning. Model P/L is simplified.`:"Run a backtest to generate a risk review.";$("runsBody").innerHTML=p.length?p.map(x=>`<tr><td>${new Date(x.date).toLocaleString()}</td><td>${x.market}</td><td>${x.type}</td><td>${x.window}</td><td>${x.threshold}%</td><td>${x.signals}</td><td>${x.rate.toFixed(2)}%</td><td>${x.pnl>=0?"+":""}${x.pnl.toFixed(2)}</td></tr>`).join(""):'<tr><td colspan="8" class="empty">No saved runs.</td></tr>'}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".tab-panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab).classList.add("active")});
$("connectBtn").onclick=connect;$("disconnectBtn").onclick=disconnect;$("symbol").onchange=()=>S.ws&&connect();$("liveWindow").onchange=live;$("signalThreshold").onchange=live;$("clearLiveBtn").onclick=()=>{S.ticks=[];live()};$("clearJournalBtn").onclick=()=>{S.journal=[];localStorage.removeItem("ds2-journal");journal()};$("loadHistoryBtn").onclick=loadBT;$("runBacktestBtn").onclick=runBT;$("clearBtBtn").onclick=()=>{S.results=[];renderBT()};$("resetPerfBtn").onclick=()=>{if(confirm("Reset saved results?")){S.runs=[];localStorage.removeItem("ds2-runs");perf()}};$("themeBtn").onclick=()=>document.documentElement.classList.toggle("light");live();perf();
