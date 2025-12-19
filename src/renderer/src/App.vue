<template>
  <div class="keygen">
    <div class="title-bar">
      <div class="keygen-topbar-icon">
        <img src="../assets/images/icon.png" />
      </div>
      <p class="title-bar-text">perek2000 experience program executable</p>

      <div class="title-bar-controls">
        <button aria-label="Close" @click="closeWindow"></button>
      </div>
    </div>

    <div class="keygen-window content-container">
      <div class="keygen-media-wrapper">
        <video
          ref="videoRef"
          :src="resolvedVideoPath"
          style="width: 100%; height: 100%; object-fit: cover"
        ></video>
      </div>
    </div>

    <div class="keygen-form">
      <div class="wrapper">
        <div class="field-row">
          <label for="text21">Artysta:</label>
          <input id="text21" disabled type="text" value="perek2000" />
        </div>

        <div class="field-row">
          <label for="text21">Album:</label>
          <input id="text21" disabled type="text" value="experience" />
        </div>
      </div>

      <div class="item">
        <label>Wybierz piosenkę:</label>
        <select :value="selectedVideo" @change="changeVideo">
          <option
            v-for="(config, index) in videoConfigs"
            :key="index"
            :value="index"
          >
            {{ config.name }}
          </option>
        </select>
      </div>

      <div class="field-row">
        <label for="range22">Volume:</label>
        <label for="range23">Low</label>
        <input
          id="range23"
          type="range"
          min="1"
          max="11"
          :value="volume"
          @input="updateVolume"
        />
        <label for="range24">High</label>

        <button class="default" :disabled="!isPlaying" @click="stopVideo">
          Stop
        </button>
        <button class="default" :disabled="isPlaying" @click="startVideo">
          Start
        </button>
      </div>

      <div class="field-row-stacked">
        <label for="text20">Additional notes</label>
        <textarea id="text20" rows="5">
„experience” to introspektywna podróż. Łączy elektroniczne brzmienia z rytualnym, mistycznym klimatem. Teksty i dźwięki krążą wokół pamięci, błędu, napięcia i głosu, który dopiero uczy się brzmieć. To opowieść o byciu pomiędzy.</textarea
        >
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, nextTick } from "vue";

const volume = ref(5);
const isPlaying = ref(false);
const selectedVideo = ref(0);
const videoRef = ref(null);
const resolvedVideoPath = ref("");
let activeAnimationTimeouts = [];
let triggeredAnimations = new Set();

// Track current animation state for pause/resume
let currentAnimationState = {
  isRunning: false,
  currentFrame: 0,
  totalFrames: 0,
  animationName: null,
  config: null,
};

const videoConfigs = {
  0: {
    name: "hello?o sobie",
    video: "dialog_1.mp4",
    animations: [
      { startTime: 0, animation: () => wallpaperAnimation() },
      { startTime: 4, animation: () => sendingAnimation() },
      { startTime: 20, animation: () => promptAnimation() },
      { startTime: 55, animation: () => pigeonAnimation() },
      { startTime: 98, animation: () => strobeAnimation() },
      { startTime: 104, animation: () => openCmdSpam() },
    ],
  },
  1: {
    name: "where are you?",
    video: "poezja_1.mp4",
    animations: [],
  },
  2: {
    name: "ambience",
    video: "dialog_2.mp4",
    animations: [
      { startTime: 1, animation: () => beingAnimation() },
      { startTime: 17, animation: () => whipeAnimation() },
      { startTime: 29, animation: () => selfAnimation() },
      { startTime: 49, animation: () => figureAnimation() },
      { startTime: 58, animation: () => griefAnimation() },
    ],
  },
  3: {
    name: "meta-inf",
    video: "poezja_2.mp4",
    animations: [],
  },
  4: {
    name: "2b2t",
    video: "dialog_3.mp4",
    animations: [
      { startTime: 0, animation: () => humanAnimation() },
      { startTime: 7, animation: () => voiceAnimation() },
      { startTime: 16, animation: () => overloadAnimation() },
      { startTime: 24, animation: () => overwhelmAnimation() },
      { startTime: 31, animation: () => structureAnimation() },
      { startTime: 39, animation: () => noreturnAnimation() },
    ],
  },
  5: {
    name: "corrupted blood 2005",
    video: "poezja_3.mp4",
    animations: [],
  },
  6: {
    name: "infinite loop",
    video: "dialog_4.mp4",
    animations: [
      { startTime: 0, animation: () => dialog4Animation() },
    ],
  },
  7: {
    name: "system32",
    video: "poezja_4.mp4",
    animations: [],
  },
  8: {
    name: "chng de world",
    video: "dialog_5.mp4",
    animations: [
      { startTime: 0, animation: () => dialog5Animation() },
    ],
  },
  9: {
    name: "error 404",
    video: "dialog_6.mp4",
    animations: [
      { startTime: 0, animation: () => dialog6Animation() },
    ],
  },
};

