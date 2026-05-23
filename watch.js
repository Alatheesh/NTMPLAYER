// 🚀 GLOBAL BINGE-WATCH DATA & VIDEO.JS INIT
let bingeData = null;

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

// ---------------- INITIALIZE PLAYER & GHOST URL TRICK ----------------
function initPlayer() {
  const urlParams = new URLSearchParams(window.location.search);
  const dataParam = urlParams.get('data');
  const linkParam = urlParams.get('link'); 

  if (dataParam) {
    try {
      // Save to sessionStorage so it survives page refreshes!
      sessionStorage.setItem("secureStreamData", dataParam);
      
      // Unscramble the Base64 package
      let decodedStr = "";
      try { decodedStr = atob(dataParam); } catch(e) { decodedStr = dataParam; }
      
      // Fix for special characters (like Telugu names)
      bingeData = JSON.parse(decodeURIComponent(escape(decodedStr)));

      // Erase '?data=' from the address bar instantly to keep it clean!
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
      console.error("Failed to parse stream data.", e);
    }
  } 
  else if (linkParam) {
    // If you paste ?link= directly into the browser, it plays it!
    bingeData = {
      currentIndex: 0,
      playlist: [ linkParam ]
    };
  } 
  else {
    // Failsafe: Grab from sessionStorage if they refresh the clean page
    let rawData = sessionStorage.getItem("secureStreamData");
    if (rawData) {
      try {
        let decodedStr = "";
        try { decodedStr = atob(rawData); } catch(e) { decodedStr = rawData; }
        bingeData = JSON.parse(decodeURIComponent(escape(decodedStr)));
      } catch(e) {}
    }
  }

  // If absolutely no data was found, warn them
  if (!bingeData || !bingeData.playlist || bingeData.playlist.length === 0) {
    showToast("Stream link missing! Go back to the Hub and select a movie.");
    return;
  }

  // Start the first/clicked episode
  loadVideoByIndex(bingeData.currentIndex);
}

// ---------------- LOAD SPECIFIC EPISODE ----------------
function loadVideoByIndex(index) {
  if (index < 0 || index >= bingeData.playlist.length) return;
  
  // Update current index
  bingeData.currentIndex = index;
  const currentItem = bingeData.playlist[index];
  
  // Extract URL (it might be a string or an object)
  let link = typeof currentItem === "string" ? currentItem : currentItem.url;

  // 🚀 THE FIX: UNSCRAMBLE THE LINK FOR NEW FILES!
  try {
    // If the link does not start with http, it is scrambled Base64! Unscramble it.
    if (!link.startsWith("http")) {
      link = atob(link);
    }
  } catch(e) {
    console.error("Link unscramble failed:", e);
  }

  // Determine file type automatically based on the UNSCRAMBLED link
  let type = "video/mp4";
  if (link.includes(".m3u8")) {
    type = "application/x-mpegURL";
  } else if (link.includes(".mpd")) {
    type = "application/dash+xml";
  } else if (link.includes(".mkv")) {
    type = "video/x-matroska";
  }

  if (loadingScreen) loadingScreen.style.display = "flex";
  if (bufferLoader) bufferLoader.classList.add("show");
  
  // Feed URL to Video.js
  player.src({
    src: link,
    type: type
  });

  player.play().then(() => {
    if (loadingScreen) loadingScreen.style.display = "none";
    if (bufferLoader) bufferLoader.classList.remove("show");
  }).catch(e => {
    console.log("Autoplay prevented, waiting for user interaction.");
    if (loadingScreen) loadingScreen.style.display = "none";
  });

  // Re-draw the Netflix Server Row to highlight the active episode
  buildEpisodeRow();
}

