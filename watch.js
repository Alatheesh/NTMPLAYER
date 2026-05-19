const player = videojs(
  'videoPlayer',
  {
    controls: true,
    autoplay: false,
    preload: 'auto',
    fluid: true,
    responsive: true
  }
);

// ELEMENTS
const loadingScreen = document.getElementById("loadingScreen");
const bufferLoader = document.getElementById("bufferLoader");
const playBtn = document.getElementById("playPauseBtn");
const playerCardContainer = document.getElementById("playerCardContainer");
const liveBadge = document.getElementById("liveBadge");

let badgeTimeout;

// ---------------- START STREAMING ----------------
function startStreaming() {
  const params = new URLSearchParams(location.search);
  const link = params.get("link");

  if (!link) {
    showToast("No stream link found");
    return;
  }

  let type = "video/mp4";

  // STREAM TYPE
  if (link.includes(".m3u8")) {
    type = "application/x-mpegURL";
  }
  else if (link.includes(".mpd")) {
    type = "application/dash+xml";
  }
  else if (link.includes(".mkv")) {
    type = "video/x-matroska";
  }

  // LOAD PLAYER
  player.src({
    src: link,
    type: type
  });
}

// ---------------- PLAY / PAUSE ----------------
function togglePlay() {
  if (player.paused()) {
    player.play();
    showToast("Playing");
  }
  else {
    player.pause();
    showToast("Paused");
  }
}

// ---------------- VOLUME CONTROLS ----------------
function increaseVolume() {
  let currentVol = player.volume();
  player.volume(Math.min(currentVol + 0.1, 1.0));
  
  showToast("Volume: " + Math.round(player.volume() * 100) + "%");
}

function decreaseVolume() {
  let currentVol = player.volume();
  player.volume(Math.max(currentVol - 0.1, 0.0));
  
  showToast("Volume: " + Math.round(player.volume() * 100) + "%");
}

// ---------------- SKIP CONTROLS ----------------
function skipForward() {
  player.currentTime(player.currentTime() + 10);
  pulsePlayer();
  showToast("+10 Seconds");
}

function skipBackward() {
  player.currentTime(player.currentTime() - 10);
  pulsePlayer();
  showToast("-10 Seconds");
}

// ---------------- FULLSCREEN CONTROL & MOBILE FALLBACK ----------------
function toggleFullscreen() {
  if (!playerCardContainer) return;

  // Check if standard browser supports native element fullscreen tracking
  if (!player.isFullscreen()) {
    if (playerCardContainer.requestFullscreen) {
      playerCardContainer.requestFullscreen();
    } else if (playerCardContainer.webkitRequestFullscreen) { /* Safari/iOS Mobile */
      playerCardContainer.webkitRequestFullscreen();
    } else {
      // WebView Fallback Framework implementation for restrictive layers (Telegram App)
      playerCardContainer.classList.toggle("web-fullscreen");
    }
  } else {
    player.exitFullscreen();
  }
}

// Intercept clicks directly inside the custom control bar to enforce alternative mobile styling
player.on('fullscreenchange', () => {
  if (!player.isFullscreen()) {
    // Scrub alternative view overrides if exit flags are encountered
    playerCardContainer.classList.remove("web-fullscreen");
  }
});

// ---------------- DYNAMIC BADGE FADE LOGIC ----------------
function showAndQueueFadeBadge() {
  if (!liveBadge) return;
  
  clearTimeout(badgeTimeout);
  liveBadge.classList.remove("hidden"); // Instantly unhide asset
  
  // Sets countdown execution logic to fade away cleanly after 3 seconds
  badgeTimeout = setTimeout(() => {
    if (!player.paused()) {
      liveBadge.classList.add("hidden");
    }
  }, 3000);
}

// ---------------- PLAYBACK SPEED ----------------
const speedControl = document.getElementById("speedControl");
if (speedControl) {
  speedControl.addEventListener("change", (e) => {
    player.playbackRate(Number(e.target.value));
    showToast("Speed: " + e.target.value + "x");
  });
}

// ---------------- UTILITY ACCELERATORS ----------------
function copyStreamLink() {
  navigator.clipboard.writeText(location.href);
  showToast("Stream link copied");
}

function openExternalPlayer() {
  const params = new URLSearchParams(location.search);
  const link = params.get("link");
  if (link) window.open(link);
}

// ---------------- PLAYER EVENT CONTROLLERS ----------------
player.on('loadedmetadata', () => {
  if (loadingScreen) loadingScreen.style.display = "none";
  showToast("Premium Stream Ready");
});

player.on("waiting", () => {
  if (bufferLoader) bufferLoader.classList.add("show");
});

player.on("playing", () => {
  if (bufferLoader) bufferLoader.classList.remove("show");
});

// Player Hook Actions mapped directly to tracking overlay components
player.on("play", () => {
  if (playBtn) playBtn.innerHTML = "⏸ Pause";
  showAndQueueFadeBadge();
});

player.on("pause", () => {
  if (playBtn) playBtn.innerHTML = "⏯ Play";
  if (liveBadge) liveBadge.classList.remove("hidden"); // Always unhide badge when paused
});

player.on("seeking", showAndQueueFadeBadge);

player.on("ended", () => {
  showToast("Playback Finished");
  if (liveBadge) liveBadge.classList.remove("hidden");
});

// ---------------- KEYBOARD SHORTCUTS ----------------
document.addEventListener("keydown", (e) => {
  // If user is focused inside input elements, don't execute player shortcuts
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;

  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
  if (e.code === "ArrowRight") {
    skipForward();
  }
  if (e.code === "ArrowLeft") {
    skipBackward();
  }
  if (e.code === "ArrowUp") {
    e.preventDefault();
    increaseVolume();
  }
  if (e.code === "ArrowDown") {
    e.preventDefault();
    decreaseVolume();
  }
  if (e.key.toLowerCase() === "f") {
    e.preventDefault();
    toggleFullscreen();
  }
});

// ---------------- VISUAL TRANSFORM ACCELERATOR ----------------
function pulsePlayer() {
  if (!playerCardContainer) return;
  playerCardContainer.style.transform = "scale(1.005)";
  setTimeout(() => {
    playerCardContainer.style.transform = "scale(1)";
  }, 150);
}

// ---------------- PREMIUM TOAST INJECTOR ----------------
function showToast(text) {
  const toast = document.createElement("div");
  toast.innerText = text;

  toast.style.position = "fixed";
  toast.style.bottom = "30px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.padding = "14px 22px";
  toast.style.borderRadius = "14px";
  toast.style.background = "rgba(0,0,0,0.72)";
  toast.style.backdropFilter = "blur(10px)";
  toast.style.webkitBackdropFilter = "blur(10px)";
  toast.style.color = "white";
  toast.style.zIndex = "99999";
  toast.style.fontSize = "14px";
  toast.style.boxShadow = "0 0 25px rgba(0,0,0,0.5)";
  toast.style.pointerEvents = "none";
  toast.style.transition = "opacity 0.4s ease";

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
  }, 1200);

  setTimeout(() => {
    toast.remove();
  }, 1600);
}

// ---------------- AUTO RUN ----------------
window.addEventListener("DOMContentLoaded", startStreaming);