const runFrameAnimation = async (config, startFromFrame = 0) => {
  const { frameTimeMs, animationName, getFrameName } = config;
  console.log("🎬 Running animation:", { frameTimeMs, animationName, startFromFrame });

  if (!window.api || !window.api.setWallpaper) {
    console.error("❌ window.api.setWallpaper not available!");
    return;
  }

  if (!window.api.countAnimationFrames) {
    console.error("❌ window.api.countAnimationFrames not available!");
    return;
  }

  let frameCount = 100;

  try {
    const result = await window.api.countAnimationFrames(animationName);
    if (result.success) {
      frameCount = result.frameCount;
      console.log(`Auto-detected ${frameCount} frames for ${animationName}`);
    } else {
      console.warn(
        `Failed to detect frames for ${animationName}, using fallback:`,
        result.error
      );
    }
  } catch (error) {
    console.error(`Error detecting frames for ${animationName}:`, error);
  }

  if (!frameCount || frameCount <= 0) frameCount = 100;

  // Set up animation state for pause/resume
  currentAnimationState = {
    isRunning: true,
    currentFrame: startFromFrame,
    totalFrames: frameCount,
    animationName: animationName,
    config: config,
  };

  for (let i = startFromFrame; i < frameCount; i++) {
    const timeout = setTimeout(() => {
      // Update current frame
      currentAnimationState.currentFrame = i;
      
      if (i === frameCount - 1) {
        console.log("Setting final wallpaper");
        window.api.setWallpaper("wallpaper.png");
        currentAnimationState.isRunning = false;
      } else {
        const frameName = getFrameName(i);
        console.log(`Setting frame ${i}: ${frameName}`);
        window.api.setWallpaper(frameName);
      }
    }, (i - startFromFrame) * frameTimeMs);
    activeAnimationTimeouts.push(timeout);
  }
};

function makeAnimationConfig(name) {
  return {
    frameTimeMs: 150,
    animationName: name,
    getFrameName: (i) => `animations/${name}/frame_${i}.png`,
  };
}

const animationConfigs = {
  strobe: makeAnimationConfig("strobe"),
  pigeon: makeAnimationConfig("pigeon"),
  prompt: makeAnimationConfig("prompt"),
  sending: makeAnimationConfig("sending"),
  wallpaper: makeAnimationConfig("wallpaper"),
  truman: makeAnimationConfig("truman"),
  being: makeAnimationConfig("being"),
  whipe: makeAnimationConfig("whipe"),
  figure: makeAnimationConfig("figure"),
  self: makeAnimationConfig("self"),
  grief: makeAnimationConfig("grief"),
  human: makeAnimationConfig("human"),
  noreturn: makeAnimationConfig("noreturn"),
  overload: makeAnimationConfig("overload"),
  overwhelm: makeAnimationConfig("overwhelm"),
  structure: makeAnimationConfig("structure"),
  voice: makeAnimationConfig("voice"),
  dialog4: makeAnimationConfig("dialog4"),
  dialog5: makeAnimationConfig("dialog5"),
  dialog6: makeAnimationConfig("dialog6"),
};

const strobeAnimation = () => runFrameAnimation(animationConfigs.strobe);
const pigeonAnimation = () => runFrameAnimation(animationConfigs.pigeon);
const promptAnimation = () => runFrameAnimation(animationConfigs.prompt);
const sendingAnimation = () => runFrameAnimation(animationConfigs.sending);
const wallpaperAnimation = () => runFrameAnimation(animationConfigs.wallpaper);
const beingAnimation = () => runFrameAnimation(animationConfigs.being);
const whipeAnimation = () => runFrameAnimation(animationConfigs.whipe);
const selfAnimation = () => runFrameAnimation(animationConfigs.self);
const griefAnimation = () => runFrameAnimation(animationConfigs.grief);
const figureAnimation = () => runFrameAnimation(animationConfigs.figure);
const humanAnimation = () => runFrameAnimation(animationConfigs.human);
const noreturnAnimation = () => runFrameAnimation(animationConfigs.noreturn);
const overloadAnimation = () => runFrameAnimation(animationConfigs.overload);
const overwhelmAnimation = () => runFrameAnimation(animationConfigs.overwhelm);
const structureAnimation = () => runFrameAnimation(animationConfigs.structure);
const voiceAnimation = () => runFrameAnimation(animationConfigs.voice);
const dialog4Animation = () => runFrameAnimation(animationConfigs.dialog4);
const dialog5Animation = () => runFrameAnimation(animationConfigs.dialog5);
const dialog6Animation = () => runFrameAnimation(animationConfigs.dialog6);

