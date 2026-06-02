const player = videojs('videoPlayer', { 
  controls: true, 
  autoplay: true, 
  preload: 'auto', 
  fluid: true, 
  responsive: true,
  html5: {
    hls: {
      overrideNative: true
    }
  }
});

const loadingScreen = document.getElementById("loadingScreen"); const bufferLoader = document.getElementById("bufferLoader");
const playBtn = document.getElementById("playPauseBtn"); const playerCardContainer = document.getElementById("playerCardContainer");
const liveBadge = document.getElementById("liveBadge"); let badgeTimeout;
let bingeData = null; let activeVideoKey = ""; let savedResumeTime = 0; let promptTimer = null;

function initPlayer() {
  const urlParams = new URLSearchParams(window.location.search);
  const dataParam = urlParams.get('data'); const linkParam = urlParams.get('link');
  if (dataParam) {
    try {
      sessionStorage.setItem("secureStreamData", dataParam);
      let decodedStr = ""; try { decodedStr = atob(dataParam); } catch(e) { decodedStr = dataParam; }
      bingeData = JSON.parse(decodeURIComponent(escape(decodedStr)));
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) { console.error("Failed to parse stream data.", e); }
  } else if (linkParam) {
    bingeData = { currentIndex: 0, playlist: [ linkParam ] };
  } else {
    let rawData = sessionStorage.getItem("secureStreamData");
    if (rawData) { try { let dStr = ""; try { dStr = atob(rawData); } catch(e) { dStr = rawData; } bingeData = JSON.parse(decodeURIComponent(escape(dStr))); } catch(e) {} }
  }
  if (!bingeData || !bingeData.playlist || bingeData.playlist.length === 0) { showToast("Stream link missing!"); return; }
  loadVideoByIndex(bingeData.currentIndex);
}

function loadVideoByIndex(index) {
  if (index < 0 || index >= bingeData.playlist.length) return;
  bingeData.currentIndex = index; const currentItem = bingeData.playlist[index];
  let link = typeof currentItem === "string" ? currentItem : currentItem.url;
  try { if (!link.startsWith("http")) link = atob(link); } catch(e) {}
  
  if (bingeData.id) {
    activeVideoKey = "ntm_id_" + bingeData.id + "_ep_" + index;
  } else {
    let cleanLink = link.split('?')[0];
    activeVideoKey = "ntm_link_" + cleanLink.substring(cleanLink.length - 30).replace(/[^a-zA-Z0-9]/g, "");
  }

  let type = "video/mp4";
  if (link.includes(".m3u8")) type = "application/x-mpegURL";
  else if (link.includes(".mpd")) type = "application/dash+xml";
  else if (link.includes(".mkv")) type = "video/x-matroska";

  if (loadingScreen) loadingScreen.style.display = "flex";
  if (bufferLoader) bufferLoader.classList.add("show");
  player.src({ src: link, type: type });
  player.play().then(() => { if (loadingScreen) loadingScreen.style.display = "none"; if (bufferLoader) bufferLoader.classList.remove("show"); }).catch(() => { if (loadingScreen) loadingScreen.style.display = "none"; });
  buildEpisodeRow();
}

function buildEpisodeRow() {
  const container = document.getElementById("episodeContainer"); if (!container) return;
  if (bingeData.playlist.length <= 1) { container.style.display = "none"; return; }
  container.style.display = "block"; let html = "";
  bingeData.playlist.forEach((item, i) => {
    let label = `Episode ${i + 1}`;
    if (typeof item === "object" && item.episode) label = item.episode;
    else if (typeof item === "object" && item.size) label = `Watch (${item.size}${item.unit})`;
    const isActive = (i === bingeData.currentIndex) ? "active" : "";
    html += `<button class="ep-btn ${isActive}" onclick="loadVideoByIndex(${i})">${label}</button>`;
  });
  container.innerHTML = html;
  setTimeout(() => { const activeBtn = container.querySelector('.active'); if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, 100);
}

function togglePlay() { player.paused() ? (player.play(), showToast("Playing")) : (player.pause(), showToast("Paused")); }
function skipForward() { player.currentTime(player.currentTime() + 10); pulsePlayer(); showToast("+10 Seconds"); }
function skipBackward() { player.currentTime(player.currentTime() - 10); pulsePlayer(); showToast("-10 Seconds"); }

function toggleFullscreen() {
  if (!playerCardContainer) return;
  const isWebFS = playerCardContainer.classList.contains("web-fullscreen");
  const fsBtn = document.querySelector("button[onclick='toggleFullscreen()']");
  if (!isWebFS) {
    playerCardContainer.classList.add("web-fullscreen"); showToast("Fullscreen Enabled"); if (fsBtn) fsBtn.innerHTML = "🔳 Exit Fullscreen";
    if (playerCardContainer.requestFullscreen) playerCardContainer.requestFullscreen().catch(() => {});
    else if (playerCardContainer.webkitRequestFullscreen) playerCardContainer.webkitRequestFullscreen().catch(() => {});
  } else {
    syncExitFullscreen(); if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); else if (document.webkitExitFullscreen) document.webkitExitFullscreen().catch(() => {});
  }
}

