function jpArchiveDate(value){
  const simple = "〇一二三四五六七八九";
  const [y,m,d] = value.split("-").map(Number);
  const num = n => n < 10 ? simple[n] : n === 10 ? "十" :
    n < 20 ? "十" + simple[n-10] :
    simple[Math.floor(n/10)] + "十" + (n%10 ? simple[n%10] : "");
  return String(y).split("").map(x => simple[Number(x)]).join("") + "年 " + num(m) + "月 " + num(d) + "日";
}
function jpDaijiCount(n){
  const d = ["","壱","弐","参","肆","伍","陸","漆","捌","玖"];
  const units = [[10000,"萬"],[1000,"阡"],[100,"陌"],[10,"拾"]];
  n = Math.max(0, Math.floor(Number(n)||0));
  if(n === 0) return "〇曲";

  let value = n;
  let result = "";
  units.forEach(([unit,label]) => {
    const digit = Math.floor(value / unit);
    if(digit > 0){
      result += d[digit] + label;
      value %= unit;
    }
  });
  if(value > 0) result += d[value];
  return result + "曲";
}

let player;
let ready=false;
let currentTime=0;
const $=selector=>document.querySelector(selector);
const date=location.pathname.split("/").filter(Boolean).pop();
const archive=ARCHIVES.find(item=>item.date===date);

const fmt=x=>{
  x=Math.floor(x||0);
  const h=Math.floor(x/3600);
  const m=Math.floor(x%3600/60);
  const s=x%60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
};

if(!archive){
  document.body.innerHTML="<p style='padding:40px;color:white'>Archive not found.</p>";
  throw new Error("Archive not found");
}

$("#dateLabel").textContent=jpArchiveDate(archive.date);

const archiveDateLine=document.createElement("div");
archiveDateLine.className="archiveDetailDateLine";
$("#dateLabel").before(archiveDateLine);
archiveDateLine.appendChild($("#dateLabel"));
if(archive.membersOnly === true){
  const memberBadge=document.createElement("span");
  memberBadge.className="memberBadge";
  memberBadge.textContent="メン限";
  archiveDateLine.appendChild(memberBadge);
}

$("#archiveTitle").textContent=archive.title;
document.title=`${archive.title}｜歌枠らいぶらりゐ`;
$("#meta").textContent=jpDaijiCount(archive.songs.filter(s=>s.type==="song").length);
$("#footDate").textContent=jpArchiveDate(archive.date);

$("#tracks").innerHTML=archive.songs.map(s=>
  `<button class="track" data-t="${s.time}">
    <span class="time">${fmt(s.time)}</span>
    <span class="trackInfo">
      <span class="trackTitle">${s.title}</span>
      ${s.type==="song"&&s.artist?`<span class="trackArtist"> / ${s.artist}</span>`:""}
    </span>
  </button>`
).join("");


document.querySelectorAll(".track").forEach(b=>{
  b.onclick=()=>seek(+b.dataset.t,true);
});

const videoBox=$(".video");
const setlistBox=$(".setlist");

function getArchiveDetailHref(item){
  return `../${item.date}/`;
}

function renderArchivePager(){
  const playerLayout=$(".playerLayout");
  if(!playerLayout || !archive) return;

  const ordered=[...ARCHIVES].sort((a,b)=>a.date.localeCompare(b.date));
  const currentIndex=ordered.findIndex(item=>item.date===archive.date);
  if(currentIndex<0) return;

  const prevArchive=currentIndex>0 ? ordered[currentIndex-1] : null;
  const nextArchive=currentIndex<ordered.length-1 ? ordered[currentIndex+1] : null;
  if(!prevArchive && !nextArchive) return;

  const nav=document.createElement("nav");
  nav.className="archivePager";
  nav.setAttribute("aria-label","前後のアーカイブ");

  const createLink=(label,archiveItem,direction)=>{
    const a=document.createElement("a");
    a.className=`archivePagerLink ${direction}`;
    a.href=getArchiveDetailHref(archiveItem);
    a.innerHTML=`
      <span class="archivePagerLabel">${label}</span>
      <span class="archivePagerTitle">${archiveItem.title}</span>
      <span class="archivePagerDate">${jpArchiveDate(archiveItem.date)}</span>
    `;
    return a;
  };

  if(prevArchive){
    nav.appendChild(createLink("← 前回のアーカイブ", prevArchive, "prev"));
  }
  if(nextArchive){
    nav.appendChild(createLink("次回のアーカイブ →", nextArchive, "next"));
  }

  videoBox?.insertAdjacentElement("afterend", nav);
}

renderArchivePager();

function syncSetlistHeight(){
  if(!videoBox || !setlistBox)return;
  const height=Math.round(videoBox.getBoundingClientRect().height);
  if(height>0){
    setlistBox.style.height=`${height}px`;
    setlistBox.style.maxHeight=`${height}px`;
  }
}

