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

// Native Video Element Hook for WebView stability
const nativeVideo = document.getElementById("videoPlayer_html5_api") || document.querySelector("#videoPlayer video");

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

  if (link.includes(".m3u8")) {
    type = "application/x-mpegURL";
  }
  else if (link.includes(".mpd")) {
    type = "application/dash+xml";
  }
  else if (link.includes(".mkv")) {
    type = "video/x-matroska";
  }

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

// ---------------- HARD FORCED TELEGRAM FULLSCREEN & PiP WORKAROUND ----------------
function toggleFullscreen() {
  if (!playerCardContainer) return;

  // Force Telegram mobile to toggle the Web-Fullscreen CSS override directly
  const isWebFS = playerCardContainer.classList.contains("web-fullscreen");
  
  if (!isWebFS) {
    playerCardContainer.classList.add("web-fullscreen");
    showToast("Web Fullscreen Enabled");
    
    // Attempt native fullscreen backup call simultaneously
    if (playerCardContainer.requestFullscreen) {
      playerCardContainer.requestFullscreen().catch(() => {});
    } else if (playerCardContainer.webkitRequestFullscreen) {
      playerCardContainer.webkitRequestFullscreen().catch(() => {});
    }
  } else {
    playerCardContainer.classList.remove("web-fullscreen");
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen().catch(() => {});
    }
  }
}

// NATIVE PICTURE-IN-PICTURE (PiP) FORCE FOR MOBILE
async function togglePiP() {
  if (!nativeVideo) return;
  
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled || nativeVideo.webkitSupportsPresentationMode) {
      if (nativeVideo.requestPictureInPicture) {
        await nativeVideo.requestPictureInPicture();
      } else if (nativeVideo.webkitSetPresentationMode) {
        // Fallback for iOS/Safari WebViews inside apps
        nativeVideo.webkitSetPresentationMode(nativeVideo.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture");
      }
    } else {
      showToast("PiP not supported by this app browser");
    }
  } catch (error) {
    console.error("PiP Error:", error);
    // If native PiP crashes inside Telegram, fallback to a compact floating side-view look
    playerCardContainer.classList.toggle("web-fullscreen");
  }
}

// ---------------- HARD BADGE FADE LOGIC (NATIVE TRIGGER) ----------------
function hideBadge() {
  if (!liveBadge) return;
  clearTimeout(badgeTimeout);
  
  badgeTimeout = setTimeout(() => {
    // Check native element state to make sure it didn't pause during the 3 seconds
    const isPaused = nativeVideo ? nativeVideo.paused : player.paused();
    if (!isPaused) {
      liveBadge.classList.add("hidden");
    }
  }, 3000);
}

function showBadge() {
  if (!liveBadge) return;
  clearTimeout(badgeTimeout);
  liveBadge.classList.remove("hidden");
}

// HOOK DIRECTLY TO NATIVE LAUNCH EVENTS (Bypasses Video.js abstraction drops)
if (nativeVideo) {
  nativeVideo.addEventListener("play", () => {
    if (playBtn) playBtn.innerHTML = "⏸ Pause";
    showBadge();
    hideBadge();
  });

  nativeVideo.addEventListener("pause", () => {
    if (playBtn) playBtn.innerHTML = "⏯ Play";
    showBadge();
  });

  nativeVideo.addEventListener("seeking", () => {
    showBadge();
    hideBadge();
  });
}

// ---------------- PLAYBACK SPEED ----------------
const speedControl = document.getElementById("speedControl");
if (speedControl) {
  speedControl.addEventListener("change", (e) => {
    player.playbackRate(Number(e.target.value));
    showToast("Speed: " + e.target.value + "x");
  });
}

// ---------------- UTILITY CONTROLS ----------------
function copyStreamLink() {
  navigator.clipboard.writeText(location.href);
  showToast("Stream link copied");
}

function openExternalPlayer() {
  const params = new URLSearchParams(location.search);
  const link = params.get("link");
  if (link) window.open(link);
}

// ---------------- PLAYER RENDERING LIFE EVENTS ----------------
player.on('loadedmetadata', () => {
  if (loadingScreen) loadingScreen.style.display = "none";
  showToast("Premium Stream Ready");
  // Queue baseline badge fade out right at startup if autoplay triggers
  hideBadge();
});

player.on("waiting", () => {
  if (bufferLoader) bufferLoader.classList.add("show");
});

player.on("playing", () => {
  if (bufferLoader) bufferLoader.classList.remove("show");
});

player.on("ended", () => {
  showToast("Playback Finished");
  showBadge();
});

// ---------------- KEYBOARD SHORTCUTS ----------------
document.addEventListener("keydown", (e) => {
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
  toast.style.webkitBackdropFilter = "blur(10px)";
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

window.addEventListener("DOMContentLoaded", startStreaming);
