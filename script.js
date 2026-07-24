// OIO TV v3.1 MULTI-CATALOG - Catálogo Expandido + Múltiplas Fontes Públicas
const CONFIG = {
  SUPABASE_URL: "https://uqdwtzlkqaosnweyoyit.supabase.co",
  ANON_KEY: "sb_publishable_uafBQD1aJ3w8_eq4meOsNQ_wzk8TwhA"
};

let currentQueue = [], CURRENT_INDEX = 0;

const toCard = o => ({
  title: (o.title || "Sem título").slice(0, 38),
  subtitle: (o.subtitle || o.source || "HD").slice(0, 32),
  poster: o.poster || `https://via.placeholder.com/400x600/151515/fff?text=${encodeURIComponent((o.title || "OIO").slice(0, 8))}`,
  url: o.url,
  type: o.type || (o.url?.match(/\.mp4|\.webm|\.m4v/) ? 'mp4' : 'embed'),
  source: o.source || "Edge",
  desc: (o.desc || o.subtitle || "").slice(0, 180)
});

// Comunicação Genérica com Edge Functions
async function fetchEdge(name, extra = "") {
  const url = `${CONFIG.SUPABASE_URL}/functions/v1/${name}${extra}`;
  try {
    const headers = { "Authorization": `Bearer ${CONFIG.ANON_KEY}`, "apikey": CONFIG.ANON_KEY, "Content-Type": "application/json" };
    const method = (name === 'vapid' || name === 'gemini' || name === 'groq') ? 'POST' : 'GET';
    let body = undefined;
    if (name === 'vapid') body = JSON.stringify({ subscription: {} });
    if (name === 'gemini' || name === 'groq') body = JSON.stringify({ message: "Olá" });

    const res = await fetch(url, { headers, method, body });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.warn(`Edge ${name} não respondeu ou indisponível:`, e);
    return null;
  }
}

// 1. CONTEÚDO MUSICAL & YOUTUBE
async function getMusicAndTrending() {
  let videos = [];
  const edgeData = await fetchEdge("youtube", "?playlistId=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj");
  if (edgeData?.items) {
    for (const it of edgeData.items.slice(0, 10)) {
      const vid = it.snippet?.resourceId?.videoId;
      if (!vid) continue;
      const t = it.snippet?.title || "";
      if (t.toLowerCase().includes("private") || t.toLowerCase().includes("deleted")) continue;
      videos.push(toCard({
        title: t.slice(0, 35),
        subtitle: "Música & Pop • High Quality",
        poster: it.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        url: `https://www.youtube.com/embed/${vid}`,
        type: 'embed',
        source: "YouTube Edge",
        desc: it.snippet?.description?.slice(0, 120) || ""
      }));
    }
  }
  return videos;
}

// 2. CONTEÚDO NASA & ESPAÇO
async function getNasaCollection() {
  let videos = [];
  // Tenta Edge NASA
  const edgeData = await fetchEdge("nasa");
  if (edgeData?.data) {
    for (const item of edgeData.data.slice(0, 5)) {
      const href = item.href;
      if (href && href.includes('collection.json')) {
        try {
          const colRes = await fetch(href);
          const col = await colRes.json();
          const mp4 = col.find(u => u.includes('~orig.mp4')) || col.find(u => u.endsWith('.mp4')) || col[0];
          if (mp4) {
            videos.push(toCard({
              title: (item.data?.[0]?.title || item.title || "NASA Video").slice(0, 32),
              subtitle: "NASA SVS • 4K Space",
              poster: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400",
              url: mp4,
              type: 'mp4',
              source: "NASA Edge",
              desc: "Documentário científico direto dos servidores da NASA."
            }));
          }
        } catch {}
      }
    }
  }
  // API Pública NASA Fallback
  if (videos.length < 5) {
    try {
      const res = await fetch("https://images-api.nasa.gov/search?q=mars&media_type=video");
      const data = await res.json();
      for (const it of (data.collection?.items || []).slice(0, 5 - videos.length)) {
        const nasa_id = it.data?.[0]?.nasa_id;
        if (!nasa_id) continue;
        try {
          const assetRes = await fetch(`https://images-api.nasa.gov/asset/${nasa_id}`);
          const assetData = await assetRes.json();
          const mp4 = (assetData.collection?.items || []).find(u => u.href.includes('~orig.mp4')) || (assetData.collection?.items || []).find(u => u.href.endsWith('.mp4'));
          if (mp4?.href) {
            videos.push(toCard({
              title: (it.data[0].title || "Exploração NASA").slice(0, 32),
              subtitle: "Planeta Marte • 4K",
              poster: it.links?.[0]?.href || "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=400",
              url: mp4.href,
              type: 'mp4',
              source: "NASA SVS",
              desc: "Imagens e dados de exploração espacial."
            }));
          }
        } catch {}
      }
    } catch {}
  }
  return videos;
}

