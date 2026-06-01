let bingeData = null;
let activeVideoKey = ""; // Used to track this exact video in LocalStorage
let savedResumeTime = 0; // Temporarily holds the time the user left off

const player = videojs('videoPlayer', { controls: true, autoplay: false, preload: 'auto', fluid: true, responsive: true });

const loadingScreen = document.getElementById("loadingScreen");
const bufferLoader = document.getElementById("bufferLoader");
const playBtn = document.getElementById("playPauseBtn");
const playerCardContainer = document.getElementById("playerCardContainer");
const liveBadge = document.getElementById("liveBadge");
let badgeTimeout;

// ---------------- INITIALIZE PLAYER ----------------
function initPlayer() {
  const urlParams = new URLSearchParams(window.location.search);
  const dataParam = urlParams.get('data');
  const linkParam = urlParams.get('link'); 

  if (dataParam) {
    try {
      sessionStorage.setItem("secureStreamData", dataParam);
      let decodedStr = "";
      try { decodedStr = atob(dataParam); } catch(e) { decodedStr = dataParam; }
      bingeData = JSON.parse(decodeURIComponent(escape(decodedStr)));
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
      console.error("Failed to parse stream data.", e);
    }
  } 
  else if (linkParam) {
    bingeData = { currentIndex: 0, playlist: [ linkParam ] };
  } 
  else {
    let rawData = sessionStorage.getItem("secureStreamData");
    if (rawData) {
      try {
        let decodedStr = "";
        try { decodedStr = atob(rawData); } catch(e) { decodedStr = rawData; }
        bingeData = JSON.parse(decodeURIComponent(escape(decodedStr)));
      } catch(e) {}
    }
  }

  if (!bingeData || !bingeData.playlist || bingeData.playlist.length === 0) {
    showToast("Stream link missing! Go back to the Hub.");
    return;
  }
  loadVideoByIndex(bingeData.currentIndex);
}

// ---------------- LOAD SPECIFIC EPISODE ----------------
function loadVideoByIndex(index) {
  if (index < 0 || index >= bingeData.playlist.length) return;
  bingeData.currentIndex = index;
  const currentItem = bingeData.playlist[index];
  let link = typeof currentItem === "string" ? currentItem : currentItem.url;

  try { if (!link.startsWith("http")) link = atob(link); } catch(e) {}

  // Set the unique key for LocalStorage tracking based on the video URL
  activeVideoKey = link.substring(link.length - 40); 

  let type = "video/mp4";
  if (link.includes(".m3u8")) type = "application/x-mpegURL";
  else if (link.includes(".mpd")) type = "application/dash+xml";
  else if (link.includes(".mkv")) type = "video/x-matroska";

  if (loadingScreen) loadingScreen.style.display = "flex";
  if (bufferLoader) bufferLoader.classList.add("show");
  
  player.src({ src: link, type: type });

  player.play().then(() => {
    if (loadingScreen) loadingScreen.style.display = "none";
    if (bufferLoader) bufferLoader.classList.remove("show");
  }).catch(e => {
    if (loadingScreen) loadingScreen.style.display = "none";
  });

  buildEpisodeRow();
}