// ---------------- BUILD EPISODE UI ROW ----------------
function buildEpisodeRow() {
  const container = document.getElementById("episodeContainer");
  if (!container) return;

  // Hide the row completely if it's just a single movie
  if (bingeData.playlist.length <= 1) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  let html = "";

  bingeData.playlist.forEach((item, i) => {
    let label = `Episode ${i + 1}`;
    
    if (typeof item === "object" && item.episode) {
      label = item.episode; // e.g., "Ep 1"
    } else if (typeof item === "object" && item.size) {
      label = `Part ${i + 1} (${item.size}${item.unit})`;
    }

    const isActive = (i === bingeData.currentIndex) ? "active" : "";
    
    html += `<button class="ep-btn ${isActive}" onclick="loadVideoByIndex(${i})">${label}</button>`;
  });

  container.innerHTML = html;

  // Auto-scroll the row so the active episode button is perfectly in the center!
  setTimeout(() => {
    const activeBtn = container.querySelector('.active');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, 100);
}

// ---------------- PLAY / PAUSE ----------------
function togglePlay() {
  if (player.paused()) {
    player.play();
    showToast("Playing");
  } else {
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

// ---------------- HARD FORCED WEB-FULLSCREEN OVERRIDE & BUTTON TOGGLE ----------------
function toggleFullscreen() {
  if (!playerCardContainer) return;

  const isWebFS = playerCardContainer.classList.contains("web-fullscreen");
  const fsBtn = document.querySelector("button[onclick='toggleFullscreen()']");
  
  if (!isWebFS) {
    playerCardContainer.classList.add("web-fullscreen");
    showToast("Web Fullscreen Enabled");
    
    if (fsBtn) fsBtn.innerHTML = "🔳 Exit Fullscreen";
    
    if (playerCardContainer.requestFullscreen) {
      playerCardContainer.requestFullscreen().catch(() => {});
    } else if (playerCardContainer.webkitRequestFullscreen) {
      playerCardContainer.webkitRequestFullscreen().catch(() => {});
    }
  } else {
    playerCardContainer.classList.remove("web-fullscreen");
    showToast("Web Fullscreen Disabled");
    
    if (fsBtn) fsBtn.innerHTML = "🔲 Fullscreen";
    
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen().catch(() => {});
    }
  }
}

// FORCE PICTURE-IN-PICTURE (PiP) THROUGH VIDEO.JS INSTANCE
async function togglePiP() {
  const techVideo = player.tech({ IWillNotUseThisInApp: true }) ? player.tech().el_ : null;
  
  if (!techVideo) {
    showToast("Video tech layer loading...");
    return;
  }
  
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled) {
      await techVideo.requestPictureInPicture();
    } else if (techVideo.webkitSetPresentationMode) {
      techVideo.webkitSetPresentationMode(techVideo.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture");
    } else {
      showToast("PiP restricted by this mobile app environment");
    }
  } catch (error) {
    console.error("PiP Failure:", error);
    playerCardContainer.classList.toggle("web-fullscreen");
  }
}

// ---------------- RELIABLE BADGE TIMER TIMEOUTS ----------------
function hideBadgeAfterDelay() {
  if (!liveBadge) return;
  clearTimeout(badgeTimeout);
  
  badgeTimeout = setTimeout(() => {
    if (!player.paused()) {
      liveBadge.classList.add("hidden");
    }
  }, 3000);
}

function showBadge() {
  if (!liveBadge) return;
  clearTimeout(badgeTimeout);
  liveBadge.classList.remove("hidden");
}

// Synchronizing state transitions directly with core player interface listeners
player.on("play", () => {
  if (playBtn) playBtn.innerHTML = "⏸ Pause";
  showBadge();
  hideBadgeAfterDelay();
});

player.on("pause", () => {
  if (playBtn) playBtn.innerHTML = "⏯ Play";
  showBadge();
});

player.on("seeking", () => {
  showBadge();
  hideBadgeAfterDelay();
});

player.on("fullscreenchange", () => {
  const fsBtn = document.querySelector("button[onclick='toggleFullscreen()']");
  if (!player.isFullscreen()) {
    playerCardContainer.classList.remove("web-fullscreen");
    if (fsBtn) fsBtn.innerHTML = "🔲 Fullscreen";
  } else {
    if (fsBtn) fsBtn.innerHTML = "🔳 Exit Fullscreen";
  }
});

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
  if (!bingeData) return;
  
  // 🚀 FIXED: We package the ENTIRE season (playlist + current episode) into the share link!
  let scrambledPayload = "";
  
  try {
    // This safe encoding prevents errors if the movie name has Telugu/Unicode characters
    scrambledPayload = btoa(unescape(encodeURIComponent(JSON.stringify(bingeData))));
  } catch(e) {
    // Fallback just in case
    scrambledPayload = btoa(JSON.stringify(bingeData));
  }
  
  // Generate the Master Data URL instead of the single link URL
  const shareableUrl = window.location.origin + window.location.pathname + "?data=" + encodeURIComponent(scrambledPayload);
  
  navigator.clipboard.writeText(shareableUrl);
  showToast("Full Season Link Copied!");
}

// ---------------- HOOK LOAD LIFECYCLES ----------------
player.on('loadedmetadata', () => {
  if (loadingScreen) loadingScreen.style.display = "none";
  showToast("Premium Stream Ready");
  hideBadgeAfterDelay();
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

// 🚀 NEW: ERROR HANDLING
player.on("error", () => {
  if (loadingScreen) loadingScreen.style.display = "none";
  if (bufferLoader) bufferLoader.classList.remove("show");
  showToast("Error: Video link broken or unsupported.");
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

window.addEventListener("DOMContentLoaded", initPlayer);
