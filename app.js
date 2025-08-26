"use strict";

const OMDB_ENDPOINT = "https://www.omdbapi.com/";
const OMDB_API_KEY = "thewdb"; // demo key; ganti jika punya

const dom = {
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  button: document.getElementById("search-button"),
  type: document.getElementById("filter-type"),
  year: document.getElementById("filter-year"),
  sort: document.getElementById("sort-by"),
  loader: document.getElementById("loader"),
  title: document.getElementById("section-title"),
  grid: document.getElementById("movie-list"),
  chips: document.getElementById("chips"),
  recent: document.getElementById("recent"),
  recentList: document.getElementById("recent-list"),
  pagination: document.getElementById("pagination"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  pageInfo: document.getElementById("page-info"),
  modal: document.getElementById("modal"),
  modalBody: document.getElementById("modal-body"),
};

const state = { currentPage: 1, totalResults: 0 };
const SEED_KEYWORDS = ["star","love","war","man","girl","night","king","space"]; // trending awal

function showLoader(isShown){ dom.loader.hidden = !isShown; dom.button.disabled = isShown; }

async function searchMovies(query, opts={}){
  const { type="", year="", page=1 } = opts;
  const params = new URLSearchParams({ s: query, apikey: OMDB_API_KEY });
  if(type) params.set("type", type);
  if(year) params.set("y", String(year));
  params.set("page", String(page));
  const res = await fetch(`${OMDB_ENDPOINT}?${params.toString()}`);
  if(!res.ok) throw new Error("Gagal memuat data");
  const json = await res.json();
  if(json.Response === "False") return { movies: [], total: 0 };
  return { movies: Array.isArray(json.Search)? json.Search: [], total: Number(json.totalResults||0) };
}

async function getMovieDetail(imdbID){
  const params = new URLSearchParams({ i: imdbID, plot: "full", apikey: OMDB_API_KEY });
  const res = await fetch(`${OMDB_ENDPOINT}?${params.toString()}`);
  if(!res.ok) throw new Error("Gagal memuat detail");
  return res.json();
}

function createCard(movie){
  const poster = movie.Poster && movie.Poster !== "N/A" ? movie.Poster : "https://placehold.co/300x450?text=No+Image";
  const el = document.createElement("article");
  el.className = "card";
  const favBadge = isFavorite(movie.imdbID) ? '<span class="badge">★ Fav</span>' : '';
  el.innerHTML = `${favBadge}<img src="${poster}" alt="Poster ${movie.Title}" loading="lazy"/><div class="card-body"><h3 class="card-title">${movie.Title}</h3><p class="card-meta">${movie.Year} • ${movie.Type}</p></div>`;
  el.addEventListener("click", async ()=>{
    try{ openModal(`<div class=\"loader\"></div>`); const d = await getMovieDetail(movie.imdbID); renderDetail(d);}catch(_){ openModal(`<p>Gagal memuat detail. Coba lagi.</p>`); }
  });
  return el;
}

function renderMovies(movies){
  dom.grid.innerHTML = "";
  if(movies.length===0){ dom.grid.innerHTML = `<p>Tidak ada hasil. Coba kata kunci lain.</p>`; return; }
  const frag = document.createDocumentFragment();
  for(const m of movies) frag.appendChild(createCard(m));
  dom.grid.appendChild(frag);
}

function renderSkeleton(count=10){
  dom.grid.innerHTML='';
  const frag=document.createDocumentFragment();
  for(let i=0;i<count;i++){
    const sk=document.createElement('div');
    sk.className='card';
    sk.innerHTML=`<div class="skeleton" style="width:100%;height:270px"></div><div class="card-body"><div class="skeleton" style="width:70%;height:16px;margin-bottom:6px"></div><div class="skeleton" style="width:40%;height:12px"></div></div>`;
    frag.appendChild(sk);
  }
  dom.grid.appendChild(frag);
}

function renderChips(){
  dom.chips.innerHTML='';
  SEED_KEYWORDS.forEach(k=>{
    const b=document.createElement('button');
    b.textContent = `#${k}`;
    b.addEventListener('click',()=>{ dom.input.value = k; triggerSearch(1); });
    dom.chips.appendChild(b);
  });
}

function showFavorites(){
  const ids = JSON.parse(localStorage.getItem('favorites')||'[]');
  if(ids.length===0){ dom.title.textContent='Favorit kamu kosong'; dom.grid.innerHTML='<p>Belum ada film favorit.</p>'; dom.pagination.hidden=true; return; }
  dom.title.textContent = 'Favorit Kamu';
  dom.grid.innerHTML='';
  renderSkeleton(Math.min(ids.length,10));
  Promise.all(ids.map(id=>getMovieDetail(id))).then(list=>{
    dom.grid.innerHTML='';
    renderMovies(list);
    dom.pagination.hidden=true;
  }).catch(()=>{ dom.grid.innerHTML='<p>Gagal memuat favorit.</p>'; });
}

function renderPagination(){
  const totalPages = Math.max(1, Math.ceil(state.totalResults/10));
  dom.pagination.hidden = totalPages <= 1;
  dom.prev.disabled = state.currentPage <= 1;
  dom.next.disabled = state.currentPage >= totalPages;
  dom.pageInfo.textContent = `Halaman ${state.currentPage} / ${totalPages}`;
}

function sortMovies(movies, mode){
  const a = movies.slice();
  if(mode === "title-asc") a.sort((x,y)=>x.Title.localeCompare(y.Title));
  else if(mode === "title-desc") a.sort((x,y)=>y.Title.localeCompare(x.Title));
  else if(mode === "year-asc") a.sort((x,y)=>String(x.Year).localeCompare(String(y.Year)));
  else if(mode === "year-desc") a.sort((x,y)=>String(y.Year).localeCompare(String(x.Year)));
  return a;
}

function saveRecent(q){ const key="recentSearches"; const cur=JSON.parse(localStorage.getItem(key)||"[]"); const next=[q,...cur.filter(x=>x!==q)].slice(0,6); localStorage.setItem(key, JSON.stringify(next)); }
function loadRecent(){ return JSON.parse(localStorage.getItem("recentSearches")||"[]"); }
function renderRecent(){ const items = loadRecent(); dom.recent.hidden = items.length===0; dom.recentList.innerHTML=''; items.forEach(q=>{ const b=document.createElement('button'); b.textContent=q; b.addEventListener('click',()=>{ dom.input.value=q; triggerSearch(1);}); dom.recentList.appendChild(b); }); }

function toggleFavorite(id){ const key="favorites"; const set=new Set(JSON.parse(localStorage.getItem(key)||"[]")); if(set.has(id)) set.delete(id); else set.add(id); localStorage.setItem(key, JSON.stringify([...set])); }
function isFavorite(id){ const arr=JSON.parse(localStorage.getItem("favorites")||"[]"); return arr.includes(id); }

function renderDetail(d){
  const poster = d.Poster && d.Poster !== "N/A" ? d.Poster : "https://placehold.co/300x450?text=No+Image";
  const html = `<div class="detail"><img src="${poster}" alt="Poster ${d.Title}"/><div><h3>${d.Title}</h3><p class="meta">${d.Year} • ${d.Runtime} • ${d.Genre}</p><p class="plot">${d.Plot||"Tidak ada sinopsis."}</p><p class="meta">IMDb: ${d.imdbRating}/10 • Director: ${d.Director}</p><div class="fav"><button id="fav-btn">${isFavorite(d.imdbID)?"Hapus Favorit":"Tambah Favorit"}</button></div></div></div>`;
  openModal(html);
  const favBtn = document.getElementById("fav-btn");
  if(favBtn){ favBtn.addEventListener('click',()=>{ toggleFavorite(d.imdbID); favBtn.textContent = isFavorite(d.imdbID)?"Hapus Favorit":"Tambah Favorit"; }); }
}

function openModal(inner){ dom.modalBody.innerHTML = inner; dom.modal.setAttribute('aria-hidden','false'); const closers = dom.modal.querySelectorAll('[data-close]'); closers.forEach(n=>n.addEventListener('click', closeModal, { once:true })); document.addEventListener('keydown', escHandler, { once:true }); }
function closeModal(){ dom.modal.setAttribute('aria-hidden','true'); }
function escHandler(e){ if(e.key==='Escape') closeModal(); }

async function triggerSearch(page=1){
  const q = dom.input.value.trim(); if(!q) return;
  dom.title.textContent = `Hasil untuk "${q}"`;
  saveRecent(q); renderRecent(); showLoader(true); renderSkeleton();
  try{
    const { movies, total } = await searchMovies(q, { type: dom.type.value, year: dom.year.value, page });
    state.currentPage = page; state.totalResults = total; renderPagination();
    const sorted = sortMovies(movies, dom.sort.value); renderMovies(sorted);
  }catch(_){ dom.grid.innerHTML = `<p>Terjadi kesalahan saat memuat data.</p>`; dom.pagination.hidden=true; }
  finally{ showLoader(false); }
}

dom.form.addEventListener('submit', e=>{ e.preventDefault(); triggerSearch(1); });
dom.sort.addEventListener('change', ()=> triggerSearch(state.currentPage));
dom.type.addEventListener('change', ()=> triggerSearch(1));
dom.year.addEventListener('change', ()=> triggerSearch(1));
dom.prev.addEventListener('click', ()=> state.currentPage>1 && triggerSearch(state.currentPage-1));
dom.next.addEventListener('click', ()=> triggerSearch(state.currentPage+1));
document.getElementById('show-favorites').addEventListener('click', showFavorites);

dom.input.focus(); renderRecent(); renderChips();

// tampilkan rekomendasi awal
(async function initTrending(){
  dom.title.textContent = 'Rekomendasi untuk kamu';
  renderSkeleton();
  try{
    const seed = SEED_KEYWORDS[Math.floor(Math.random()*SEED_KEYWORDS.length)];
    dom.input.value = seed;
    await triggerSearch(1);
  }catch(_){ dom.grid.innerHTML = '<p>Mulai dengan mencari judul film di atas.</p>'; }
})();

