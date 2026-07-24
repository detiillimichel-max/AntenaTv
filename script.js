// ============================================================
// OIO TV v5.0 — MEGA-CATÁLOGO UNIVERSAL
// Consume 6 Edge Functions do Supabase:
//   YouTube | TMDB | Facebook | Internet Archive | PeerTube | Dailymotion
// Categorias: Filmes, Lançamentos, Clássicos, Ação, Comédia, Romance,
//             Documentários, Séries, Séries Novas, Infantil, Desenhos,
//             Desenhos Clássicos, Esportes (Futebol, Vôlei, Basquete)
// ============================================================

const CONFIG = {
  SUPABASE_URL: "https://uqdwtzlkqaosnweyoyit.supabase.co",
  ANON_KEY: "sb_publishable_uafBQD1aJ3w8_eq4meOsNQ_wzk8TwhA"
};

let currentQueue = [], CURRENT_INDEX = 0;

// ============================================================
// HELPER: Normaliza qualquer item de qualquer fonte em Card padrão
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
// COMUNICAÇÃO GENÉRICA COM EDGE FUNCTIONS
// Suporta: youtube, tmdb, facebook, archive, peertube, dailymotion
// ============================================================
async function fetchEdge(name, extra = "") {
  const url = `${CONFIG.SUPABASE_URL}/functions/v1/${name}${extra}`;
  try {
    const headers = {
      "Authorization": `Bearer ${CONFIG.ANON_KEY}`,
      "apikey": CONFIG.ANON_KEY,
      "Content-Type": "application/json"
    };
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

// ============================================================
// FALLBACK: Internet Archive (sem necessidade de Edge Function)
// Busca direta na API pública do Archive.org para redundância
// ============================================================
async function fetchArchiveSearch(query, subtitle, source, rows = 10, fallback = []) {
  let items = [];
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier&fl[]=title&sort[]=downloads+desc&rows=${rows}&page=1&output=json`;
    const res = await fetch(url);
    const data = await res.json();
    const docs = data.response?.docs || [];
    for (const d of docs) {
      if (!d.identifier) continue;
      items.push(toCard({
        title: (d.title || "Sem título").slice(0, 32),
        subtitle,
        poster: `https://archive.org/services/img/${d.identifier}`,
        url: `https://archive.org/download/${d.identifier}/${d.identifier}.mp4`,
        type: 'mp4',
        source,
        desc: "Conteúdo de domínio público disponibilizado pelo Internet Archive."
      }));
    }
  } catch (e) { console.warn("Archive.org search falhou:", e); }
  if (items.length === 0) items = fallback;
  return items;
}

// ============================================================
// 1. YOUTUBE — Playlists por Gênero
// ============================================================
const YOUTUBE_PLAYLISTS = [
  { id: "PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj", label: "Pop & Trending" },
  { id: "PLFgquLnL59alW3xmYiWRaoz0oM3H17Lth", label: "MPB & Clássicos BR" },
  { id: "PLcOF5jSj-KEmZgZUFvhK5PZY7Q56tG3n8", label: "Rock & Indie" }
];