if(videoBox && setlistBox){
  syncSetlistHeight();

  if("ResizeObserver" in window){
    const resizeObserver=new ResizeObserver(syncSetlistHeight);
    resizeObserver.observe(videoBox);
  }else{
    window.addEventListener("resize",syncSetlistHeight,{passive:true});
  }

  window.addEventListener("load",syncSetlistHeight,{once:true});
}

function seek(t,play=false){
  currentTime=t;
  if(!ready)return;
  player.seekTo(t,true);
  if(play)player.playVideo();
  history.replaceState(null,"",`?t=${t}`);
}

function onYouTubeIframeAPIReady(){
  const t=+new URLSearchParams(location.search).get("t")||0;
  currentTime=t;
  player=new YT.Player("player",{
    videoId:archive.videoId,
    playerVars:{rel:0,start:t},
    events:{
      onReady:()=>{
        ready=true;
        if(t)player.seekTo(t,true);
        setInterval(update,1000);
      }
    }
  });
}

function update(){
  if(!ready)return;
  let n=player.getCurrentTime();
  currentTime=n;

  let idx=0;
  archive.songs.forEach((s,i)=>{
    if(n>=s.time)idx=i;
  });

  document.querySelectorAll(".track").forEach((e,i)=>
    e.classList.toggle("active",i===idx)
  );
}

function getYouTubeShareUrl(seconds){
  const base=`https://www.youtube.com/watch?v=${encodeURIComponent(archive.videoId)}`;
  return seconds>0 ? `${base}&t=${seconds}s` : base;
}

async function copyText(text){
  if(navigator.clipboard && window.isSecureContext){
    await navigator.clipboard.writeText(text);
    return true;
  }

  const ta=document.createElement("textarea");
  ta.value=text;
  ta.setAttribute("readonly","");
  ta.style.position="fixed";
  ta.style.opacity="0";
  ta.style.pointerEvents="none";
  document.body.appendChild(ta);
  ta.select();

  let ok=false;
  try{
    ok=document.execCommand("copy");
  }finally{
    ta.remove();
  }

  if(!ok)throw new Error("copy failed");
  return true;
}

let toastTimer;
function showToast(message,type="success"){
  let toast=document.getElementById("toast");

  if(!toast){
    toast=document.createElement("div");
    toast.id="toast";
    toast.className="toast";
    toast.setAttribute("role","status");
    toast.setAttribute("aria-live","polite");
    document.body.appendChild(toast);
  }

  toast.className=`toast ${type}`;
  toast.textContent=message;

  requestAnimationFrame(()=>{
    toast.classList.add("show");
  });

  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{
    toast.classList.remove("show");
  },2600);
}

$("#share").onclick=async()=>{
  const t=ready ? Math.floor(player.getCurrentTime()) : Math.floor(currentTime||0);
  const url=getYouTubeShareUrl(t);

  try{
    await copyText(url);
    showToast(
      t>0
        ? "現在位置のYouTubeリンクをコピーしました。"
        : "YouTubeアーカイブのリンクをコピーしました。"
    );
  }catch{
    showToast("リンクをコピーできませんでした。","error");
  }
};

const youtubeApiScript=document.createElement("script");
youtubeApiScript.src="https://www.youtube.com/iframe_api";
document.head.appendChild(youtubeApiScript);


/* ご案内：各アーカイブページ下部 */
function escapeSocialHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderArchiveSocials(){
  const socials = Array.isArray(window.SITE_CONFIG?.socials)
    ? window.SITE_CONFIG.socials
    : (typeof SITE_CONFIG !== "undefined" && Array.isArray(SITE_CONFIG.socials) ? SITE_CONFIG.socials : []);

  if(!socials.length) return;

  const section = document.createElement("section");
  section.className = "section archiveSocialSection";
  section.id = "socials";
  section.innerHTML = `
    <p class="eyebrow">LINKS</p>
    <h2>ご案内</h2>
    <div class="socialGrid"></div>
  `;

  const grid = section.querySelector(".socialGrid");
  grid.innerHTML = socials.map((item, index) => {
    const label = item.label || `LINK ${index + 1}`;
    const sub = item.sub || "SOCIAL";
    const url = item.url || "";
    const enabled = /^https?:\/\//i.test(url);

    return enabled
      ? `<a class="socialCard" href="${escapeSocialHtml(url)}" target="_blank" rel="noopener noreferrer">
           <strong>${escapeSocialHtml(label)}</strong>
           <small>${escapeSocialHtml(sub)}</small>
           <span class="socialArrow">↗</span>
         </a>`
      : `<div class="socialCard socialCardDisabled" aria-disabled="true">
           <strong>${escapeSocialHtml(label)}</strong>
           <small>${escapeSocialHtml(sub)}</small>
           <span class="socialArrow">URL SETTING</span>
         </div>`;
  }).join("");

  document.querySelector("main")?.appendChild(section);
}

renderArchiveSocials();