// ---------------- BUILD EPISODE UI ROW ----------------
function buildEpisodeRow() {
  const container = document.getElementById("episodeContainer");
  if (!container) return;
  if (bingeData.playlist.length <= 1) { container.style.display = "none"; return; }

  container.style.display = "block";
  let html = "";
  bingeData.playlist.forEach((item, i) => {
    let label = `Episode ${i + 1}`;
    if (typeof item === "object" && item.episode) label = item.episode; 
    else if (typeof item === "object" && item.size) label = `Watch (${item.size}${item.unit})`;
    const isActive = (i === bingeData.currentIndex) ? "active" : "";
    html += `<button class="ep-btn ${isActive}" onclick="loadVideoByIndex(${i})">${label}</button>`;
  });
  container.innerHTML = html;

  setTimeout(() => {
    const activeBtn = container.querySelector('.active');
    if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, 100);
}

// ---------------- PLAY / PAUSE & VOL CONTROLS ----------------
function togglePlay() { player.paused() ? (player.play(), showToast("Playing")) : (player.pause(), showToast("Paused")); }
function increaseVolume() { player.volume(Math.min(player.volume() + 0.1, 1.0)); showToast("Volume: " + Math.round(player.volume() * 100) + "%"); }
function decreaseVolume() { player.volume(Math.max(player.volume() - 0.1, 0.0)); showToast("Volume: " + Math.round(player.volume() * 100) + "%"); }
function skipForward() { player.currentTime(player.currentTime() + 10); pulsePlayer(); showToast("+10 Seconds"); }
function skipBackward() { player.currentTime(player.currentTime() - 10); pulsePlayer(); showToast("-10 Seconds"); }

// ---------------- HARD FORCED WEB-FULLSCREEN OVERRIDE ----------------
function toggleFullscreen() {
  if (!playerCardContainer) return;
  const isWebFS = playerCardContainer.classList.contains("web-fullscreen");
  const fsBtn = document.querySelector("button[onclick='toggleFullscreen()']");
  
  if (!isWebFS) {
    playerCardContainer.classList.add("web-fullscreen");
    showToast("Fullscreen Enabled");
    if (fsBtn) fsBtn.innerHTML = "🔳 Exit Fullscreen";
    if (playerCardContainer.requestFullscreen) playerCardContainer.requestFullscreen().catch(() => {});
    else if (playerCardContainer.webkitRequestFullscreen) playerCardContainer.webkitRequestFullscreen().catch(() => {});
  } else {
    playerCardContainer.classList.remove("web-fullscreen");
    showToast("Fullscreen Disabled");
    if (fsBtn) fsBtn.innerHTML = "🔲 Fullscreen";
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen().catch(() => {});
  }
}

// 🔥 BUG FIX: THIS CATCHES THE "ESC" KEY EXIT EVENT!
document.addEventListener('fullscreenchange', () => {
  const isNativeFs = document.fullscreenElement || document.webkitFullscreenElement;
  const isWebFs = playerCardContainer.classList.contains("web-fullscreen");
  
  // If the browser exited fullscreen natively (via ESC), but our CSS still thinks it's open, fix it!
  if (!isNativeFs && isWebFs) {
    playerCardContainer.classList.remove("web-fullscreen");
    const fsBtn = document.querySelector("button[onclick='toggleFullscreen()']");
    if (fsBtn) fsBtn.innerHTML = "🔲 Fullscreen";
  }
});

// FORCE PICTURE-IN-PICTURE (PiP)
async function togglePiP() {
  const techVideo = player.tech({ IWillNotUseThisInApp: true }) ? player.tech().el_ : null;
  if (!techVideo) return showToast("Video tech layer loading...");
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (document.pictureInPictureEnabled) await techVideo.requestPictureInPicture();
    else if (techVideo.webkitSetPresentationMode) techVideo.webkitSetPresentationMode(techVideo.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture");
    else showToast("PiP restricted by this mobile app environment");
  } catch (error) { playerCardContainer.classList.toggle("web-fullscreen"); }
}

// ---------------- RELIABLE BADGE TIMER TIMEOUTS ----------------
function hideBadgeAfterDelay() {
  if (!liveBadge) return;
  clearTimeout(badgeTimeout);
  badgeTimeout = setTimeout(() => { if (!player.paused()) liveBadge.classList.add("hidden"); }, 3000);
}
function showBadge() {
  if (!liveBadge) return;
  clearTimeout(badgeTimeout);
  liveBadge.classList.remove("hidden");
}

player.on("play", () => { if (playBtn) playBtn.innerHTML = "⏸ Pause"; showBadge(); hideBadgeAfterDelay(); });
player.on("pause", () => { if (playBtn) playBtn.innerHTML = "⏯ Play"; showBadge(); });
player.on("seeking", () => { showBadge(); hideBadgeAfterDelay(); });

const speedControl = document.getElementById("speedControl");
if (speedControl) {
  speedControl.addEventListener("change", (e) => { player.playbackRate(Number(e.target.value)); showToast("Speed: " + e.target.value + "x"); });
}

function copyStreamLink() {
  if (!bingeData) return;
  let scrambledPayload = "";
  try { scrambledPayload = btoa(unescape(encodeURIComponent(JSON.stringify(bingeData)))); } 
  catch(e) { scrambledPayload = btoa(JSON.stringify(bingeData)); }
  const shareableUrl = window.location.origin + window.location.pathname + "?data=" + encodeURIComponent(scrambledPayload);
  navigator.clipboard.writeText(shareableUrl);
  showToast("Full Season Link Copied!");
}

// ---------------- SMART RESUME ENGINE 🔥 ----------------
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function showResumePrompt(timeInSeconds) {
  savedResumeTime = timeInSeconds;
  const prompt = document.getElementById('resumePrompt');
  const display = document.getElementById('resumeTimeDisplay');
  if(prompt && display) {
    display.innerText = formatTime(timeInSeconds);
    prompt.classList.add('show');
    // Hide it automatically if they ignore it for 10 seconds
    setTimeout(() => { dismissResume(); }, 10000);
  }
}

function executeResume() {
  player.currentTime(savedResumeTime);
  player.play();
  dismissResume();
  showToast("Resumed playback");
}

function dismissResume() {
  const prompt = document.getElementById('resumePrompt');
  if(prompt) prompt.classList.remove('show');
}

// Check for saved time when video data is ready
player.on('loadedmetadata', () => {
  if (loadingScreen) loadingScreen.style.display = "none";
  showToast("Premium Stream Ready");
  hideBadgeAfterDelay();

  // Load from local storage
  const history = JSON.parse(localStorage.getItem('ntm_watch_history')) || {};
  if (history[activeVideoKey] && history[activeVideoKey] > 10) {
    // Make sure they aren't basically at the end of the movie/credits
    if (history[activeVideoKey] < player.duration() - 30) {
      showResumePrompt(history[activeVideoKey]);
    }
  }
});

// Silently auto-save their progress every 5 seconds
player.on('timeupdate', () => {
  const currentTime = player.currentTime();
  if (currentTime > 5 && Math.floor(currentTime) % 5 === 0) {
    const history = JSON.parse(localStorage.getItem('ntm_watch_history')) || {};
    history[activeVideoKey] = currentTime;
    localStorage.setItem('ntm_watch_history', JSON.stringify(history));
  }
});

player.on("waiting", () => { if (bufferLoader) bufferLoader.classList.add("show"); });
player.on("playing", () => { if (bufferLoader) bufferLoader.classList.remove("show"); });
player.on("ended", () => { showToast("Playback Finished"); showBadge(); });
player.on("error", () => { if (loadingScreen) loadingScreen.style.display = "none"; if (bufferLoader) bufferLoader.classList.remove("show"); showToast("Error: Video link broken or unsupported."); });

// ---------------- KEYBOARD SHORTCUTS ----------------
document.addEventListener("keydown", (e) => {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.code === "ArrowRight") skipForward();
  if (e.code === "ArrowLeft") skipBackward();
  if (e.code === "ArrowUp") { e.preventDefault(); increaseVolume(); }
  if (e.code === "ArrowDown") { e.preventDefault(); decreaseVolume(); }
  if (e.key.toLowerCase() === "f") { e.preventDefault(); toggleFullscreen(); }
});

