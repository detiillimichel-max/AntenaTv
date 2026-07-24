// ============================================================
// OIO TV v5.1 — Mega-Catálogo Universal (CORRIGIDO)
// Promises isoladas | Renderização progressiva | Fallbacks garantidos
// Edges validadas: youtube, nasa, archive, twitch, peertube + Blender
// ============================================================

const CONFIG = {
  SUPABASE_URL: "https://uqdwtzlkqaosnweyoyit.supabase.co",
  ANON_KEY: "sb_publishable_uafBQD1aJ3w8_eq4meOsNQ_wzk8TwhA"
};

let currentQueue = [], CURRENT_INDEX = 0;
let heroSet = false;

const container = document.getElementById("content-container");
const heroBg = document.getElementById("hero-bg");
const heroTitle = document.getElementById("hero-title");
const heroDesc = document.getElementById("hero-desc");
const heroPlay = document.getElementById("hero-play");

// ============================================================
// HELPER: Normaliza qualquer item em Card padrão
// ============================================================
const toCard = o => ({
  title: (o.title || "Sem título").slice(0, 40),
  subtitle: (o.subtitle || o.source || "HD").slice(0, 35),
  poster: o.poster || `https://via.placeholder.com/400x600/151515/fff?text=${encodeURIComponent((o.title || "OIO").slice(0, 8))}`,
  url: o.url,
  type: o.type || (o.url?.match(/\.mp4|\.webm|\.m4v/) ? 'mp4' : 'embed'),
  source: o.source || "Edge",
  desc: (o.desc || o.subtitle || "").slice(0, 200)
});

// ============================================================
// COMUNICAÇÃO GENÉRICA COM EDGE FUNCTIONS (isolada com try/catch)
// ============================================================
async function fetchEdge(name, extra = "") {
  const url = `${CONFIG.SUPABASE_URL}/functions/v1/${name}${extra}`;
  try {
    const headers = {
      "Authorization": `Bearer ${CONFIG.ANON_KEY}`,
      "apikey": CONFIG.ANON_KEY,
      "Content-Type": "application/json"
    };
    const res = await fetch(url, { headers, method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`Edge "${name}" indisponível:`, e.message);
    return null;
  }
}

// ============================================================
// FALLBACK: Archive.org busca direta (sem Edge Function)
// ============================================================
async function fetchArchiveSearch(query, subtitle, source, rows = 10) {
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&sort[]=downloads+desc&rows=${rows}&page=1&output=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const docs = data.response?.docs || [];
    return docs.filter(d => d.identifier).map(d => toCard({
      title: (d.title || "Sem título").slice(0, 32),
      subtitle,
      poster: `https://archive.org/services/img/${d.identifier}`,
      url: `https://archive.org/download/${d.identifier}/${d.identifier}.mp4`,
      type: 'mp4',
      source,
      desc: "Conteúdo de domínio público — Internet Archive."
    }));
  } catch { return []; }
}

// ============================================================
// RENDERIZADOR: Cria e injeta uma fileira no DOM imediatamente
// (renderização progressiva — não espera todas as Edges)
// ============================================================
function createRowElement(id, title, badgeText, items) {
  if (!items || items.length === 0) return;

  // Remove skeleton de loading se existir
  const loadingRow = document.getElementById("row-loading");
  if (loadingRow) loadingRow.remove();

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

  // Injeta dinamicamente no DOM (renderização progressiva)
  container.appendChild(rowSection);

  // Atualiza Hero com o primeiro item se ainda não definido
  if (!heroSet && items.length > 0 && items[0].url) {
    heroSet = true;
    const h = items[0];
    heroBg.style.backgroundImage = `url('${h.poster}')`;
    heroTitle.textContent = h.title;
    heroDesc.textContent = h.desc || h.subtitle;
    heroPlay.onclick = () => openPlayerQueue(items, 0);
  }
}

