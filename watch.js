const statusText =
document.getElementById("status");

const debugBox =
document.getElementById("debugBox");

const languageSelect =
document.getElementById("languageSelect");


// DEBUG LOGGER

function logDebug(text){

  console.log(text);

  debugBox.innerHTML +=
  "\n" + text;
}


// AUDIO PLAYER

const audioPlayer =
new Audio();

audioPlayer.crossOrigin =
"anonymous";


// INIT VIDEO PLAYER

const player = videojs(
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

let audioLinks = {};


// START STREAM

function startStreaming(){

  const params =
  new URLSearchParams(location.search);

  const link =
  params.get("link");

  // DYNAMIC AUDIO LINKS

  const telugu =
  params.get("telugu");

  const hindi =
  params.get("hindi");

  const tamil =
  params.get("tamil");

  const english =
  params.get("english");


  // BUILD AUDIO OBJECT

  if(telugu){
    audioLinks.telugu = telugu;
  }

  if(hindi){
    audioLinks.hindi = hindi;
  }

  if(tamil){
    audioLinks.tamil = tamil;
  }

  if(english){
    audioLinks.english = english;
  }


  if(!link){

    alert("No video link found ❌");

    return;
  }

  debugBox.innerHTML = "";

  statusText.innerText =
  "Loading stream...";

  logDebug("Loading stream...");
  logDebug("URL received.");

  let type = "video/mp4";

  if(link.includes(".m3u8")){

    type =
    "application/x-mpegURL";
  }

  else if(link.includes(".mpd")){

    type =
    "application/dash+xml";
  }

  else if(link.includes(".mkv")){

    type =
    "video/x-matroska";
  }

  logDebug(
    "Detected type: " + type
  );

  player.src({
    src:link,
    type:type
  });

  player.ready(()=>{

    statusText.innerText =
    "Video loaded ✅";

    logDebug("Player ready.");

    inspectTracks();

    setupSync();

    // AUTO LOAD FIRST AUDIO

    const firstLanguage =
    Object.keys(audioLinks)[0];

    if(firstLanguage){

      loadAudio(firstLanguage);

      logDebug(
        "Default audio: " +
        firstLanguage
      );
    }

  });

  player.on('error',()=>{

    const error =
    player.error();

    statusText.innerText =
    "⚠ Video failed";

    logDebug(
      "Player Error: " +
      JSON.stringify(error)
    );
  });

}


// LOAD AUDIO

function loadAudio(language){

  const audioUrl =
  audioLinks[language];

  if(!audioUrl){

    logDebug(
      "Missing audio for: " +
      language
    );

    return;
  }

  const currentTime =
  player.currentTime();

  audioPlayer.src =
  audioUrl;

  audioPlayer.currentTime =
  currentTime;

  audioPlayer.play();

  logDebug(
    "Audio changed to: " +
    language
  );
}


// LANGUAGE SWITCH

if(languageSelect){

  languageSelect.addEventListener(
    "change",
    (e)=>{

      loadAudio(
        e.target.value
      );
    }
  );
}


// SYNC ENGINE

function setupSync(){

  // PLAY

  player.on('play',()=>{

    audioPlayer.play();

    logDebug(
      "Playback started."
    );
  });

  // PAUSE

  player.on('pause',()=>{

    audioPlayer.pause();

    logDebug(
      "Playback paused."
    );
  });

  // SEEK

  player.on('seeking',()=>{

    audioPlayer.currentTime =
    player.currentTime();

    logDebug(
      "Syncing seek..."
    );
  });

  // WAITING

  player.on('waiting',()=>{

    audioPlayer.pause();

    logDebug(
      "Buffering..."
    );
  });

  // PLAYING

  player.on('playing',()=>{

    audioPlayer.play();

    logDebug(
      "Playing resumed."
    );
  });

  // AUTO RESYNC

  setInterval(()=>{

    const diff =
    Math.abs(
      player.currentTime() -
      audioPlayer.currentTime
    );

    if(diff > 0.5){

      audioPlayer.currentTime =
      player.currentTime();

      logDebug(
        "Audio resynced."
      );
    }

  },1000);

}


// TRACK INSPECTION

function inspectTracks(){

  try{

    const textTracks =
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