function pulsePlayer() {
  if (!playerCardContainer) return;
  playerCardContainer.style.transform = "scale(1.005)";
  setTimeout(() => { playerCardContainer.style.transform = "scale(1)"; }, 150);
}

function showToast(text) {
  const oldToast = document.querySelector(".custom-toast");
  if (oldToast) oldToast.remove();
  const toast = document.createElement("div");
  toast.className = "custom-toast";
  toast.innerText = text;
  toast.style.position = "fixed";
  toast.style.bottom = "30px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.padding = "14px 22px";
  toast.style.borderRadius = "14px";
  toast.style.background = "rgba(0,0,0,0.85)";
  toast.style.backdropFilter = "blur(10px)";
  toast.style.color = "white";
  toast.style.zIndex = "999999";
  toast.style.fontSize = "14px";
  toast.style.boxShadow = "0 4px 20px rgba(0,0,0,0.5)";
  toast.style.pointerEvents = "none";
  toast.style.transition = "opacity 0.3s ease";
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; }, 1200);
  setTimeout(() => { toast.remove(); }, 1500);
}

window.addEventListener("DOMContentLoaded", initPlayer);

// ==========================================
// 🎬 CINEMA SWIPE ENGINE
// ==========================================
const videoWrapper = document.querySelector('.video-wrapper');
const gestureFeedback = document.getElementById('gestureFeedback');
let lastTapTime = 0; let touchStartY = 0; let isRightSideSwipe = false; let gestureTimer;