const startAnimation = (animationConfig) => {
  activeAnimationTimeouts.forEach((timeout) => clearTimeout(timeout));
  activeAnimationTimeouts = [];
  animationConfig.animation();
};

const openCmdSpam = async () => {
  try {
    if (window.api && window.api.openCmdSpam) {
      const result = await window.api.openCmdSpam();
      if (result.success) {
        console.log("CMD spam started successfully");
      } else {
        console.error("CMD spam failed:", result.error);
      }
    } else {
      console.error("CMD spam API not available");
    }
  } catch (error) {
    console.error("Error starting CMD spam:", error);
  }
};

const handleVideoTimeUpdate = (event) => {
  const currentTime = event.target.currentTime;
  const currentConfig = videoConfigs[selectedVideo.value];

  // Only trigger animation if video is actually playing
  if (!isPlaying.value) return;

  if (currentConfig.animations && currentConfig.animations.length > 0) {
    currentConfig.animations.forEach((animation, index) => {
      const animationKey = `${selectedVideo.value}-${index}`;
      if (
        currentTime >= animation.startTime &&
        !triggeredAnimations.has(animationKey)
      ) {
        console.log(
          `Triggering animation at ${currentTime.toFixed(2)}s for "${
            currentConfig.name
          }"`
        );
        triggeredAnimations.add(animationKey);
        startAnimation(animation);
      }
    });
  }
};

onMounted(async () => {
  try {
    if (window.api && window.api.setWallpaper) console.log("Attempting to set wallpaper...");
    localStorage.setItem("keygenperek-has-run", "true");
  } catch (error) {
    console.error("Error setting wallpaper:", error);
  }

  await loadVideo(selectedVideo.value, true);
});

const onVideoEnd = async () => {
  const currentIndex = selectedVideo.value;
  const videoKeys = Object.keys(videoConfigs).map((key) => parseInt(key));
  const currentPos = videoKeys.indexOf(currentIndex);

  if (currentPos + 1 < videoKeys.length) {
    const nextIndex = videoKeys[currentPos + 1];
    selectedVideo.value = nextIndex;
    await loadVideo(nextIndex, true);
  }
};

const loadVideo = async (videoIndex, shouldPlay = false) => {
  activeAnimationTimeouts.forEach((timeout) => clearTimeout(timeout));
  activeAnimationTimeouts = [];
  triggeredAnimations.clear();
  
  currentAnimationState = {
    isRunning: false,
    currentFrame: 0,
    totalFrames: 0,
    animationName: null,
    config: null,
  };
  
  if (window.api && window.api.setWallpaper) {
    window.api.setWallpaper("wallpaper.png");
  }

  const currentConfig = videoConfigs[videoIndex];
  if (window.api && window.api.getVideoPath) {
    try {
      const path = await window.api.getVideoPath(currentConfig.video);
      if (path) {
        resolvedVideoPath.value = path;
        console.log(`Resolved video path: ${path}`);
      } else {
        console.error(
          `Failed to resolve path for video: ${currentConfig.video}`
        );
        return;
      }
    } catch (error) {
      console.error("Error resolving video path:", error);
      return;
    }
  } else {
    resolvedVideoPath.value = currentConfig.video;
  }

  if (videoRef.value) {
    videoRef.value.removeEventListener("ended", onVideoEnd);
    videoRef.value.removeEventListener("timeupdate", handleVideoTimeUpdate);
    videoRef.value.removeEventListener("play", () => {
      isPlaying.value = true;
    });
    videoRef.value.removeEventListener("pause", () => {
      isPlaying.value = false;
    });
  }

  await nextTick();

  if (videoRef.value) {
    videoRef.value.volume = volume.value / 11;
    videoRef.value.currentTime = 0;

    videoRef.value.addEventListener("ended", onVideoEnd);
    videoRef.value.addEventListener("play", () => {
      isPlaying.value = true;
    });
    videoRef.value.addEventListener("pause", () => {
      isPlaying.value = false;
    });
    videoRef.value.addEventListener("timeupdate", handleVideoTimeUpdate);

    if (shouldPlay) {
      try {
        await videoRef.value.play();
        isPlaying.value = true;
      } catch (error) {
        console.log("Failed to play video:", error);
      }
    } else {
      videoRef.value.pause();
      isPlaying.value = false;
    }
  }
};

