const statusText=document.getElementById("status");
const debugBox=document.getElementById("debugBox");
const languageSelect=document.getElementById("languageSelect");

// DEBUG LOGGER

function logDebug(text){
  console.log(text);
  debugBox.innerHTML += "\n" + text;
}

// AUDIO PLAYER

const audioPlayer=new Audio();

audioPlayer.crossOrigin="anonymous";
audioPlayer.preload="auto";

// VIDEO PLAYER

const player=videojs(
  'videoPlayer',
  {
    controls:true,
    autoplay:false,
    preload:'auto',
    fluid:true,
    responsive:true
  }
);

// AUDIO STORAGE

let audioLinks=[];

// START STREAM

function startStreaming(){

  const params=
  new URLSearchParams(location.search);

  const link=
  params.get("link");

  const audiosRaw=
  params.get("audios");

  try{

    const parsedAudios=
    JSON.parse(
      decodeURIComponent(
        audiosRaw || "[]"
      )
    );

    audioLinks=
    parsedAudios.map(item=>{

      const parts=
      item.split("|");

      return{
        lang:parts[0],
        url:parts[1]
      };

    });

  }

  catch(error){

    logDebug(
      "Audio parse failed"
    );

    audioLinks=[];

  }

  if(!link){

    alert(
      "No video link found ❌"
    );

    return;

  }

  debugBox.innerHTML="";

  statusText.innerText=
  "Loading stream...";

  logDebug(
    "Loading stream..."
  );

  logDebug(
    "VIDEO LINK:"
  );

  logDebug(link);

  logDebug(
    "RAW AUDIOS:"
  );

  logDebug(audiosRaw);

  logDebug(
    "PARSED AUDIOS:"
  );

  audioLinks.forEach(audio=>{

    logDebug(
      audio.lang +
      " → " +
      audio.url
    );

  });

  let type=
  "video/mp4";

  if(link.includes(".m3u8")){

    type=
    "application/x-mpegURL";

  }

  else if(link.includes(".mpd")){

    type=
    "application/dash+xml";

  }

  else if(link.includes(".mkv")){

    type=
    "video/x-matroska";

  }

  logDebug(
    "Detected type: " +
    type
  );

  player.src({
    src:link,
    type:type
  });

  player.ready(()=>{

    player.muted(true);

    statusText.innerText=
    "Video loaded ✅";

    logDebug(
      "Player ready."
    );

    inspectTracks();

    buildLanguageSelector();

    setupSync();

    if(audioLinks.length > 0){

      loadAudio(
        audioLinks[0]
      );

    }

  });

  player.on('error',()=>{

    const error=
    player.error();

    statusText.innerText=
    "⚠ Video failed";

    logDebug(
      "Player Error: " +
      JSON.stringify(error)
    );

  });

}

// BUILD LANGUAGE SELECTOR

function buildLanguageSelector(){

  if(!languageSelect)
  return;

  languageSelect.innerHTML="";

  audioLinks.forEach(audio=>{

    const option=
    document.createElement(
      "option"
    );

    option.value=
    audio.url;

    option.textContent=
    audio.lang;

    languageSelect.appendChild(
      option
    );

  });

}

// LOAD AUDIO

async function loadAudio(audioObj){

  if(!audioObj)
  return;

  try{

    const currentTime=
    player.currentTime();

    audioPlayer.pause();

    audioPlayer.src=
    audioObj.url;

    logDebug(
      "TRYING AUDIO:"
    );

    logDebug(
      audioObj.url
    );

    audioPlayer.onerror=()=>{

      logDebug(
        "AUDIO LOAD FAILED"
      );

    };

    audioPlayer.oncanplay=()=>{

      logDebug(
        "AUDIO CAN PLAY"
      );

    };

    audioPlayer.load();

    audioPlayer.onloadedmetadata=
    async ()=>{

      audioPlayer.currentTime=
      currentTime;

      if(!player.paused()){

        await audioPlayer.play();

      }

      logDebug(
        "Audio changed to: " +
        audioObj.lang
      );

    };

  }

  catch(error){

    logDebug(
      "Audio switch failed: " +
      error.message
    );

  }

}

// LANGUAGE SWITCH

if(languageSelect){

  languageSelect.addEventListener(
    "change",
    ()=>{

      const selected=
      audioLinks.find(
        a =>
        a.url ===
        languageSelect.value
      );

      if(selected){

        loadAudio(
          selected
        );

      }

    }
  );

}

// SYNC ENGINE

function setupSync(){

  player.on('play',()=>{

    audioPlayer.play();

    logDebug(
      "Playback started."
    );

  });

  player.on('pause',()=>{

    audioPlayer.pause();

    logDebug(
      "Playback paused."
    );

  });

  player.on('seeking',()=>{

    audioPlayer.currentTime=
    player.currentTime();

    logDebug(
      "Syncing seek..."
    );

  });

  player.on('waiting',()=>{

    audioPlayer.pause();

    logDebug(
      "Buffering..."
    );

  });

  player.on('playing',()=>{

    audioPlayer.play();

    logDebug(
      "Playing resumed."
    );

  });

  setInterval(()=>{

    const diff=
    Math.abs(
      player.currentTime() -
      audioPlayer.currentTime
    );

    if(diff > 0.5){

      audioPlayer.currentTime=
      player.currentTime();

      logDebug(
        "Audio resynced."
      );

    }

  },1000);

}

// TRACK CHECK

function inspectTracks(){

  try{

    const textTracks=
    player.textTracks();

    logDebug(
      "TextTracks object: " +
      (!!textTracks)
    );

    if(textTracks){

      logDebug(
        "Subtitle track count: " +
        textTracks.length
      );

    }

  }

  catch(error){

    logDebug(
      "Track inspection failed: " +
      error.message
    );

  }

}

// EVENTS

player.on('loadedmetadata',()=>{

  logDebug(
    "loadedmetadata fired."
  );

  inspectTracks();

});

player.on('dispose',()=>{

  audioPlayer.pause();

  logDebug(
    "Player disposed."
  );

});