function syncExitFullscreen() {
  if (playerCardContainer.classList.contains("web-fullscreen")) {
    playerCardContainer.classList.remove("web-fullscreen");
    const fsBtn = document.querySelector("button[onclick='toggleFullscreen()']");
    if (fsBtn) fsBtn.innerHTML = "🔲 Fullscreen";
    
    // Safely hide the exit button when back in normal mode
    const exitBtn = document.getElementById("floatingExitBtn");
    if (exitBtn) exitBtn.classList.remove("visible");
  }
}

const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
fsEvents.forEach(evt => { document.addEventListener(evt, () => { if (!(document.fullscreenElement || document.webkitFullscreenElement)) { syncExitFullscreen(); } }); });

async function togglePiP() {
  const techVideo = player.tech({ IWillNotUseThisInApp: true }) ? player.tech().el_ : null; if (!techVideo) return showToast("Loading layer...");
  try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else if (document.pictureInPictureEnabled) await techVideo.requestPictureInPicture(); } catch (error) { playerCardContainer.classList.toggle("web-fullscreen"); }
}

function hideBadgeAfterDelay() { if (!liveBadge) return; clearTimeout(badgeTimeout); badgeTimeout = setTimeout(() => { if (!player.paused()) liveBadge.classList.add("hidden"); }, 3000); }
function showBadge() { if (!liveBadge) return; clearTimeout(badgeTimeout); liveBadge.classList.remove("hidden"); }

player.on("play", () => { if (playBtn) playBtn.innerHTML = "⏸ Pause"; showBadge(); hideBadgeAfterDelay(); });
player.on("pause", () => { if (playBtn) playBtn.innerHTML = "⏯ Play"; showBadge(); }); player.on("seeking", () => { showBadge(); hideBadgeAfterDelay(); });

// --- AUTO-HIDE FLOATING CLOSE BUTTON ON SCREEN TAP ---
player.on('useractive', () => {
  const btn = document.getElementById("floatingExitBtn");
  if (btn && playerCardContainer && playerCardContainer.classList.contains("web-fullscreen")) {
    btn.classList.add("visible");
  }
});
player.on('userinactive', () => {
  const btn = document.getElementById("floatingExitBtn");
  if (btn) btn.classList.remove("visible");
});

const speedControl = document.getElementById("speedControl");
if (speedControl) { speedControl.addEventListener("change", (e) => { player.playbackRate(Number(e.target.value)); showToast("Speed: " + e.target.value + "x"); }); }

function copyStreamLink() {
  if (!bingeData) return; let scrambledPayload = "";
  try { scrambledPayload = btoa(unescape(encodeURIComponent(JSON.stringify(bingeData)))); } catch(e) { scrambledPayload = btoa(JSON.stringify(bingeData)); }
  navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?data=" + encodeURIComponent(scrambledPayload)); showToast("Link Copied!");
}