const changeVideo = async (event) => {
  const wasPlaying = isPlaying.value;
  selectedVideo.value = parseInt(event.target.value);
  await loadVideo(selectedVideo.value, wasPlaying);
};

const closeWindow = () => {
  if (window.api && window.api.closeWindow) {
    window.api.closeWindow();
  }
};

const updateVolume = (event) => {
  volume.value = parseInt(event.target.value);
  if (videoRef.value) {
    videoRef.value.volume = volume.value / 11;
  }
};

const stopVideo = () => {
  if (videoRef.value) {
    videoRef.value.pause();
    isPlaying.value = false;
  }
  
  // Pause animation - clear timeouts but keep frame state
  activeAnimationTimeouts.forEach((timeout) => clearTimeout(timeout));
  activeAnimationTimeouts = [];
  
  if (currentAnimationState.isRunning) {
    console.log(`Paused animation "${currentAnimationState.animationName}" at frame ${currentAnimationState.currentFrame}`);
  }
};

const startVideo = async () => {
  if (videoRef.value) {
    try {
      await videoRef.value.play();
      isPlaying.value = true;
      
      // Resume animation from where it left off
      if (currentAnimationState.isRunning && currentAnimationState.currentFrame > 0) {
        console.log(`Resuming animation "${currentAnimationState.animationName}" from frame ${currentAnimationState.currentFrame}`);
        runFrameAnimation(currentAnimationState.config, currentAnimationState.currentFrame);
      }
    } catch (error) {
      console.log("Failed to play video:", error);
    }
  }
};
</script>

<style scoped>
.keygen {
  width: 100%;
  height: 100vh;
  background-color: #070707;
  color: white;
  display: flex;
  flex-direction: column;
}

.keygen-topbar {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.keygen-topbar-icon {
  width: 32px;
  height: 32px;
}

.keygen-window {
  margin: 16px;
  position: relative;
  display: flex;
  background: black;
  justify-content: center;
  overflow: hidden;
  border-left: 1px solid white;
  border-right: 1px solid white;
  height: auto;
}

.keygen-media-wrapper {
  aspect-ratio: 16/9;
  width: 100%;
  max-width: 640px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.keygen-form {
  height: 120px;
  margin: 0 16px auto 16px;
  display: flex;
  gap: 16px;
  flex-direction: column;
}

.keygen-form .item {
  display: flex;
  align-items: center;
  gap: 8px;

  label {
    white-space: nowrap;
  }

  select {
    width: 100%;
  }
}

.wrapper .field-row {
  display: grid;
  grid-template-columns: 40px auto;
  margin-top: 10px;
}

.keygen-footer {
  width: 100%;
  border-top: 2px solid black;
}

:deep(.title-bar) {
  justify-content: unset !important;
  padding: unset;
  padding: 0 8px;
  gap: 8px;
  background: linear-gradient(90deg, #090909, #0b0b0b);
  -webkit-app-region: drag;
}

:deep(.title-bar-controls) {
  -webkit-app-region: no-drag;
}

:deep(.title-bar-text) {
  font-weight: bold;
  margin-right: auto;
  color: white;
}

@keyframes rainbow-scroll {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0% 0;
  }
}
.content-container::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;

  background: repeating-linear-gradient(
    to right,
    #ff0000,
    #ff8000 12%,
    #ffff00 24%,
    #00ff00 36%,
    #00ffff 48%,
    #0000ff 60%,
    #ff00ff 72%,
    #ff0000 84%
  );

  background-size: 200% 100%;

  animation: rainbow-scroll 5s infinite;
}
.content-container::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: repeating-linear-gradient(
    to left,
    #ff0000,
    #ff8000 12%,
    #ffff00 24%,
    #00ff00 36%,
    #00ffff 48%,
    #0000ff 60%,
    #ff00ff 72%,
    #ff0000 84%
  );
  background-size: 200% 100%;
  animation: rainbow-scroll 5s infinite;
}

textarea {
  resize: none;
  pointer-events: none !important;
}

img {
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

textarea,
input,
select,
button,
label {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

* {
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
}

.marquee-container {
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  box-sizing: border-box;
}

.marquee-content {
  display: inline-block;
  animation: slide-left 20s linear infinite;
}

@keyframes slide-left {
  0% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(-100%);
  }
}
</style>