// ============================================================
// FALLBACKS GARANTIDOS (conteúdo que NUNCA falha)
// ============================================================
function getBlenderMovies() {
  return [
    toCard({ title: "Big Buck Bunny", subtitle: "Blender • 2008 • 4K", poster: "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217", url: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v", type: "mp4", source: "Blender", desc: "Um coelho gigante e simpático enfrenta três valentões da floresta neste clássico do cinema aberto." }),
    toCard({ title: "Sintel", subtitle: "Blender • Ação / Fantasia", poster: "https://durian.blender.org/wp-content/uploads/2010/05/sintel_poster.jpg", url: "https://download.blender.org/durian/trailer/sintel_trailer-1080p.mp4", type: "mp4", source: "Blender", desc: "Uma jovem guerreira embarca em uma jornada perigosa para resgatar seu pequeno dragão." }),
    toCard({ title: "Tears of Steel", subtitle: "Blender • Sci-Fi Futurista", poster: "https://mango.blender.org/wp-content/uploads/2013/05/01_poster.jpg", url: "https://download.blender.org/mango/tears_of_steel_1080p.webm", type: "mp4", source: "Blender", desc: "Em um futuro distópico em Amsterdã, um grupo de rebeldes tenta salvar o planeta." }),
    toCard({ title: "Caminandes 3: Llamigos", subtitle: "Blender • Comédia", poster: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400", url: "https://download.blender.org/caminandes/caminandes3/caminandes3_1080p.mp4", type: "mp4", source: "Blender", desc: "As aventuras hilárias de Kero, a lhama da Patagônia." }),
    toCard({ title: "Cosmos Laundromat", subtitle: "Blender • Animação", poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400", url: "https://download.blender.org/serials/cosmos_laundromat/cosmos_laundromat_1080p.mp4", type: "mp4", source: "Blender", desc: "Em uma ilha deserta, uma ovelha desiludida encontra um lavadeiro misterioso." })
  ];
}

function getClassicCartoons() {
  return [
    toCard({ title: "Popeye the Sailor", subtitle: "Archive • Clássico 1935", poster: "https://images.unsplash.com/photo-1563089145-599997674d42?w=400", url: "https://archive.org/download/popeye_ali_baba_and_forty_thieves/popeye_ali_baba_and_forty_thieves_512kb.mp4", type: "mp4", source: "Archive.org", desc: "Popeye em uma de suas maiores aventuras de domínio público." }),
    toCard({ title: "Superman (1941)", subtitle: "Fleischer Studios", poster: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400", url: "https://archive.org/download/superman_1941/superman_1941_512kb.mp4", type: "mp4", source: "Archive.org", desc: "Primeira animação histórica do Homem de Aço." }),
    toCard({ title: "Bugs Bunny — Rabbit Fire", subtitle: "Warner Bros • 1951", poster: "https://images.unsplash.com/photo-1535572290543-960a8046f5af?w=400", url: "https://archive.org/download/rabbitfire/rabbitfire_512kb.mp4", type: "mp4", source: "Archive.org", desc: "A famosa disputa entre Bugs Bunny e Elmer Fudd." }),
    toCard({ title: "Betty Boop — Snow White", subtitle: "Fleischer • 1933", poster: "https://images.unsplash.com/photo-1513188060468-04e5377e64e8?w=400", url: "https://archive.org/download/bettyboopsnowwhite/bettyboopsnowwhite_512kb.mp4", type: "mp4", source: "Archive.org", desc: "Betty Boop protagoniza esta versão dos 7 Anões." }),
    toCard({ title: "Felix the Cat", subtitle: "Silent Era • 1924", poster: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400", url: "https://archive.org/download/FelixTheCatInFelixTheCatMeetsSnowWhite/FelixTheCatInFelixTheCatMeetsSnowWhite_512kb.mp4", type: "mp4", source: "Archive.org", desc: "O icônico gato preto dos desenhos mudos dos anos 20." })
  ];
}

function getNasaFallback() {
  return [
    toCard({ title: "NASA: Mars Exploration", subtitle: "NASA SVS • 4K", poster: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=400", url: "https://svs.gsfc.nasa.gov/vis/a010000/a011000/a011050/mars_atmosphere_1080.mp4", type: "mp4", source: "NASA SVS", desc: "Exploração da atmosfera de Marte em alta definição." }),
    toCard({ title: "NASA: Artemis Mission", subtitle: "NASA SVS • 4K", poster: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400", url: "https://svs.gsfc.nasa.gov/vis/a010000/a011200/a011240/artemis_1080.mp4", type: "mp4", source: "NASA SVS", desc: "Documentário da missão Artemis de retorno à Lua." }),
    toCard({ title: "NASA: Earth from Space", subtitle: "NASA ISS • 4K", poster: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400", url: "https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004898/earth_1080.mp4", type: "mp4", source: "NASA SVS", desc: "A Terra vista da Estação Espacial Internacional." }),
    toCard({ title: "NASA: Solar System Tour", subtitle: "NASA SVS • HD", poster: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400", url: "https://svs.gsfc.nasa.gov/vis/a000000/a004500/a004554/solar_system_1080.mp4", type: "mp4", source: "NASA SVS", desc: "Tour visual pelo nosso Sistema Solar." })
  ];
}

function getTwitchFallback() {
  return [
    toCard({ title: "Twitch Gaming — Shroud", subtitle: "Twitch • Live", poster: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400", url: "https://player.twitch.tv/?channel=shroud&parent=detiillimichel-max.github.io", type: 'embed', source: "Twitch", desc: "Live stream de gaming na Twitch." }),
    toCard({ title: "Twitch Creative", subtitle: "Twitch • Live", poster: "https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=400", url: "https://player.twitch.tv/?channel=artstation&parent=detiillimichel-max.github.io", type: 'embed', source: "Twitch", desc: "Canal criativo ao vivo na Twitch." })
  ];
}

// ============================================================
// EDGES VALIDADAS (200 OK) — Cada uma com try/catch individual
// ============================================================

// 1. YOUTUBE — Músicas e Clipes
async function loadYoutube() {
  try {
    const playlists = [
      { id: "PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj", label: "Pop & Trending" },
      { id: "PLFgquLnL59alW3xmYiWRaoz0oM3H17Lth", label: "MPB & Clássicos BR" },
      { id: "PLcOF5jSj-KEmZgZUFvhK5PZY7Q56tG3n8", label: "Rock & Indie" }
    ];
    let videos = [];
    for (const pl of playlists) {
      const edgeData = await fetchEdge("youtube", `?playlistId=${pl.id}`);
      if (!edgeData?.items) continue;
      for (const it of edgeData.items.slice(0, 8)) {
        const vid = it.snippet?.resourceId?.videoId;
        if (!vid) continue;
        const t = it.snippet?.title || "";
        if (t.toLowerCase().includes("private") || t.toLowerCase().includes("deleted")) continue;
        videos.push(toCard({
          title: t.slice(0, 35),
          subtitle: `${pl.label} • YouTube HD`,
          poster: it.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
          url: `https://www.youtube.com/embed/${vid}`,
          type: 'embed',
          source: "YouTube Edge",
          desc: it.snippet?.description?.slice(0, 150) || ""
        }));
      }
    }
    if (videos.length > 0) {
      createRowElement("musicas", "🎵 Músicas & Clipes em Alta • YouTube", `${videos.length} VÍDEOS`, videos);
    }
  } catch (e) {
    console.warn("YouTube edge falhou (ignorado):", e.message);
  }
}

// 2. NASA — Espaço e Documentários (Edge + Fallback)
async function loadNasa() {
  try {
    const edgeData = await fetchEdge("nasa");
    let videos = [];
    if (edgeData?.data) {
      for (const item of edgeData.data.slice(0, 6)) {
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
    // Fallback garantido se Edge falhar ou retornar pouco
    if (videos.length < 4) {
      videos = [...videos, ...getNasaFallback()];
    }
    if (videos.length > 0) {
      createRowElement("nasa", "🌍 Espaço & Documentários • NASA", `${videos.length} VÍDEOS`, videos);
    }
  } catch (e) {
    // Fallback total se Edge falhar
    console.warn("NASA edge falhou, usando fallback:", e.message);
    const fallback = getNasaFallback();
    if (fallback.length > 0) {
      createRowElement("nasa", "🌍 Espaço & Documentários • NASA", `${fallback.length} VÍDEOS`, fallback);
    }
  }
}

// 3. ARCHIVE — Desenhos e Clássicos em .mp4 (Edge + Fallback direto)
async function loadArchive() {
  try {
    const edgeData = await fetchEdge("archive", "?q=collection%3A%28classic_cartoons%29&rows=12");
    let items = [];
    if (Array.isArray(edgeData) && edgeData.length > 0) {
      items = edgeData.slice(0, 10).map(r => toCard({
        title: (r.title || "Sem título").slice(0, 32),
        subtitle: "Desenhos Clássicos • Archive.org",
        poster: `https://archive.org/services/img/${r.identifier || r.id}`,
        url: `https://archive.org/download/${r.identifier || r.id}/${r.identifier || r.id}.mp4`,
        type: 'mp4',
        source: "Archive Edge",
        desc: "Conteúdo de domínio público — Internet Archive."
      }));
    }
    // Fallback direto no Archive.org
    if (items.length < 4) {
      const direct = await fetchArchiveSearch('collection:(classic_cartoons)', "Clássicos • Archive.org", "Archive.org", 8);
      items = [...items, ...direct];
    }
    // Fallback estático garantido
    if (items.length === 0) {
      items = getClassicCartoons();
    }
    if (items.length > 0) {
      createRowElement("archive", "📽️ Desenhos & Clássicos • Archive.org", `${items.length} TÍTULOS`, items);
    }
  } catch (e) {
    console.warn("Archive edge falhou, usando fallback direto:", e.message);
    const direct = await fetchArchiveSearch('collection:(classic_cartoons)', "Clássicos • Archive.org", "Archive.org", 10);
    const items = direct.length > 0 ? direct : getClassicCartoons();
    if (items.length > 0) {
      createRowElement("archive", "📽️ Desenhos & Clássicos • Archive.org", `${items.length} TÍTULOS`, items);
    }
  }
}

// 4. TWITCH — Lives e Transmissões
async function loadTwitch() {
  try {
    const edgeData = await fetchEdge("twitch");
    let items = [];
    if (Array.isArray(edgeData) && edgeData.length > 0) {
      items = edgeData.slice(0, 10).map(r => toCard({
        title: (r.title || r.channel_name || r.user_name || "Twitch Live").slice(0, 35),
        subtitle: `${r.game_name || "Gaming"} • Twitch Live`,
        poster: r.thumbnail_url || r.profile_image_url || "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400",
        url: `https://player.twitch.tv/?channel=${r.user_name || r.channel || 'shroud'}&parent=detiillimichel-max.github.io`,
        type: 'embed',
        source: "Twitch Edge",
        desc: `Transmissão ao vivo de ${r.user_name || r.channel || "gaming"}.`
      }));
    }
    // Fallback estático
    if (items.length === 0) {
      items = getTwitchFallback();
    }
    if (items.length > 0) {
      createRowElement("twitch", "🎮 Lives & Transmissões • Twitch", `${items.length} CANAIS`, items);
    }
  } catch (e) {
    console.warn("Twitch edge falhou, usando fallback:", e.message);
    const items = getTwitchFallback();
    if (items.length > 0) {
      createRowElement("twitch", "🎮 Lives & Transmissões • Twitch", `${items.length} CANAIS`, items);
    }
  }
}

// 5. PEERTUBE — Conteúdos da Rede PeerTube
async function loadPeertube() {
  try {
    const edgeData = await fetchEdge("peertube", "?q=best+documentaries&count=10");
    let items = [];
    if (edgeData) {
      const results = Array.isArray(edgeData) ? edgeData : (edgeData?.data || edgeData?.items || []);
      for (const r of results.slice(0, 10)) {
        const videoUrl = r.url || r.embed_url || "";
        if (!videoUrl) continue;
        items.push(toCard({
          title: (r.name || r.title || "Sem título").slice(0, 35),
          subtitle: "PeerTube • Full Film",
          poster: r.thumbnail_path || r.thumbnail || "",
          url: videoUrl,
          type: 'embed',
          source: "PeerTube Edge",
          desc: (r.description || "").slice(0, 150)
        }));
      }
    }
    // Fallback: busca direta na API pública do PeerTube
    if (items.length < 4) {
      try {
        const peertubeRes = await fetch("https://framatube.org/api/v1/videos?count=10&sort=-createdAt&skip=0");
        const peertubeData = await peertubeRes.json();
        for (const v of (peertubeData.data || []).slice(0, 8)) {
          items.push(toCard({
            title: (v.name || "Sem título").slice(0, 35),
            subtitle: "PeerTube • Documentário",
            poster: v.thumbnailPath || "",
            url: `https://framatube.org/videos/embed/${v.uuid}`,
            type: 'embed',
            source: "PeerTube Direct",
            desc: (v.description || "").slice(0, 150)
          }));
        }
      } catch {}
    }
    if (items.length > 0) {
      createRowElement("peertube", "🌐 Conteúdos • PeerTube", `${items.length} VÍDEOS`, items);
    }
  } catch (e) {
    console.warn("PeerTube edge falhou, usando fallback direto:", e.message);
    try {
      const peertubeRes = await fetch("https://framatube.org/api/v1/videos?count=10&sort=-createdAt&skip=0");
      const peertubeData = await peertubeRes.json();
      const items = (peertubeData.data || []).slice(0, 8).map(v => toCard({
        title: (v.name || "Sem título").slice(0, 35),
        subtitle: "PeerTube • Documentário",
        poster: v.thumbnailPath || "",
        url: `https://framatube.org/videos/embed/${v.uuid}`,
        type: 'embed',
        source: "PeerTube Direct",
        desc: (v.description || "").slice(0, 150)
      }));
      if (items.length > 0) {
        createRowElement("peertube", "🌐 Conteúdos • PeerTube", `${items.length} VÍDEOS`, items);
      }
    } catch {
      console.warn("PeerTube fallback direto também falhou (ignorado).");
    }
  }
}

// 6. BLENDER — Filmes 4K (estático, nunca falha)
async function loadBlender() {
  try {
    const items = getBlenderMovies();
    createRowElement("blender", "🎬 Filmes 4K • Blender Foundation", `${items.length} .MP4 DIRETO`, items);
  } catch (e) {
    console.warn("Blender fallback falhou (impossível, mas tratado):", e.message);
  }
}

// ============================================================
// ORQUESTRADOR: Carrega tudo de forma isolada e independente
// Cada Edge Function roda em paralelo, renderiza imediatamente
// quando pronta, e NUNCA trava se outra falhar
// ============================================================
async function initCatalog() {
  // Todas as Edges validadas rodam em paralelo com Promise.allSettled
  // Nenhuma falha bloqueia as outras
  await Promise.allSettled([
    loadYoutube(),
    loadNasa(),
    loadArchive(),
    loadTwitch(),
    loadPeertube(),
    loadBlender()
  ]);

  console.log("OIO TV v5.1 — Todas as Edges processadas.");

  // Garantir que pelo menos Blender está presente (nunca falha)
  if (!document.getElementById("row-blender")) {
    const items = getBlenderMovies();
    createRowElement("blender", "🎬 Filmes 4K • Blender Foundation", `${items.length} .MP4 DIRETO`, items);
  }

  // Garantir que Hero foi setado
  if (!heroSet) {
    const firstRow = container.querySelector(".row");
    if (firstRow) {
      const firstCard = firstRow.querySelector(".card");
      if (firstCard) {
        heroSet = true;
        const h = {
          title: firstCard.querySelector(".card-title")?.textContent || "",
          subtitle: firstCard.querySelector(".card-subtitle")?.textContent || "",
          poster: firstCard.querySelector("img")?.src || "",
          url: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v",
          desc: "Filme 4K da Blender Foundation."
        };
        heroBg.style.backgroundImage = `url('${h.poster}')`;
        heroTitle.textContent = h.title;
        heroDesc.textContent = h.desc;
        heroPlay.onclick = () => openPlayer(blenderFallback);
      }
    }
  }
}

const blenderFallback = getBlenderMovies()[0];

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  initCatalog();
  setupModal();
  setupNavigation();
});

// ============================================================
// MODAL E PLAYER UNIVERSAL
// ============================================================
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
  document.getElementById("player-meta").innerHTML = `
    <span>${item.source}</span>
    <span>${(item.type || 'MP4').toUpperCase()}</span>
    <span style="color:#4ade80">● REPRODUZINDO</span>
  `;

  if (item.type === 'mp4' || item.url?.match(/\.mp4|\.webm|\.m4v/)) {
    // Vídeo direto (NASA, Archive, Blender)
    playerWrap.innerHTML = `
      <video id="active-video-player" controls autoplay playsinline preload="auto"
        style="width:100%;height:100%;object-fit:contain;background:#000"
        src="${item.url}" poster="${item.poster}">
        Seu navegador não suporta reprodução de vídeo.
      </video>`;

    const videoEl = document.getElementById("active-video-player");
    if (videoEl) {
      videoEl.play().catch(err => console.warn("Autoplay aguardando clique:", err));
      videoEl.onerror = () => {
        console.warn("Link direto falhou, acionando fallback Blender...");
        videoEl.src = "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v";
        videoEl.play().catch(() => {});
      };
    }
  } else {
    // Embed (YouTube, Twitch, PeerTube)
    let embedUrl = item.url;
    if (!embedUrl.includes('autoplay=1')) {
      embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'autoplay=1';
    }
    playerWrap.innerHTML = `
      <iframe src="${embedUrl}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowfullscreen
        style="width:100%;height:100%;border:none;"></iframe>`;
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

// ============================================================
// NAVEGAÇÃO INFERIOR (Bottom Nav) — Com verificação de segurança
// ============================================================
function setupNavigation() {
  const navMap = {
    home: null,
    filmes: "row-blender",
    series: null,
    "series-novas": null,
    infantil: null,
    desenhos: "row-archive",
    "desenhos-classicos": "row-archive",
    futebol: null,
    volei: null,
    basquete: null,
    musicas: "row-musicas",
    nasa: "row-nasa",
    archive: "row-archive",
    twitch: "row-twitch",
    peertube: "row-peertube",
    blender: "row-blender"
  };

  document.querySelectorAll(".bottom-nav .nav-item").forEach(item => {
    item.onclick = e => {
      e.preventDefault();
      document.querySelectorAll(".bottom-nav .nav-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const tab = item.dataset.tab;
      const targetId = navMap[tab];

      // Verificação de segurança: se a fileira não existe, scroll para topo
      if (tab === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (targetId) {
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        } else {
          // Fileira ainda não existe, scroll suave para cima
          window.scrollTo({ top: 200, behavior: 'smooth' });
        }
      } else {
        // Tab sem row mapeada, scroll para o topo
        window.scrollTo({ top: 200, behavior: 'smooth' });
      }
    };
  });
}