function showResumePrompt(timeInSeconds) {
  savedResumeTime = timeInSeconds; const prompt = document.getElementById('resumePrompt'); const display = document.getElementById('resumeTimeDisplay');
  if(prompt && display) { display.innerText = formatTime(timeInSeconds); prompt.classList.add('show'); clearTimeout(promptTimer); promptTimer = setTimeout(() => { dismissResume(); }, 10000); }
}
function executeResume() { player.currentTime(savedResumeTime); player.play(); dismissResume(); showToast("Resumed playback"); }
function dismissResume() { const prompt = document.getElementById('resumePrompt'); if(prompt) prompt.classList.remove('show'); clearTimeout(promptTimer); }
function formatTime(s) { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = Math.floor(s % 60); return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}` : `${m}:${sec.toString().padStart(2,'0')}`; }

player.on('loadedmetadata', () => {
  if (loadingScreen) loadingScreen.style.display = "none"; showToast("Stream Ready"); hideBadgeAfterDelay();
  const history = JSON.parse(localStorage.getItem('ntm_watch_history')) || {};
  if (history[activeVideoKey] && history[activeVideoKey] > 10 && history[activeVideoKey] < player.duration() - 30) { showResumePrompt(history[activeVideoKey]); }
});

player.on('timeupdate', () => { const cTime = player.currentTime(); if (cTime > 5 && Math.floor(cTime) % 5 === 0) { const history = JSON.parse(localStorage.getItem('ntm_watch_history')) || {}; history[activeVideoKey] = Math.floor(cTime); localStorage.setItem('ntm_watch_history', JSON.stringify(history)); } });
player.on("waiting", () => { if (bufferLoader) bufferLoader.classList.add("show"); }); player.on("playing", () => { if (bufferLoader) bufferLoader.classList.remove("show"); });
player.on("ended", () => { showToast("Playback Finished"); showBadge(); const history = JSON.parse(localStorage.getItem('ntm_watch_history')) || {}; delete history[activeVideoKey]; localStorage.setItem('ntm_watch_history', JSON.stringify(history)); });
player.on("error", () => { if (loadingScreen) loadingScreen.style.display = "none"; if (bufferLoader) bufferLoader.classList.remove("show"); showToast("Link broken or unsupported."); });

document.addEventListener("keydown", (e) => {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); } 
  if (e.code === "ArrowRight") skipForward(); 
  if (e.code === "ArrowLeft") skipBackward();
  
  if (e.code === "ArrowUp") { 
    e.preventDefault(); 
    player.volume(Math.min(player.volume() + 0.1, 1.0)); 
    showToast("Volume: " + Math.round(player.volume() * 100) + "%"); 
  } 
  if (e.code === "ArrowDown") { 
    e.preventDefault(); 
    player.volume(Math.max(player.volume() - 0.1, 0.0)); 
    showToast("Volume: " + Math.round(player.volume() * 100) + "%"); 
  } 
  
  if (e.key.toLowerCase() === "f") { e.preventDefault(); toggleFullscreen(); }
});

function pulsePlayer() { if (!playerCardContainer) return; playerCardContainer.style.transform = "scale(1.005)"; setTimeout(() => { playerCardContainer.style.transform = "scale(1)"; }, 150); }
function showToast(t) {
  const oldToast = document.querySelector(".custom-toast"); if (oldToast) oldToast.remove();
  const toast = document.createElement("div"); toast.className = "custom-toast"; toast.innerText = t; toast.style.position = "fixed"; toast.style.bottom = "30px"; toast.style.left = "50%"; toast.style.transform = "translateX(-50%)"; toast.style.padding = "14px 22px"; toast.style.borderRadius = "14px"; toast.style.background = "rgba(0,0,0,0.85)"; toast.style.backdropFilter = "blur(10px)"; toast.style.color = "white"; toast.style.zIndex = "999999"; toast.style.fontSize = "14px"; toast.style.boxShadow = "0 4px 20px rgba(0,0,0,0.5)"; toast.style.pointerEvents = "none"; toast.style.transition = "opacity 0.3s ease";
  document.body.appendChild(toast); setTimeout(() => { toast.style.opacity = "0"; }, 1200); setTimeout(() => { toast.remove(); }, 1500);
}
window.addEventListener("DOMContentLoaded", initPlayer);

// ==========================================
// 🎬 CINEMA SWIPE ENGINE (Strict Safe Volume)
// ==========================================
const videoWrapper = document.querySelector('.video-wrapper'); const gestureFeedback = document.getElementById('gestureFeedback');
let lastTapTime = 0; let touchStartY = 0; let isRightSideSwipe = false; let gestureTimer;
function showGestureFeedback(t) { if (!gestureFeedback) return; gestureFeedback.innerText = t; gestureFeedback.style.opacity = '1'; clearTimeout(gestureTimer); gestureTimer = setTimeout(() => { gestureFeedback.style.opacity = '0'; }, 600); }

videoWrapper.addEventListener('touchend', (e) => {
  if (e.target.closest('.vjs-control-bar') || e.target.closest('.vjs-big-play-button') || e.target.closest('.resume-prompt')) return;
  if (e.changedTouches.length !== 1) return;
  const currentTime = new Date().getTime(); const tapLength = currentTime - lastTapTime;
  if (tapLength < 300 && tapLength > 0) {
    const videoRect = videoWrapper.getBoundingClientRect();
    if ((e.changedTouches[0].clientX - videoRect.left) > videoRect.width / 2) { let nTime = Math.min(player.duration(), player.currentTime() + 10); player.currentTime(nTime); showGestureFeedback("⏩ +10s"); pulsePlayer(); } 
    else { let nTime = Math.max(0, player.currentTime() - 10); player.currentTime(nTime); showGestureFeedback("⏪ -10s"); pulsePlayer(); }
    e.preventDefault();
  }
  lastTapTime = currentTime;
});
videoWrapper.addEventListener('touchstart', (e) => {
  if (e.target.closest('.vjs-control-bar') || e.target.closest('.vjs-big-play-button') || e.target.closest('.resume-prompt')) return;
  if (e.touches.length !== 1) return;
  touchStartY = e.touches[0].clientY; const videoRect = videoWrapper.getBoundingClientRect();
  isRightSideSwipe = (e.touches[0].clientX - videoRect.left) > (videoRect.width * 0.7);
}, { passive: true });

videoWrapper.addEventListener('touchmove', (e) => {
  if (!isRightSideSwipe || e.touches.length !== 1) return; e.preventDefault();
  const touchCurrentY = e.touches[0].clientY; 
  let delta = (touchStartY - touchCurrentY) * 0.006; 
  let nVol = Math.max(0, Math.min(1, player.volume() + delta)); 
  
  player.volume(nVol); 
  touchStartY = touchCurrentY; 
  showGestureFeedback(`🔊 ${Math.round(nVol * 100)}%`);
}, { passive: false });
