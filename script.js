// OIO TV v3.0 BEAUTIFUL - Layout da sua print + Edges Reais + APIs Públicas
const CONFIG = {
  SUPABASE_URL: "https://uqdwtzlkqaosnweyoyit.supabase.co",
  ANON_KEY: "sb_publishable_uafBQD1aJ3w8_eq4meOsNQ_wzk8TwhA"
};

let PLAY_QUEUE=[], CURRENT_INDEX=0;

const toCard = o => ({
  title: (o.title||"Sem titulo").slice(0,38),
  subtitle: (o.subtitle||o.source||"HD").slice(0,32),
  poster: o.poster || `https://via.placeholder.com/400x600/151515/fff?text=${encodeURIComponent((o.title||"OIO").slice(0,8))}`,
  url: o.url,
  type: o.type || (o.url?.match(/\.mp4|\.webm|\.m4v/) ? 'mp4' : 'embed'),
  source: o.source||"Edge",
  desc: (o.desc||o.subtitle||"").slice(0,180),
  raw: o
});

async function fetchEdge(name, extra=""){
  const url = `${CONFIG.SUPABASE_URL}/functions/v1/${name}${extra}`;
  try{
    const headers = {"Authorization":`Bearer ${CONFIG.ANON_KEY}`,"apikey":CONFIG.ANON_KEY,"Content-Type":"application/json"};
    const method = (name==='vapid'||name==='gemini'||name==='groq') ? 'POST' : 'GET';
    let body = undefined;
    if(name==='vapid') body = JSON.stringify({subscription:{}});
    if(name==='gemini'||name==='groq') body = JSON.stringify({message:"Olá"});

    const res = await fetch(url, {headers, method, body});
    if(!res.ok) throw new Error(res.status);
    return await res.json();
  }catch(e){
    console.warn(`Edge ${name} falhou:`, e);
    return null;
  }
}

// Parser NASA Edge + Public API
async function getNasaContent(){
  let videos=[];
  // 1. Tenta Edge NASA
  const edgeData = await fetchEdge("nasa");
  if(edgeData?.data){
    for(const item of edgeData.data.slice(0,6)){
      const href = item.href;
      if(href && href.includes('collection.json')){
        try{
          const colRes = await fetch(href);
          const col = await colRes.json();
          const mp4 = col.find(u=>u.includes('~orig.mp4')) || col.find(u=>u.endsWith('.mp4')) || col[0];
          if(mp4){
            let poster = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400";
            try{
              const thumb = href.replace('collection.json','').replace('video/','thumb/') + 'thumb.jpg';
              poster = thumb;
            }catch{}
            videos.push(toCard({
              title: (item.data?.[0]?.title || item.title || "NASA Video").slice(0,32),
              subtitle: "NASA • 4K",
              poster,
              url: mp4,
              source: "NASA SVS",
              desc: "Vídeo real NASA extraído via Edge NASA - .mp4 direto"
            }));
          }
        }catch{}
      }
    }
  }
  // 2. Fallback API Pública NASA
  if(videos.length<5){
    try{
      const res = await fetch("https://images-api.nasa.gov/search?q=black%20hole&media_type=video");
      const data = await res.json();
      for(const it of (data.collection?.items||[]).slice(0, 6-videos.length)){
        const nasa_id = it.data?.[0]?.nasa_id;
        if(!nasa_id) continue;
        try{
          const assetRes = await fetch(`https://images-api.nasa.gov/asset/${nasa_id}`);
          const assetData = await assetRes.json();
          const mp4 = (assetData.collection?.items||[]).find(u=>u.href.includes('~orig.mp4')) || (assetData.collection?.items||[]).find(u=>u.href.endsWith('.mp4'));
          if(mp4?.href){
            videos.push(toCard({
              title: (it.data[0].title||"NASA").slice(0,32),
              subtitle: "NASA • 4K",
              poster: it.links?.[0]?.href || "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400",
              url: mp4.href,
              source: "NASA SVS",
              desc: "Vídeo real NASA API pública - .mp4 direto"
            }));
          }
        }catch{}
      }
    }catch{}
  }
  return videos;
}