async function getYoutubeContent() {
  let videos = [];
  for (const pl of YOUTUBE_PLAYLISTS) {
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
  return videos;
}

// ============================================================
// 2. YOUTUBE — Busca por Query (Esportes, Desenhos, etc.)
// ============================================================
async function getYoutubeByQuery(query, label) {
  let videos = [];
  try {
    const edgeData = await fetchEdge("youtube", `?q=${encodeURIComponent(query)}`);
    if (!edgeData?.items) return [];
    for (const it of edgeData.items.slice(0, 10)) {
      const vid = it.snippet?.resourceId?.videoId;
      if (!vid) continue;
      const t = it.snippet?.title || "";
      if (t.toLowerCase().includes("private") || t.toLowerCase().includes("deleted")) continue;
      videos.push(toCard({
        title: t.slice(0, 35),
        subtitle: `${label} • YouTube`,
        poster: it.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        url: `https://www.youtube.com/embed/${vid}`,
        type: 'embed',
        source: "YouTube Edge",
        desc: it.snippet?.description?.slice(0, 150) || ""
      }));
    }
  } catch (e) { console.warn(`YouTube query '${query}' falhou:`, e); }
  return videos;
}

// ============================================================
// 3. TMDB — Filmes (Populares, Lançamentos, Gêneros)
// ============================================================
async function getTmdbMovies(endpoint, genreId = null, label = "TMDB") {
  let items = [];
  try {
    let extra = `?category=${endpoint}`;
    if (genreId) extra += `&genre=${genreId}`;
    const edgeData = await fetchEdge("tmdb", extra);

    // TMDB retorna array de resultados ou { results: [...] }
    const results = Array.isArray(edgeData) ? edgeData : (edgeData?.results || []);
    for (const r of results.slice(0, 12)) {
      const title = r.title || r.original_title || "Sem título";
      const posterBase = "https://image.tmdb.org/t/p/w500";
      items.push(toCard({
        title: title.slice(0, 38),
        subtitle: `${label} • ${(r.release_date || '').slice(0, 4) || 'N/A'} • ★${(r.vote_average || 0).toFixed(1)}`,
        poster: r.poster_path ? `${posterBase}${r.poster_path}` : `https://via.placeholder.com/400x600/1a1a2e/e94560?text=${encodeURIComponent(title.slice(0, 8))}`,
        url: r.backdrop_path ? `https://www.themoviedb.org/movie/${r.id}` : "",
        type: 'embed',
        source: "TMDB Edge",
        desc: r.overview?.slice(0, 180) || `${label} — Título popular.`
      }));
    }
  } catch (e) { console.warn(`TMDB ${endpoint} falhou:`, e); }
  return items;
}

// TMDB — Séries (Populares, Novas, Em alta)
async function getTmdbSeries(endpoint = "popular", label = "TMDB Séries") {
  let items = [];
  try {
    const edgeData = await fetchEdge("tmdb", `?category=tv_${endpoint}`);
    const results = Array.isArray(edgeData) ? edgeData : (edgeData?.results || []);
    for (const r of results.slice(0, 12)) {
      const title = r.name || r.original_name || "Sem título";
      const posterBase = "https://image.tmdb.org/t/p/w500";
      items.push(toCard({
        title: title.slice(0, 38),
        subtitle: `${label} • ${(r.first_air_date || '').slice(0, 4) || 'N/A'} • ★${(r.vote_average || 0).toFixed(1)}`,
        poster: r.poster_path ? `${posterBase}${r.poster_path}` : `https://via.placeholder.com/400x600/1a1a2e/e94560?text=${encodeURIComponent(title.slice(0, 8))}`,
        url: r.backdrop_path ? `https://www.themoviedb.org/tv/${r.id}` : "",
        type: 'embed',
        source: "TMDB Edge",
        desc: r.overview?.slice(0, 180) || `${label} — Série popular.`
      }));
    }
  } catch (e) { console.warn(`TMDB séries ${endpoint} falhou:`, e); }
  return items;
}

// ============================================================
// 4. DAILYMOTION — Vídeos por Query
// ============================================================
async function getDailymotionContent(query, label, rows = 10) {
  let items = [];
  try {
    const edgeData = await fetchEdge("dailymotion", `?q=${encodeURIComponent(query)}&limit=${rows}`);
    const results = Array.isArray(edgeData) ? edgeData : (edgeData?.items || []);
    for (const r of results.slice(0, rows)) {
      const videoUrl = r.embed_url || r.url || r.link || "";
      if (!videoUrl) continue;
      items.push(toCard({
        title: (r.title || r.name || "Sem título").slice(0, 35),
        subtitle: `${label} • Dailymotion`,
        poster: r.thumbnail_url || r.poster || r.thumbnail_medium_url || "",
        url: videoUrl,
        type: 'embed',
        source: "Dailymotion Edge",
        desc: (r.description || "").slice(0, 150)
      }));
    }
  } catch (e) { console.warn(`Dailymotion '${query}' falhou:`, e); }
  return items;
}

// ============================================================
// 5. PEERTUBE — Vídeos por Instância/Query
// ============================================================
async function getPeertubeContent(query, label, rows = 10) {
  let items = [];
  try {
    const edgeData = await fetchEdge("peertube", `?q=${encodeURIComponent(query)}&count=${rows}`);
    const results = Array.isArray(edgeData) ? edgeData : (edgeData?.data || edgeData?.items || []);
    for (const r of results.slice(0, rows)) {
      const videoUrl = r.url || r.embed_url || "";
      if (!videoUrl) continue;
      items.push(toCard({
        title: (r.name || r.title || "Sem título").slice(0, 35),
        subtitle: `${label} • PeerTube`,
        poster: r.thumbnail_path || r.thumbnail || r.thumbnailUrl || "",
        url: videoUrl,
        type: 'embed',
        source: "PeerTube Edge",
        desc: (r.description || "").slice(0, 150)
      }));
    }
  } catch (e) { console.warn(`PeerTube '${query}' falhou:`, e); }
  return items;
}

// ============================================================
// 6. FACEBOOK — Vídeos Públicos
// ============================================================
async function getFacebookContent(query, label, rows = 10) {
  let items = [];
  try {
    const edgeData = await fetchEdge("facebook", `?q=${encodeURIComponent(query)}&limit=${rows}`);
    const results = Array.isArray(edgeData) ? edgeData : (edgeData?.data || []);
    for (const r of results.slice(0, rows)) {
      const videoUrl = r.video_url || r.source || r.embed_html || "";
      if (!videoUrl) continue;
      items.push(toCard({
        title: (r.title || r.message || r.name || "Sem título").slice(0, 35),
        subtitle: `${label} • Facebook`,
        poster: r.thumbnail_url || r.picture || "",
        url: videoUrl,
        type: 'embed',
        source: "Facebook Edge",
        desc: (r.description || "").slice(0, 150)
      }));
    }
  } catch (e) { console.warn(`Facebook '${query}' falhou:`, e); }
  return items;
}

// ============================================================
// 7. INTERNET ARCHIVE — Edge Function + Fallback direto
// ============================================================
async function getArchiveContent(query, label, rows = 10, fallback = []) {
  let items = [];
  // Primeiro tenta via Edge Function
  try {
    const edgeData = await fetchEdge("archive", `?q=${encodeURIComponent(query)}&rows=${rows}`);
    const results = Array.isArray(edgeData) ? edgeData : (edgeData?.items || edgeData?.data || []);
    for (const r of results.slice(0, rows)) {
      const id = r.identifier || r.id;
      if (!id) continue;
      items.push(toCard({
        title: (r.title || "Sem título").slice(0, 32),
        subtitle: `${label} • Archive.org`,
        poster: `https://archive.org/services/img/${id}`,
        url: `https://archive.org/download/${id}/${id}.mp4`,
        type: 'mp4',
        source: "Archive Edge",
        desc: "Conteúdo de domínio público — Internet Archive."
      }));
    }
  } catch (e) { console.warn(`Archive Edge '${query}' falhou:`, e); }

  // Fallback: busca direta no Archive.org
  if (items.length === 0) {
    items = await fetchArchiveSearch(query, label, "Archive.org", rows, fallback);
  }
  return items;
}

// ============================================================
// 8. FILMES BLENDER (OPEN MOVIES) — Fallback fixo
// ============================================================
function getBlenderMovies() {
  return [
    toCard({ title: "Big Buck Bunny", subtitle: "Blender • 2008 • 4K", poster: "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217", url: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v", type: "mp4", source: "Blender", desc: "Um coelho gigante e simpático enfrenta três valentões da floresta neste clássico do cinema aberto." }),
    toCard({ title: "Sintel", subtitle: "Blender • Ação / Fantasia", poster: "https://durian.blender.org/wp-content/uploads/2010/05/sintel_poster.jpg", url: "https://download.blender.org/durian/trailer/sintel_trailer-1080p.mp4", type: "mp4", source: "Blender", desc: "Uma jovem guerreira embarca em uma jornada perigosa para resgatar seu pequeno dragão." }),
    toCard({ title: "Tears of Steel", subtitle: "Blender • Sci-Fi Futurista", poster: "https://mango.blender.org/wp-content/uploads/2013/05/01_poster.jpg", url: "https://download.blender.org/mango/tears_of_steel_1080p.webm", type: "mp4", source: "Blender", desc: "Em um futuro distópico em Amsterdã, um grupo de rebeldes tenta salvar o planeta de robôs destruidores." }),
    toCard({ title: "Caminandes 3: Llamigos", subtitle: "Blender • Comédia Infantil", poster: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400", url: "https://download.blender.org/caminandes/caminandes3/caminandes3_1080p.mp4", type: "mp4", source: "Blender", desc: "As aventuras hilárias de Kero, a lhama da Patagônia." }),
    toCard({ title: "Cosmos Laundromat", subtitle: "Blender • Animação Sci-Fi", poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400", url: "https://download.blender.org/serials/cosmos_laundromat/cosmos_laundromat_1080p.mp4", type: "mp4", source: "Blender", desc: "Em uma ilha deserta, uma ovelha desiludida encontra um lavadeiro misterioso." })
  ];
}

// ============================================================
// 9. NASA — Documentários de Espaço
// ============================================================
async function getNasaCollection() {
  let videos = [];
  try {
    const edgeData = await fetchEdge("archive", `?q=collection%3A%28NASA+OR+NASA_SVS%29&rows=8`);
    const results = Array.isArray(edgeData) ? edgeData : (edgeData?.items || []);
    for (const r of results.slice(0, 8)) {
      const id = r.identifier || r.id;
      if (!id) continue;
      videos.push(toCard({
        title: (r.title || "NASA Video").slice(0, 32),
        subtitle: "NASA • 4K Space",
        poster: `https://archive.org/services/img/${id}`,
        url: `https://archive.org/download/${id}/${id}.mp4`,
        type: 'mp4',
        source: "NASA Archive",
        desc: "Documentário científico direto do Internet Archive."
      }));
    }
  } catch (e) { console.warn("NASA collection falhou:", e); }

  // Fallback API NASA
  if (videos.length < 10) {
    for (const term of ["mars", "earth", "moon", "artemis"]) {
      if (videos.length >= 10) break;
      try {
        const res = await fetch(`https://images-api.nasa.gov/search?q=${term}&media_type=video`);
        const data = await res.json();
        for (const it of (data.collection?.items || []).slice(0, 3)) {
          const nasa_id = it.data?.[0]?.nasa_id;
          if (!nasa_id) continue;
          try {
            const assetRes = await fetch(`https://images-api.nasa.gov/asset/${nasa_id}`);
            const assetData = await assetRes.json();
            const mp4 = (assetData.collection?.items || []).find(u => u.href.includes('~orig.mp4')) || (assetData.collection?.items || []).find(u => u.href.endsWith('.mp4'));
            if (mp4?.href) {
              videos.push(toCard({
                title: (it.data[0].title || `Exploração ${term}`).slice(0, 32),
                subtitle: `${term[0].toUpperCase() + term.slice(1)} • 4K`,
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
  }
  return videos;
}

// ============================================================
// 10. DESSENHOS CLÁSSICOS — Fallback fixo
// ============================================================
function getClassicCartoons() {
  return [
    toCard({ title: "Popeye the Sailor", subtitle: "Archive • Clássico 1935", poster: "https://images.unsplash.com/photo-1563089145-599997674d42?w=400", url: "https://archive.org/download/popeye_ali_baba_and_forty_thieves/popeye_ali_baba_and_forty_thieves_512kb.mp4", type: "mp4", source: "Archive.org", desc: "Popeye em uma de suas maiores aventuras de domínio público." }),
    toCard({ title: "Superman (1941)", subtitle: "Fleischer Studios", poster: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400", url: "https://archive.org/download/superman_1941/superman_1941_512kb.mp4", type: "mp4", source: "Archive.org", desc: "Primeira animação histórica do Homem de Aço." }),
    toCard({ title: "Bugs Bunny — Rabbit Fire", subtitle: "Warner Bros • 1951", poster: "https://images.unsplash.com/photo-1535572290543-960a8046f5af?w=400", url: "https://archive.org/download/rabbitfire/rabbitfire_512kb.mp4", type: "mp4", source: "Archive.org", desc: "A famosa disputa entre Bugs Bunny e Elmer Fudd." }),
    toCard({ title: "Betty Boop — Snow White", subtitle: "Fleischer • 1933", poster: "https://images.unsplash.com/photo-1513188060468-04e5377e64e8?w=400", url: "https://archive.org/download/bettyboopsnowwhite/bettyboopsnowwhite_512kb.mp4", type: "mp4", source: "Archive.org", desc: "Betty Boop protagoniza esta versão dos 7 Anões." }),
    toCard({ title: "Felix the Cat", subtitle: "Silent Era • 1924", poster: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400", url: "https://archive.org/download/FelixTheCatInFelixTheCatMeetsSnowWhite/FelixTheCatInFelixTheCatMeetsSnowWhite_512kb.mp4", type: "mp4", source: "Archive.org", desc: "O icônico gato preto dos desenhos mudos dos anos 20." })
  ];
}

// ============================================================
// ============================================================
// CONSTRUÇÃO DO CATÁLOGO PRINCIPAL — Todas as Categorias
// ============================================================
// ============================================================

async function buildCatalog() {
  const allCategories = [];

  // ========================================================
  // FILMES — Populares (TMDB + Dailymotion + Archive)
  // ========================================================
  const [tmdbPop, dailymotionMovies, archiveMovies] = await Promise.all([
    getTmdbMovies("popular", null, "Filmes"),
    getDailymotionContent("best movies 2024", "Filmes", 8),
    getArchiveContent("collection:(feature_films)", "Filmes Clássicos", 8)
  ]);
  allCategories.push({
    id: "filmes",
    title: "🎬 Filmes — Populares & Clássicos",
    badge: `${tmdbPop.length + dailymotionMovies.length + archiveMovies.length} TÍTULOS`,
    items: [...tmdbPop, ...dailymotionMovies, ...archiveMovies].slice(0, 40)
  });

  // ========================================================
  // LANÇAMENTOS — TMDB now_playing + Dailymotion novos
  // ========================================================
  const [tmdbNow, dailymotionNew] = await Promise.all([
    getTmdbMovies("now_playing", null, "Lançamentos"),
    getDailymotionContent("new movies 2025 2026", "Lançamentos", 8)
  ]);
  allCategories.push({
    id: "lancamentos",
    title: "🆕 Lançamentos — O Que Está em Cartaz",
    badge: `${tmdbNow.length + dailymotionNew.length} TÍTULOS`,
    items: [...tmdbNow, ...dailymotionNew].slice(0, 30)
  });

  // ========================================================
  // CLÁSSICOS — Archive.org + PeerTube + Blender
  // ========================================================
  const [archiveClassicos, peertubeClassic, blenderList] = await Promise.all([
    getArchiveContent('subject:"classic film" AND mediatype:(movies)', "Clássicos", 10, []),
    getPeertubeContent("classic cinema vintage", "Clássicos", 6),
    Promise.resolve(getBlenderMovies())
  ]);
  allCategories.push({
    id: "classicos",
    title: "🎥 Clássicos — Ouro do Cinema",
    badge: `${archiveClassicos.length + peertubeClassic.length + blenderList.length} TÍTULOS`,
    items: [...archiveClassicos, ...peertubeClassic, ...blenderList].slice(0, 30)
  });

  // ========================================================
  // AÇÃO — TMDB genre 28 (Action) + Dailymotion + PeerTube
  // ========================================================
  const [tmdbAction, dailymotionAction, peertubeAction] = await Promise.all([
    getTmdbMovies("popular", 28, "Ação"),
    getDailymotionContent("best action movies fight scenes", "Ação", 8),
    getPeertubeContent("action movies full", "Ação", 6)
  ]);
  allCategories.push({
    id: "acao",
    title: "💥 Ação — Adrenalina Pura",
    badge: `${tmdbAction.length + dailymotionAction.length + peertubeAction.length} TÍTULOS`,
    items: [...tmdbAction, ...dailymotionAction, ...peertubeAction].slice(0, 30)
  });

  // ========================================================
  // COMÉDIA — TMDB genre 35 (Comedy) + Dailymotion + Archive
  // ========================================================
  const [tmdbComedy, dailymotionComedy, archiveComedy] = await Promise.all([
    getTmdbMovies("popular", 35, "Comédia"),
    getDailymotionContent("comedy movies funny", "Comédia", 8),
    getArchiveContent('subject:"comedy" AND mediatype:(movies)', "Comédia", 6)
  ]);
  allCategories.push({
    id: "comedia",
    title: "😂 Comédia — Para Rir Muito",
    badge: `${tmdbComedy.length + dailymotionComedy.length + archiveComedy.length} TÍTULOS`,
    items: [...tmdbComedy, ...dailymotionComedy, ...archiveComedy].slice(0, 30)
  });

  // ========================================================
  // ROMANCE — TMDB genre 10749 (Romance) + Dailymotion
  // ========================================================
  const [tmdbRomance, dailymotionRomance, archiveRomance] = await Promise.all([
    getTmdbMovies("popular", 10749, "Romance"),
    getDailymotionContent("romance movies love story", "Romance", 8),
    getArchiveContent('subject:"romance" AND mediatype:(movies)', "Romance", 6)
  ]);
  allCategories.push({
    id: "romance",
    title: "❤️ Romance — Histórias de Amor",
    badge: `${tmdbRomance.length + dailymotionRomance.length + archiveRomance.length} TÍTULOS`,
    items: [...tmdbRomance, ...dailymotionRomance, ...archiveRomance].slice(0, 30)
  });

  // ========================================================
  // DOCUMENTÁRIOS — NASA + Archive.org + PeerTube + Dailymotion
  // ========================================================
  const [nasaList, archiveDocs, peertubeDocs, dailymotionDocs] = await Promise.all([
    getNasaCollection(),
    getArchiveContent('collection:(prelinger)', "Documentários", 8),
    getPeertubeContent("documentary full film", "Documentários", 6),
    getDailymotionContent("documentary full movie", "Documentários", 6)
  ]);
  allCategories.push({
    id: "documentarios",
    title: "🌍 Documentários — Conhecimento Real",
    badge: `${nasaList.length + archiveDocs.length + peertubeDocs.length + dailymotionDocs.length} TÍTULOS`,
    items: [...nasaList, ...archiveDocs, ...peertubeDocs, ...dailymotionDocs].slice(0, 40)
  });

  // ========================================================
  // SÉRIES — TMDB TV Popular
  // ========================================================
  const [tmdbSeries, dailymotionSeries, archiveSeries] = await Promise.all([
    getTmdbSeries("popular", "Séries"),
    getDailymotionContent("best series full episodes", "Séries", 8),
    getArchiveContent('subject:"tv series" AND mediatype:(movies)', "Séries", 6)
  ]);
  allCategories.push({
    id: "series",
    title: "📺 Séries — Temporadas Completas",
    badge: `${tmdbSeries.length + dailymotionSeries.length + archiveSeries.length} TÍTULOS`,
    items: [...tmdbSeries, ...dailymotionSeries, ...archiveSeries].slice(0, 35)
  });

  // ========================================================
  // SÉRIES NOVAS — TMDB TV On The Air / Trending
  // ========================================================
  const [tmdbNewSeries, dailymotionNewSeries, peertubeNewSeries] = await Promise.all([
    getTmdbSeries("on_the_air", "Séries Novas"),
    getDailymotionContent("new series 2025 2026", "Séries Novas", 8),
    getPeertubeContent("new series web series", "Séries Novas", 6)
  ]);
  allCategories.push({
    id: "series-novas",
    title: "🔥 Séries Novas — Acabou de Estrear",
    badge: `${tmdbNewSeries.length + dailymotionNewSeries.length + peertubeNewSeries.length} TÍTULOS`,
    items: [...tmdbNewSeries, ...dailymotionNewSeries, ...peertubeNewSeries].slice(0, 30)
  });

  // ========================================================
  // INFANTIL — YouTube Kids + Archive.org + PeerTube
  // ========================================================
  const [ytKids, archiveKids, peertubeKids, dailymotionKids] = await Promise.all([
    getYoutubeByQuery("kids cartoons safe for children", "Infantil"),
    getArchiveContent('subject:"children" AND mediatype:(movies)', "Infantil", 8),
    getPeertubeContent("kids cartoons animation", "Infantil", 6),
    getDailymotionContent("kids cartoons children safe", "Infantil", 6)
  ]);
  allCategories.push({
    id: "infantil",
    title: "👶 Infantil — Seguro para Crianças",
    badge: `${ytKids.length + archiveKids.length + peertubeKids.length + dailymotionKids.length} TÍTULOS`,
    items: [...ytKids, ...archiveKids, ...peertubeKids, ...dailymotionKids].slice(0, 40)
  });

  // ========================================================
  // DESENHOS — YouTube + Archive.org + PeerTube
  // ========================================================
  const [ytDrawings, archiveDrawings, peertubeDrawings, dailymotionDrawings] = await Promise.all([
    getYoutubeByQuery("animation short films cartoons", "Desenhos"),
    getArchiveContent('subject:"animation" AND mediatype:(movies)', "Desenhos", 8),
    getPeertubeContent("animation short film cartoons", "Desenhos", 6),
    getDailymotionContent("animation short cartoons", "Desenhos", 6)
  ]);
  allCategories.push({
    id: "desenhos",
    title: "🎨 Desenhos — Animações & Curtas",
    badge: `${ytDrawings.length + archiveDrawings.length + peertubeDrawings.length + dailymotionDrawings.length} TÍTULOS`,
    items: [...ytDrawings, ...archiveDrawings, ...peertubeDrawings, ...dailymotionDrawings].slice(0, 40)
  });

  // ========================================================
  // DESENHOS CLÁSSICOS — Archive.org + Fallback fixo
  // ========================================================
  const [archiveCartoons, ytCartoons, peertubeCartoons] = await Promise.all([
    getArchiveContent('collection:(classic_cartoons)', "Desenhos Clássicos", 8, []),
    getYoutubeByQuery("classic cartoons 1940s 1950s vintage", "Desenhos Clássicos"),
    getPeertubeContent("classic cartoons vintage animation", "Desenhos Clássicos", 6)
  ]);
  const classicFallback = getClassicCartoons();
  allCategories.push({
    id: "desenhos-classicos",
    title: "📽️ Desenhos Clássicos — Era de Ouro",
    badge: `${archiveCartoons.length + ytCartoons.length + peertubeCartoons.length + classicFallback.length} TÍTULOS`,
    items: [...archiveCartoons, ...ytCartoons, ...peertubeCartoons, ...classicFallback].slice(0, 35)
  });

  // ========================================================
  // ESPORTES — FUTEVOL / VÔLEI / BASQUETE
  // ========================================================
  // Subcategorias de Esportes
  const [ytFutebol, archiveFutebol, peertubeFutebol, dailymotionFutebol] = await Promise.all([
    getYoutubeByQuery("futebol highlights gols melhores momentos", "Futebol"),
    getArchiveContent('subject:"football" AND mediatype:(movies)', "Futebol", 6),
    getPeertubeContent("soccer football highlights", "Futebol", 6),
    getDailymotionContent("futebol highlights gols", "Futebol", 6)
  ]);
  allCategories.push({
    id: "futebol",
    title: "⚽ Futebol — Melhores Momentos & Gols",
    badge: `${ytFutebol.length + archiveFutebol.length + peertubeFutebol.length + dailymotionFutebol.length} TÍTULOS`,
    items: [...ytFutebol, ...archiveFutebol, ...peertubeFutebol, ...dailymotionFutebol].slice(0, 30)
  });

  const [ytVolei, archiveVolei, peertubeVolei, dailymotionVolei] = await Promise.all([
    getYoutubeByQuery("volei highlights melhores jogadas vôlei", "Vôlei"),
    getArchiveContent('subject:"volleyball" AND mediatype:(movies)', "Vôlei", 6),
    getPeertubeContent("volleyball highlights best plays", "Vôlei", 6),
    getDailymotionContent("volei voleibol melhores jogadas", "Vôlei", 6)
  ]);
  allCategories.push({
    id: "volei",
    title: "🏐 Vôlei — Jogadas Incríveis",
    badge: `${ytVolei.length + archiveVolei.length + peertubeVolei.length + dailymotionVolei.length} TÍTULOS`,
    items: [...ytVolei, ...archiveVolei, ...peertubeVolei, ...dailymotionVolei].slice(0, 25)
  });

  const [ytBasquete, archiveBasquete, peertubeBasquete, dailymotionBasquete] = await Promise.all([
    getYoutubeByQuery("basketball highlights nba best plays", "Basquete"),
    getArchiveContent('subject:"basketball" AND mediatype:(movies)', "Basquete", 6),
    getPeertubeContent("basketball highlights nba", "Basquete", 6),
    getDailymotionContent("basquete basketball highlights", "Basquete", 6)
  ]);
  allCategories.push({
    id: "basquete",
    title: "🏀 Basquete — Melhores Jogadas & NBA",
    badge: `${ytBasquete.length + archiveBasquete.length + peertubeBasquete.length + dailymotionBasquete.length} TÍTULOS`,
    items: [...ytBasquete, ...archiveBasquete, ...peertubeBasquete, ...dailymotionBasquete].slice(0, 30)
  });

  // ========================================================
  // MÚSICAS & TRENDING — YouTube Edge
  // ========================================================
  const musicList = await getYoutubeContent();
  if (musicList.length > 0) {
    allCategories.push({
      id: "musicas",
      title: "🎵 Músicas & Clipes em Alta • YouTube Edge",
      badge: `${musicList.length} VÍDEOS`,
      items: musicList
    });
  }

  // ========================================================
  // FACEBOOK — Vídeos Virais / Trending
  // ========================================================
  const fbVideos = await getFacebookContent("viral videos trending", "Facebook Trending", 8);
  if (fbVideos.length > 0) {
    allCategories.push({
      id: "facebook",
      title: "📱 Facebook Trending — Vídeos Virais",
      badge: `${fbVideos.length} VÍDEOS`,
      items: fbVideos
    });
  }

  return allCategories;
}

// ============================================================
// RENDERIZADOR DINÂMICO DE FILEIRAS
// ============================================================
function createRowElement(id, title, badgeText, items) {
  if (!items || items.length === 0) return null;

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

// ============================================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("content-container");

  // Exibe loading state
  container.innerHTML = `
    <div style="text-align:center;padding:60px;color:#666;">
      <div style="font-size:2rem;margin-bottom:16px;">⏳</div>
      <p>Carregando catálogo completo...</p>
      <p style="font-size:0.85rem;color:#888;margin-top:8px;">Conectando: YouTube • TMDB • Facebook • Archive.org • PeerTube • Dailymotion</p>
    </div>
  `;

  try {
    const categories = await buildCatalog();

    // Limpa loading
    container.innerHTML = "";

    // Determina o item de destaque para o Hero
    const heroItem = categories.flatMap(c => c.items).find(i => i.url) || null;
    if (heroItem) {
      const heroBg = document.getElementById("hero-bg");
      const heroTitle = document.getElementById("hero-title");
      const heroDesc = document.getElementById("hero-desc");
      const heroPlay = document.getElementById("hero-play");
      if (heroBg) heroBg.style.backgroundImage = `url('${heroItem.poster}')`;
      if (heroTitle) heroTitle.textContent = heroItem.title;
      if (heroDesc) heroDesc.textContent = heroItem.desc || heroItem.subtitle;
      if (heroPlay) heroPlay.onclick = () => openPlayerQueue([heroItem], 0);
    }

    // Injeta todas as fileiras de categorias
    for (const cat of categories) {
      const rowEl = createRowElement(cat.id, cat.title, cat.badge, cat.items);
      if (rowEl) container.appendChild(rowEl);
    }

    // Resumo do catálogo
    const totalCards = categories.reduce((sum, c) => sum + c.items.length, 0);
    console.log(`OIO TV v5.0 — ${categories.length} categorias, ${totalCards} cards carregados.`);

  } catch (e) {
    console.error("Erro ao carregar catálogo:", e);
    container.innerHTML = `
      <div style="text-align:center;padding:60px;color:#ff6b6b;">
        <p style="font-size:1.2rem;">Erro ao carregar o catálogo.</p>
        <p style="font-size:0.85rem;color:#888;">Verifique a conexão com as Edge Functions do Supabase.</p>
      </div>
    `;
  }

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

  if (item.type === 'mp4' || item.url.match(/\.mp4|\.webm|\.m4v/)) {
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
        console.warn("Link de vídeo direto falhou, acionando fallback...");
        videoEl.src = "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v";
        videoEl.play().catch(() => {});
      };
    }
  } else {
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
// NAVEGAÇÃO INFERIOR (Bottom Nav)
// ============================================================
function setupNavigation() {
  const navMap = {
    home: null,
    filmes: "row-filmes",
    series: "row-series",
    desenhos: "row-desenhos",
    desenhos-classicos: "row-desenhos-classicos",
    esportes: "row-futebol",
    futebol: "row-futebol",
    infantil: "row-infantil"
  };

  document.querySelectorAll(".bottom-nav .nav-item").forEach(item => {
    item.onclick = e => {
      e.preventDefault();
      document.querySelectorAll(".bottom-nav .nav-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");

      const tab = item.dataset.tab || item.dataset.category;
      const targetId = navMap[tab];
      if (targetId) {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
      } else if (tab === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  });
}