// 3. FILMES E CURTAS BLENDER (OPEN MOVIES)
function getBlenderMovies() {
  return [
    toCard({ title: "Big Buck Bunny", subtitle: "Blender • 2008 • 4K", poster: "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217", url: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v", type: "mp4", source: "Blender", desc: "Um coelho gigante e simpático enfrenta três valentões da floresta neste clássico do cinema aberto." }),
    toCard({ title: "Sintel", subtitle: "Blender • Ação / Fantasia", poster: "https://durian.blender.org/wp-content/uploads/2010/05/sintel_poster.jpg", url: "https://download.blender.org/durian/trailer/sintel_trailer-1080p.mp4", type: "mp4", source: "Blender", desc: "Uma jovem guerreira embarca em uma jornada perigosa para resgatar seu pequeno dragão." }),
    toCard({ title: "Tears of Steel", subtitle: "Blender • Sci-Fi Futurista", poster: "https://mango.blender.org/wp-content/uploads/2013/05/01_poster.jpg", url: "https://download.blender.org/mango/tears_of_steel_1080p.webm", type: "mp4", source: "Blender", desc: "Em um futuro distópico em Amsterdã, um grupo de rebeldes tenta salvar o planeta de robôs destruidores." }),
    toCard({ title: "Caminandes 3: Llamigos", subtitle: "Blender • Comédia Infantil", poster: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400", url: "https://download.blender.org/caminandes/caminandes3/caminandes3_1080p.mp4", type: "mp4", source: "Blender", desc: "As aventuras hilárias de Kero, a lhama da Patagônia, enfrentando situações inusitadas." }),
    toCard({ title: "Cosmos Laundromat", subtitle: "Blender • Animação Sci-Fi", poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400", url: "https://download.blender.org/serials/cosmos_laundromat/cosmos_laundromat_1080p.mp4", type: "mp4", source: "Blender", desc: "Em uma ilha deserta, uma ovelha desiludida encontra um lavadeiro misterioso que oferece a viagem da sua vida." })
  ];
}

// 4. DESENHOS CLÁSSICOS (ARCHIVE.ORG)
async function getClassicsAndCartoons() {
  let cartoens = [];
  try {
    const res = await fetch("https://archive.org/advancedsearch.php?q=collection:(classic_cartoons)&fl[]=identifier,title&sort[]=&rows=6&page=1&output=json");
    const data = await res.json();
    const docs = data.response?.docs || [];
    for (const d of docs) {
      if (d.identifier) {
        cartoens.push(toCard({
          title: (d.title || "Animação Clássica").slice(0, 32),
          subtitle: "Domínio Público • Anos 40",
          poster: `https://archive.org/services/img/${d.identifier}`,
          url: `https://archive.org/download/${d.identifier}/${d.identifier}.mp4`,
          type: 'mp4',
          source: "Archive.org",
          desc: "Desenho animado clássico restaurado da era de ouro da animação."
        }));
      }
    }
  } catch {}

  // Se a busca falhar, garante conteúdo de qualidade
  if (cartoens.length === 0) {
    cartoens = [
      toCard({ title: "Popeye the Sailor", subtitle: "Archive • Clássico", poster: "https://images.unsplash.com/photo-1563089145-599997674d42?w=400", url: "https://archive.org/download/popeye_ali_baba_and_forty_thieves/popeye_ali_baba_and_forty_thieves_512kb.mp4", type: "mp4", source: "Archive.org", desc: "Popeye em uma de suas maiores aventuras de domínio público." }),
      toCard({ title: "Superman (1941)", subtitle: "Fleischer Studios", poster: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400", url: "https://archive.org/download/superman_1941/superman_1941_512kb.mp4", type: "mp4", source: "Archive.org", desc: "Primeira animação histórica do Homem de Aço produzida pelos estúdios Fleischer." })
    ];
  }
  return cartoens;
}

// RENDERIZADOR DINÂMICO DE FILEIRAS
function createRowElement(id, title, badgeText, items) {
  if (!items || items.length === 0) return;

  const rowSection = document.createElement("div");
  rowSection.className = "row";
  rowSection.id = `row-${id}`;

  rowSection.innerHTML = `
    <div class="row-header">
      <h2>${title}</h2>
      <span class="row-count">${badgeText}</span>
    </div>
    <div class="row-cards" id="cards-${id}"></div>
  `;

  const cardsContainer = rowSection.querySelector(`#cards-${id}`);
  items.forEach((it, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${it.poster}" alt="${it.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x600/151515/fff?text=${encodeURIComponent(it.title.slice(0, 8))}'">
      </div>
      <div class="card-body">
        <div class="card-title">${it.title}</div>
        <div class="card-subtitle">${it.subtitle}</div>
        <span class="card-badge">${it.source}</span>
      </div>
    `;
    card.onclick = () => openPlayerQueue(items, index);
    cardsContainer.appendChild(card);
  });

  return rowSection;
}

// INICIALIZAÇÃO DA APLICAÇÃO
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("content-container");

  // Carrega todas as coleções em paralelo para carregar ultra rápido
  const [musicList, nasaList, blenderList, cartoonList] = await Promise.all([
    getMusicAndTrending(),
    getNasaCollection(),
    Promise.resolve(getBlenderMovies()),
    getClassicsAndCartoons()
  ]);

  // Limpa o esqueleto de carregamento inicial
  container.innerHTML = "";

  // 1. Configura Destaque Principal (Hero)
  const heroItem = musicList[0] || blenderList[0];
  if (heroItem) {
    document.getElementById("hero-bg").style.backgroundImage = `url('${heroItem.poster}')`;
    document.getElementById("hero-title").textContent = heroItem.title;
    document.getElementById("hero-desc").textContent = heroItem.desc || heroItem.subtitle;
    document.getElementById("hero-play").onclick = () => openPlayerQueue([heroItem], 0);
  }

  // 2. Injeta as Fileiras Dinâmicas no Catálogo
  if (musicList.length > 0) {
    container.appendChild(createRowElement("musicas", "Músicas & Clipes em Alta • YouTube Edge", `${musicList.length} VÍDEOS`, musicList));
  }
  
  if (blenderList.length > 0) {
    container.appendChild(createRowElement("filmes", "Filmes & Animações 4K • Blender Foundation", `${blenderList.length} .MP4 DIRETO`, blenderList));
  }

  if (nasaList.length > 0) {
    container.appendChild(createRowElement("nasa", "Séries & Documentários • NASA Space Edge", `${nasaList.length} .MP4 DIRETO`, nasaList));
  }

  if (cartoonList.length > 0) {
    container.appendChild(createRowElement("desenhos", "Desenhos & Clássicos • Archive.org", `${cartoonList.length} CLÁSSICOS`, cartoonList));
  }

  setupModal();
  setupNavigation();
});

// MODAL E PLAYER UNIVERSAL
function openPlayerQueue(queue, startIndex) {
  currentQueue = queue;
  CURRENT_INDEX = startIndex;
  openPlayer(currentQueue[CURRENT_INDEX]);
}

function openPlayer(item) {
  if (!item) return;
  const modal = document.getElementById("player-modal");
  const playerWrap = document.getElementById("player-container");

  document.getElementById("modal-title").innerText = item.title;
  document.getElementById("modal-desc").innerText = item.desc || item.subtitle;
  document.getElementById("player-meta").innerHTML = `<span>${item.source}</span><span>${(item.type || 'MP4').toUpperCase()}</span><span style="color:#4ade80">● REPRODUZINDO</span>`;

  if (item.type === 'mp4' || item.url.match(/\.mp4|\.webm|\.m4v/)) {
    playerWrap.innerHTML = `
      <video id="active-video-player" controls autoplay playsinline preload="auto" style="width:100%;height:100%;object-fit:contain;background:#000" src="${item.url}" poster="${item.poster}">
        Seu navegador não suporta reprodução de vídeo.
      </video>`;

    const videoEl = document.getElementById("active-video-player");
    if (videoEl) {
      videoEl.play().catch(err => console.warn("Autoplay aguardando clique:", err));
      videoEl.onerror = () => {
        console.warn("Link de vídeo direto falhou, acionando fallback de segurança...");
        videoEl.src = "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v";
        videoEl.play().catch(() => {});
      };
    }
  } else {
    let embedUrl = item.url;
    if (!embedUrl.includes('autoplay=1')) {
      embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'autoplay=1';
    }
    playerWrap.innerHTML = `<iframe src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen style="width:100%;height:100%;border:none;"></iframe>`;
  }

  modal.classList.remove("hidden");
}

function setupModal() {
  const modal = document.getElementById("player-modal");
  const btnClose = document.getElementById("modal-close");
  btnClose.onclick = () => {
    modal.classList.add("hidden");
    document.getElementById("player-container").innerHTML = "";
  };
  modal.onclick = e => {
    if (e.target === modal) btnClose.click();
  };
}

function setupNavigation() {
  document.querySelectorAll(".bottom-nav .nav-item").forEach(item => {
    item.onclick = e => {
      e.preventDefault();
      document.querySelectorAll(".bottom-nav .nav-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const tab = item.dataset.tab;
      if (tab === 'filmes') document.getElementById("row-filmes")?.scrollIntoView({ behavior: 'smooth' });
      if (tab === 'series') document.getElementById("row-nasa")?.scrollIntoView({ behavior: 'smooth' });
      if (tab === 'infantil') document.getElementById("row-desenhos")?.scrollIntoView({ behavior: 'smooth' });
      if (tab === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });
}