function showGestureFeedback(text) {
  if (!gestureFeedback) return;
  gestureFeedback.innerText = text;
  gestureFeedback.style.opacity = '1';
  clearTimeout(gestureTimer);
  gestureTimer = setTimeout(() => { gestureFeedback.style.opacity = '0'; }, 600);
}

videoWrapper.addEventListener('touchend', (e) => {
  if (e.target.closest('.vjs-control-bar') || e.target.closest('.vjs-big-play-button') || e.target.closest('.resume-prompt')) return;
  if (e.changedTouches.length !== 1) return;
  const currentTime = new Date().getTime();
  const tapLength = currentTime - lastTapTime;

  if (tapLength < 300 && tapLength > 0) {
    const touchX = e.changedTouches[0].clientX;
    const videoRect = videoWrapper.getBoundingClientRect();
    const relativeX = touchX - videoRect.left;

    if (relativeX > videoRect.width / 2) {
      let newTime = Math.min(player.duration(), player.currentTime() + 10);
      player.currentTime(newTime);
      showGestureFeedback("⏩ +10s");
      pulsePlayer(); 
    } else {
      let newTime = Math.max(0, player.currentTime() - 10);
      player.currentTime(newTime);
      showGestureFeedback("⏪ -10s");
      pulsePlayer();
    }
    e.preventDefault(); 
  }
  lastTapTime = currentTime;
});

videoWrapper.addEventListener('touchstart', (e) => {
  if (e.target.closest('.vjs-control-bar') || e.target.closest('.vjs-big-play-button') || e.target.closest('.resume-prompt')) return;
  if (e.touches.length !== 1) return;
  
  const touchX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  const videoRect = videoWrapper.getBoundingClientRect();
  const relativeX = touchX - videoRect.left;
  isRightSideSwipe = relativeX > (videoRect.width * 0.7);
}, { passive: true }); 

videoWrapper.addEventListener('touchmove', (e) => {
  if (!isRightSideSwipe || e.touches.length !== 1) return;
  e.preventDefault(); 
  const touchCurrentY = e.touches[0].clientY;
  const deltaY = touchStartY - touchCurrentY; 
  const sensitivity = 0.006; 
  let currentVol = player.volume();
  let newVolume = currentVol + (deltaY * sensitivity);
  newVolume = Math.max(0, Math.min(1, newVolume));
  player.volume(newVolume);
  touchStartY = touchCurrentY;
  const volPercent = Math.round(newVolume * 100);
  showGestureFeedback(`🔊 ${volPercent}%`);
}, { passive: false });