async function getYoutubeContent(){
  let videos=[];
  const edgeData = await fetchEdge("youtube", "?playlistId=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj");
  if(edgeData?.items){
    for(const it of edgeData.items.slice(0,8)){
      const vid = it.snippet?.resourceId?.videoId;
      if(!vid) continue;
      const t = it.snippet?.title||"";
      if(t.toLowerCase().includes("private")||t.toLowerCase().includes("deleted")) continue;
      videos.push(toCard({
        title: t.slice(0,35),
        subtitle: "YouTube • TED",
        poster: it.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        url: `https://www.youtube.com/embed/${vid}`,
        type: 'embed',
        source: "YouTube Edge",
        desc: it.snippet?.description?.slice(0,120)||""
      }));
    }
  }
  // Fallback público Blender (Big Buck Bunny e Sintel)
  if(videos.length<3){
    videos = videos.concat([
      toCard({title:"Big Buck Bunny",subtitle:"Blender • 2008 • 4K",poster:"https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217",url:"https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v",source:"Blender",desc:"Open movie Blender"}),
      toCard({title:"Sintel",subtitle:"Blender • 2010 • HD",poster:"https://durian.blender.org/wp-content/uploads/2010/05/sintel_poster.jpg",url:"https://download.blender.org/durian/trailer/sintel_trailer-1080p.mp4",source:"Blender",desc:"Open movie"}),
    ]);
  }
  return videos;
}

async function getArchiveAndPeerTube(){
  let videos=[];
  const ptData = await fetchEdge("peertube");
  if(ptData?.data){
    for(const v of ptData.data.slice(0,3)){
      videos.push(toCard({
        title: (v.name||`PeerTube ${v.id}`).slice(0,30),
        subtitle: "PeerTube • Edge",
        poster: v.thumbnailPath ? `https://framatube.org${v.thumbnailPath}` : "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400",
        url: `https://framatube.org/videos/embed/${v.uuid||v.shortUUID}`,
        type: 'embed',
        source: "PeerTube Edge",
        desc: v.uuid||""
      }));
    }
  }
  videos = videos.concat([
    toCard({title:"Tears of Steel",subtitle:"Blender • Sci-Fi • 4K",poster:"https://mango.blender.org/wp-content/uploads/2013/05/01_poster.jpg",url:"https://download.blender.org/mango/tears_of_steel_1080p.webm",source:"Blender",desc:"Sci-fi"}),
    toCard({title:"Caminandes",subtitle:"Blender • Curta",poster:"https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400",url:"https://download.blender.org/caminandes/caminandes3/caminandes3_1080p.mp4",source:"Blender",desc:"Curta"})
  ]);
  return videos.slice(0,5);
}

document.addEventListener("DOMContentLoaded", async ()=>{
  const heroBg = document.getElementById("hero-bg");
  const heroTitle = document.getElementById("hero-title");
  const heroDesc = document.getElementById("hero-desc");
  const status = document.getElementById("hero-status");
  const countNasa = document.getElementById("row-count-nasa");

  const [nasaVideos, youtubeVideos, archiveVideos] = await Promise.all([
    getNasaContent(),
    getYoutubeContent(),
    getArchiveAndPeerTube()
  ]);

  const heroItem = youtubeVideos[0] || nasaVideos[0];
  if(heroItem){
    heroBg.style.backgroundImage = `url('${heroItem.poster}')`;
    heroTitle.textContent = heroItem.title;
    heroDesc.textContent = heroItem.desc || heroItem.subtitle;
    document.getElementById("hero-play").onclick = () => openPlayerQueue([heroItem],0);
  }

  const combinedNasa = [...nasaVideos, ...youtubeVideos.filter(v=>v.source.includes("YouTube")).slice(0,3)];
  const finalNasa = combinedNasa.slice(0,11);
  if(countNasa) countNasa.textContent = `${finalNasa.length} • .MP4 DIRETO`;
  if(status) status.textContent = `● ${finalNasa.length} • .MP4 DIRETO • EDGES REAIS`;
  
  renderCards("cards-nasa", finalNasa);
  renderCards("cards-youtube", youtubeVideos.slice(0,5));
  renderCards("cards-archive", archiveVideos);

  setupModal(); setupNavigation();
});

