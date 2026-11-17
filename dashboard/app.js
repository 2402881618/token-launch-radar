// Token Radar dashboard: renders window.RADAR (written by main.ts) with no network at all.
// State lives in the URL hash, so a board, a filter or a detail view is a link: #tab=board&q=&cat=&chain=&sort=implied&p=slug
// The sandbox re-ranks the board with the same model functions main.ts uses; Reset returns the published board.
(function(){
"use strict";
var D=window.RADAR;
if(!D){document.body.innerHTML="<p style='padding:20px'>No radar data. Run main.ts first.</p>";return;}
var rows=D.rows, live=D.live, aside=D.set_aside;
var state={tab:"board",q:"",cat:"",chain:"",sort:"implied",p:null};
var sandbox={gw:0.5,mf:0.55,on:false};
var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
function usd(n){if(n==null)return "—";if(n>=1e9)return "$"+(n/1e9).toFixed(2)+"B";if(n>=1e6)return "$"+(n/1e6).toFixed(1)+"M";if(n>=1e3)return "$"+(n/1e3).toFixed(1)+"K";return "$"+Math.round(n)}
function pct(n){if(n==null)return "—";return (n>0?"+":"")+n.toFixed(1)+"%"}
function age(n){if(n==null)return "—";if(n<365)return n+"d";return (n/365).toFixed(1)+"y"}
function cls(n){return n==null?"":n>0?"pos":n<0?"neg":""}
function clamp(v,a,b){return Math.min(b,Math.max(a,v))}

/* ---- the model, the same functions main.ts uses (lib/model.ts) ---- */
function growthMult(g,gw){var p=clamp(g==null?0:g,-60,120);return 1+(p/100)*gw}
function maturityMult(a,mf){var age=(a==null?365:a);var f=Math.min(Math.max(age,0),1095)/1095;return mf+(1-mf)*Math.sqrt(f)}
function impliedOf(r){return Math.max(1,Math.round(r.tvl_usd*r.category_multiple*growthMult(r.change_7d,sandbox.gw)*maturityMult(r.age_days,sandbox.mf)))}

/* ---- farm plans: the same generator as lib/model.ts, from the row's own record ---- */
function gasUsd(c){c=(c||"").toLowerCase();if(c==="ethereum")return 8;if(c==="solana")return 1;if(c==="bitcoin")return 2;if(c==="arbitrum"||c==="optimism"||c==="base")return 1;if(c==="polygon")return 1;if(c==="avalanche"||c==="bnb"||c==="binance"||c==="bsc")return 1;if(c.indexOf("hyperliquid")>=0)return 1;return 2}
function capitalFor(t){if(t>=5e9)return 500;if(t>=1e9)return 250;if(t>=1e8)return 100;return 50}
function holdFor(a){if(a==null)return 30;if(a<180)return 60;if(a<365)return 45;return 30}
function actionFor(r,cap,ch){var c=(r.category||"").toLowerCase(),n=r.name;
 if(c.indexOf("lend")>=0||c.indexOf("cdp")>=0||c.indexOf("collateral")>=0)return "Supply $"+cap+" of USDC to "+n+" on "+ch+" and keep the position open.";
 if(c.indexOf("dex")>=0||c.indexOf("yield")>=0||c.indexOf("leveraged farm")>=0)return "Provide $"+cap+" of liquidity to "+n+"'s main pool on "+ch+" and keep the position open.";
 if(c.indexOf("bridge")>=0)return "Bridge $"+cap+" of USDC to "+ch+" through "+n+" and use the bridged funds in its app.";
 if(c.indexOf("staking")>=0||c.indexOf("restak")>=0)return "Stake $"+cap+" of the chain's staking asset through "+n+" and keep the receipt.";
 if(c.indexOf("perpetual")>=0||c.indexOf("derivative")>=0||c.indexOf("options")>=0)return "Deposit $"+cap+" of USDC as margin on "+n+" and open one small hedge.";
 if(c.indexOf("prediction")>=0)return "Fund $"+cap+" and place one market position on "+n+".";
 if(c.indexOf("curator")>=0||c.indexOf("allocator")>=0||c.indexOf("onchain capital")>=0)return "Deposit $"+cap+" into a "+n+" vault on "+ch+" and keep the shares.";
 if(c.indexOf("stable")>=0)return "Mint or deposit $"+cap+" of the stable asset through "+n+" on "+ch+".";
 if(c.indexOf("rwa")>=0)return "Mint $"+cap+" of the protocol's yield asset on "+ch+" and hold it.";
 if(c.indexOf("insurance")>=0)return "Buy $"+cap+" of cover from "+n+" on "+ch+" and keep the policy.";
 if(c.indexOf("index")>=0)return "Buy $"+cap+" of the "+n+" index on "+ch+" and hold the shares.";
 if(c.indexOf("basis")>=0)return "Deposit $"+cap+" of USDC into "+n+"'s basis position on "+ch+" and keep it open.";
 if(c.indexOf("privacy")>=0)return "Deposit $"+cap+" of USDC into "+n+"'s private pool on "+ch+" and keep the position open.";
 return "Deposit $"+cap+" of USDC into "+n+" on "+ch+" and keep the position open.";}
function farmSteps(r){var ch=r.chains[0]||"its main chain",ch2=r.chains[1]||null,cap=capitalFor(r.tvl_usd),hold=holdFor(r.age_days),gas=gasUsd(ch),g=r.change_7d==null?0:r.change_7d;
 var mom=g>=20?" TVL rose "+g.toFixed(1)+"% in seven days, so activity is rising: keep the position through the next snapshot.":g<=-20?" TVL fell "+Math.abs(g).toFixed(1)+"% in seven days, so size the position small and check the pool again before adding.":"";
 var s=[
  ["Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.","about $"+gas+" of gas on "+ch+" for the first transaction","5 minutes"],
  [actionFor(r,cap,ch),"$"+cap+" of capital and about $"+gas+" of gas","15 minutes to set up"],
  ["Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote."+mom,"about $"+gas+" of gas a week","10 minutes a week"],
  ["Hold the position for at least "+hold+" days so the activity is counted in more than one snapshot.","the $"+cap+" stays in the position",hold+" days"],
  [ch2?"Repeat the same action once on "+ch2+" with $"+Math.floor(cap/2)+", so the position spans two chains.":"Open a second, smaller position of $"+Math.floor(cap/2)+" in the same pool a week later, to show repeat use.","$"+Math.floor(cap/2)+" of capital and about $"+gasUsd(ch2||ch)+" of gas","15 minutes"],
  ["Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.","no fee to check, and never pay to claim","10 minutes"],
  ["Write the wallet, the dates and every transaction in a farm log, and unwind by withdrawing in two halves a week apart.","about $"+(gas*2)+" of gas to exit","5 minutes to log, a week to unwind"]
 ];
 return s.map(function(x){return {text:x[0],cost:x[1],time:x[2]}});}

/* ---- state ---- */
function readHash(){var h=location.hash.replace(/^#/,"");h.split("&").forEach(function(p){var kv=p.split("=");if(kv.length!==2)return;var k=decodeURIComponent(kv[0]),v=decodeURIComponent(kv[1]);if(k in state)state[k]=v;});if(state.tab!=="board"&&state.tab!=="live"&&state.tab!=="aside"&&state.tab!=="model")state.tab="board";}
function writeHash(){var p=[];["tab","q","cat","chain","sort","p"].forEach(function(k){if(state[k])p.push(encodeURIComponent(k)+"="+encodeURIComponent(state[k]))});history.replaceState(null,"","#"+p.join("&"));}
function filtered(){var q=state.q.toLowerCase();return rows.filter(function(r){
 if(state.cat&&r.category!==state.cat)return false;
 if(state.chain&&r.chains.indexOf(state.chain)<0)return false;
 if(q&&(r.name.toLowerCase().indexOf(q)<0&&r.slug.toLowerCase().indexOf(q)<0))return false;
 return true;});}
function sorted(list){var l=list.slice();var key=state.sort;
 if(sandbox.on){l.forEach(function(r){r._imp=impliedOf(r)});l.sort(function(a,b){return b._imp-a._imp||a.slug<b.slug?-1:1});return l;}
 if(key==="tvl")l.sort(function(a,b){return b.tvl_usd-a.tvl_usd});
 else if(key==="growth")l.sort(function(a,b){return (b.change_7d||0)-(a.change_7d||0)});
 else if(key==="age")l.sort(function(a,b){return (b.age_days==null?365:b.age_days)-(a.age_days==null?365:a.age_days)});
 else if(key==="name")l.sort(function(a,b){return a.name<b.name?-1:1});
 else l.sort(function(a,b){return a.rank-b.rank});
 return l;}

/* ---- render ---- */
function renderStats(){$("asof").textContent="Snapshot "+D.as_of;$("src").textContent=D.source;$("mver").textContent=D.model_version;
 $("nBoard").textContent=D.board_size;$("nLive").textContent=D.live_size;$("nAside").textContent=D.set_aside_size;
 $("stats").innerHTML=[
  ["40 / 40","watchlist covered"],[""+D.board_size,"protocols ranked"],[""+D.early_size,"early, off the watchlist"],[""+D.above_floor_off_watchlist,"above the floor, off the watchlist"],[""+D.set_aside_size,"set aside, not launches"]
 ].map(function(s){return '<div class="stat"><b>'+s[0]+'</b><span>'+s[1]+'</span></div>'}).join("");}
function renderBoard(){var list=sorted(filtered());var top=list.length?list[0].implied_value_usd:1;
 $("count").textContent=list.length+" of "+rows.length+" shown"+(sandbox.on?" · sandbox model":"");
 $("rows").innerHTML=list.map(function(r){var imp=sandbox.on?r._imp:r.implied_value_usd;var w=Math.max(4,Math.round(imp/top*100));
  var ch=r.chains.slice(0,3).join(", ")+(r.chains.length>3?" +"+(r.chains.length-3):"");
  return '<tr data-slug="'+esc(r.slug)+'"><td class="mono">'+(sandbox.on?"–":r.rank)+'</td><td class="name"><b>'+esc(r.name)+(isWatch(r.slug)?' <span class="badge">watchlist</span>':"")+'</b><small>'+esc(r.category||"")+' · '+esc(ch)+'</small></td><td class="mono num">'+usd(r.tvl_usd)+'</td><td class="mono num '+cls(r.change_7d)+'">'+pct(r.change_7d)+'</td><td class="mono num">'+age(r.age_days)+'</td><td class="mono num">'+r.category_multiple.toFixed(3)+'</td><td class="mono num"><span class="bar"><i style="width:'+w+'%"></i></span>'+usd(imp)+'</td></tr>'}).join("");
 document.querySelectorAll("#rows tr").forEach(function(tr){tr.addEventListener("click",function(){openDetail(tr.getAttribute("data-slug"))})});}
var watchSet=null;
function isWatch(slug){if(!watchSet){watchSet={};(D.watchlist||[]).forEach(function(s){watchSet[s]=true;});}return !!watchSet[slug];}
function shortChains(ch){return ch.slice(0,3).join(", ")+(ch.length>3?" +"+(ch.length-3):"");}
function renderLive(){$("liveRows").innerHTML=live.map(function(r,i){var ratio=r.mcap_usd&&r.tvl_usd?r.mcap_usd/r.tvl_usd:null;
 return '<tr><td class="mono">'+(i+1)+'</td><td class="name"><b>'+esc(r.name)+'</b><small>'+esc(r.category||"")+' · '+esc(shortChains(r.chains))+'</small></td><td class="mono num">'+usd(r.tvl_usd)+'</td><td class="mono num">'+usd(r.mcap_usd)+'</td><td class="mono num">'+(ratio==null?"—":ratio.toFixed(3))+'</td><td class="mono num '+cls(r.change_7d)+'">'+pct(r.change_7d)+'</td></tr>'}).join("");}
function renderAside(){$("asideRows").innerHTML=aside.map(function(r){return '<tr><td class="name"><b>'+esc(r.name)+'</b><small>'+esc(r.category||"")+' · '+esc(shortChains(r.chains))+'</small></td><td class="mono num">'+usd(r.tvl_usd)+'</td><td style="white-space:normal">'+esc(r.reason)+'</td></tr>'}).join("");}
function renderCal(){$("calRows").innerHTML=D.calibration.by_category.map(function(c){return '<tr><td>'+esc(c.category)+'</td><td class="mono num">'+c.peers+'</td><td class="mono num">'+(c.median_ratio==null?"no live peer":"×"+c.median_ratio.toFixed(3))+'</td><td class="mono num">×'+c.multiple.toFixed(3)+'</td></tr>'}).join("");}
function openDetail(slug){var r=null;rows.forEach(function(x){if(x.slug===slug)r=x});if(!r)return;
 state.p=slug;writeHash();
 var imp=sandbox.on?impliedOf(r):r.implied_value_usd;
 var gm=growthMult(r.change_7d,sandbox.gw),mm=maturityMult(r.age_days,sandbox.mf);
 var why=(isWatch(slug)?"On the snapshot's watchlist: TVL of "+usd(r.tvl_usd)+" is above the $50M floor, and it records no token. ":"Not on the snapshot's watchlist: TVL of "+usd(r.tvl_usd)+" is "+(r.tvl_usd>=D.floor_usd?"above":"below")+" the $50M floor, and it records no token, so the radar ranks it as a launch to come. ")+"Its category's multiple is ×"+r.category_multiple.toFixed(3)+", from the live-token peers in that category.";
 $("detailBody").innerHTML='<h2>'+esc(r.name)+'</h2><div class="sub">'+esc(r.category||"")+' · '+esc(r.chains.join(", "))+' · listed '+esc(r.listed_at||"unknown")+'</div>'
 +'<div class="kv"><div><span>Implied value</span><b>'+usd(imp)+'</b></div><div><span>Rank</span><b>#'+(sandbox.on?"— (sandbox)":r.rank)+'</b></div><div><span>TVL</span><b>'+usd(r.tvl_usd)+'</b></div><div><span>7-day change</span><b class="'+cls(r.change_7d)+'">'+pct(r.change_7d)+'</b></div><div><span>Category multiple</span><b>×'+r.category_multiple.toFixed(3)+'</b></div><div><span>Growth × maturity</span><b>×'+gm.toFixed(2)+' × '+mm.toFixed(2)+'</b></div></div>'
 +'<p class="why">'+esc(why)+'</p>'
 +'<h3>Farm plan — seven steps</h3><ol class="steps">'+farmSteps(r).map(function(s,i){return '<li><b>'+(i+1)+'.</b> '+esc(s.text)+'<span class="ct">Cost: '+esc(s.cost)+' · Time: '+esc(s.time)+'</span></li>'}).join("")+'</ol>'
 +'<p class="note">Implied value is the model’s read of the snapshot, not a price. The protocol records no token here; that is not proof it has none.</p>';
 $("detail").hidden=false;}
function closeDetail(){state.p=null;writeHash();$("detail").hidden=true;}
function renderTabs(){["board","live","aside","model"].forEach(function(t){$("view"+t.charAt(0).toUpperCase()+t.slice(1)).hidden=state.tab!==t;});
 document.querySelectorAll("#tabs button").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-tab")===state.tab)});
 $("controls").style.display=(state.tab==="board")?"":"none";
 if(state.tab==="board")renderBoard();if(state.tab==="live")renderLive();if(state.tab==="aside")renderAside();if(state.tab==="model")renderCal();}
function fillFilters(){var cats={},chs={};rows.forEach(function(r){if(r.category)cats[r.category]=1;r.chains.forEach(function(c){chs[c]=1})});
 Object.keys(cats).sort().forEach(function(c){var o=document.createElement("option");o.value=c;o.textContent=c;$("cat").appendChild(o)});
 Object.keys(chs).sort().forEach(function(c){var o=document.createElement("option");o.value=c;o.textContent=c;$("chain").appendChild(o)});}
function syncControls(){$("q").value=state.q;$("cat").value=state.cat;$("chain").value=state.chain;$("sort").value=state.sort;}
function renderAll(){renderStats();renderTabs();syncControls();if(state.p)openDetail(state.p);}

/* ---- events ---- */
document.querySelectorAll("#tabs button").forEach(function(b){b.addEventListener("click",function(){state.tab=b.getAttribute("data-tab");writeHash();renderTabs();});});
$("q").addEventListener("input",function(){state.q=this.value;writeHash();renderBoard();});
$("cat").addEventListener("change",function(){state.cat=this.value;writeHash();renderBoard();});
$("chain").addEventListener("change",function(){state.chain=this.value;writeHash();renderBoard();});
$("sort").addEventListener("change",function(){state.sort=this.value;writeHash();renderBoard();});
$("closeDetail").addEventListener("click",closeDetail);
document.querySelectorAll("#board th").forEach(function(th){th.addEventListener("click",function(){var k=th.getAttribute("data-k");if(k==="rank")state.sort="implied";else if(k==="name")state.sort="name";else if(k==="tvl")state.sort="tvl";else if(k==="growth")state.sort="growth";else if(k==="age")state.sort="age";else if(k==="implied")state.sort="implied";syncControls();writeHash();renderBoard();});});
function sandboxOn(){$("gwVal").textContent=(+sandbox.gw).toFixed(2);$("mfVal").textContent=(+sandbox.mf).toFixed(2);
 sandbox.on=!(sandbox.gw===0.5&&sandbox.mf===0.55);
 $("sandboxNote").textContent=sandbox.on?"Showing the sandbox model — the published board returns with Reset.":"Showing the published board.";
 if(state.tab==="board")renderBoard();if(state.p)openDetail(state.p);}
$("gw").addEventListener("input",function(){sandbox.gw=+this.value;sandboxOn();});
$("mf").addEventListener("input",function(){sandbox.mf=+this.value;sandboxOn();});
$("reset").addEventListener("click",function(){sandbox.gw=0.5;sandbox.mf=0.55;$("gw").value="0.5";$("mf").value="0.55";sandboxOn();});

readHash();fillFilters();renderAll();
})();
