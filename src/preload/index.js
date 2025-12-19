import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  closeWindow: () => ipcRenderer.invoke('close-window'),
  setWallpaper: (imageName) => ipcRenderer.invoke('set-wallpaper', imageName),
  openCmdSpam: () => ipcRenderer.invoke('open-cmd-spam'),
  countAnimationFrames: (animationName) => ipcRenderer.invoke('count-animation-frames', animationName),
  getVideoPath: (videoName) => ipcRenderer.invoke('get-video-path', videoName),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
