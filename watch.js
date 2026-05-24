// 🚀 GLOBAL BINGE-WATCH DATA & VIDEO.JS INIT
let bingeData = null;

const player = videojs('videoPlayer', {
  controls: true,
  autoplay: false,
  preload: 'auto',
  fluid: true,
  responsive: true
});

const playBtn = document.getElementById("playPauseBtn");
const playerCardContainer = document.getElementById("playerCardContainer");
const liveBadge = document.getElementById("liveBadge");

let badgeTimeout;

function initPlayer() {
  const urlParams = new URLSearchParams(window.location.search);
  const dataParam = urlParams.get('data');
  const linkParam = urlParams.get('link');

  if (dataParam) {
    try {
      sessionStorage.setItem("secureStreamData", dataParam);

      let decodedStr = "";
      try {
        decodedStr = atob(dataParam);
      } catch (e) {
        decodedStr = dataParam;
      }

      bingeData = JSON.parse(decodeURIComponent(escape(decodedStr)));
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
      console.error("Failed to parse stream data", e);
    }
  } else if (linkParam) {
    bingeData = {
      currentIndex: 0,
      playlist: [linkParam]
    };
  } else {
    let rawData = sessionStorage.getItem("secureStreamData");

    if (rawData) {
      try {
        let decodedStr = "";

        try {
          decodedStr = atob(rawData);
        } catch (e) {
          decodedStr = rawData;
        }

        bingeData = JSON.parse(decodeURIComponent(escape(decodedStr)));
      } catch (e) {}
    }
  }

  if (!bingeData || !bingeData.playlist || bingeData.playlist.length === 0) {
    showToast("Stream link missing!");
    return;
  }

  loadVideoByIndex(bingeData.currentIndex);
}

function loadVideoByIndex(index) {
  if (index < 0 || index >= bingeData.playlist.length) return;

  bingeData.currentIndex = index;
  const currentItem = bingeData.playlist[index];

  let link = typeof currentItem === "string" ? currentItem : currentItem.url;

  try {
    if (!link.startsWith("http")) {
      link = atob(link);
    }
  } catch (e) {
    console.error("Link decode failed", e);
  }

  let type = "video/mp4";

  if (link.includes(".m3u8")) {
    type = "application/x-mpegURL";
  } else if (link.includes(".mpd")) {
    type = "application/dash+xml";
  }

  player.src({
    src: link,
    type: type
  });

  buildEpisodeRow();
}

function buildEpisodeRow() {
  const container = document.getElementById("episodeContainer");

  if (!container) return;

  if (bingeData.playlist.length <= 1) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  let html = "";

  bingeData.playlist.forEach((item, i) => {
    let label = `Episode ${i + 1}`;

    if (typeof item === "object" && item.episode) {
      label = item.episode;
    }

    const isActive = i === bingeData.currentIndex ? "active" : "";

    html += `<button class="ep-btn ${isActive}" onclick="loadVideoByIndex(${i})">${label}</button>`;
  });

  container.innerHTML = html;
}

function togglePlay() {
  if (player.paused()) {
    player.play();
    showToast("Playing");
  } else {
    player.pause();
    showToast("Paused");
  }
}

function increaseVolume() {
  player.volume(Math.min(player.volume() + 0.1, 1));
}

function decreaseVolume() {
  player.volume(Math.max(player.volume() - 0.1, 0));
}

function skipForward() {
  player.currentTime(player.currentTime() + 10);
}

function skipBackward() {
  player.currentTime(player.currentTime() - 10);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    player.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

async function togglePiP() {
  const techVideo = player.tech().el_;

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await techVideo.requestPictureInPicture();
    }
  } catch (e) {
    console.error(e);
  }
}

function hideBadgeAfterDelay() {
  clearTimeout(badgeTimeout);

  badgeTimeout = setTimeout(() => {
    if (!player.paused()) {
      liveBadge.classList.add("hidden");
    }
  }, 3000);
}

function showBadge() {
  liveBadge.classList.remove("hidden");
}

player.on("play", () => {
  if (playBtn) playBtn.innerHTML = "⏸ Pause";
  showBadge();
  hideBadgeAfterDelay();
});

player.on("pause", () => {
  if (playBtn) playBtn.innerHTML = "⏯ Play";
  showBadge();
});

const speedControl = document.getElementById("speedControl");

if (speedControl) {
  speedControl.addEventListener("change", (e) => {
    player.playbackRate(Number(e.target.value));
  });
}

function copyStreamLink() {
  navigator.clipboard.writeText(window.location.href);
  showToast("Stream Link Copied!");
}

player.on("loadedmetadata", () => {
  showToast("Premium Stream Ready");
});

player.on("error", () => {
  showToast("Video failed to load");
});

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
  toast.style.color = "white";
  toast.style.zIndex = "999999";

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 1500);
}

window.addEventListener("DOMContentLoaded", initPlayer);