function renderCards(containerId, items){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.innerHTML="";
  items.forEach((it,i)=>{
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`<div class="card-img-wrap"><img src="${it.poster}" alt="${it.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x600/151515/fff?text=${encodeURIComponent(it.title.slice(0,8))}'"></div><div class="card-body"><div class="card-title">${it.title}</div><div class="card-subtitle">${it.subtitle}</div><span class="card-badge">${it.source}</span></div>`;
    card.onclick=()=>openPlayerQueue(items, i);
    container.appendChild(card);
  });
}

function openPlayerQueue(q,s){currentQueue=q;CURRENT_INDEX=s;openPlayer(currentQueue[CURRENT_INDEX]);}

function openPlayer(item){
  if(!item) return;
  const modal = document.getElementById("player-modal");
  const container = document.getElementById("player-container");
  
  document.getElementById("modal-titleinnerText" in document.getElementById("modal-title") ? "modal-title" : "modal-title").innerText = item.title;
  document.getElementById("modal-desc").innerText = item.desc || item.subtitle;
  document.getElementById("player-meta").innerHTML = `<span>${item.source}</span><span>${(item.type||'MP4').toUpperCase()}</span><span style="color:#4ade80">● REPRODUZINDO</span>`;
  
  if(item.type === 'mp4' || item.url.match(/\.mp4|\.webm|\.m4v/)){
    container.innerHTML = `
      <video id="active-video-player" controls autoplay playsinline preload="auto" style="width:100%;height:100%;object-fit:contain;background:#000" src="${item.url}" poster="${item.poster}">
        Seu navegador não suporta reprodução de vídeo.
      </video>`;
    
    const videoEl = document.getElementById("active-video-player");
    if(videoEl){
      videoEl.play().catch(err => {
        console.warn("Autoplay bloqueado pelo navegador, aguardando interação:", err);
      });
      videoEl.onerror = () => {
        console.error("Erro ao carregar o vídeo direto, tentando fallback Blender...");
        videoEl.src = "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v";
        videoEl.play().catch(() => {});
      };
    }
  } else {
    // Para embeds (YouTube, PeerTube)
    let embedUrl = item.url;
    if(!embedUrl.includes('autoplay=1')){
      embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'autoplay=1';
    }
    container.innerHTML = `<iframe src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  }
  
  modal.classList.remove("hidden");
}

function setupModal(){
  const modal = document.getElementById("player-modal");
  const btnClose = document.getElementById("modal-close");
  btnClose.onclick = () => {
    modal.classList.add("hidden");
    document.getElementById("player-container").innerHTML = "";
  };
  modal.onclick = e => {
    if(e.target === modal) btnClose.click();
  };
}

function setupNavigation(){
  document.querySelectorAll(".bottom-nav .nav-item").forEach(item=>{
    item.onclick=e=>{
     e.preventDefault();
     document.querySelectorAll(".bottom-nav .nav-item").forEach(i=>i.classList.remove("active"));
     item.classList.add("active");
     if(item.dataset.tab==='series') document.getElementById("row-nasa").scrollIntoView({behavior:'smooth'});
     if(item.dataset.tab==='filmes') document.getElementById("row-youtube").scrollIntoView({behavior:'smooth'});
     if(item.dataset.tab==='infantil') document.getElementById("row-archive").scrollIntoView({behavior:'smooth'});
    };
  });
}
  
