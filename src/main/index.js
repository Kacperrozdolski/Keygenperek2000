import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { execSync, exec } from 'child_process'
import icon from '../../resources/icon.png?asset'

// Store dialog windows
let dialogWindows = new Map()

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    resizable: false,
    frame: false,
    transparent: false,
    devtool: true,
    sign: false,
    show: false,
    alwaysOnTop: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
    // Remove always on top after window is shown and focused
    setTimeout(() => {
      mainWindow.setAlwaysOnTop(false)
    }, 200)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Minimize all windows immediately when app is ready (before creating our window)
  try {
    if (process.platform === 'win32') {
      // Windows - minimize all windows
      execSync(
        'powershell.exe -Command "$shell = New-Object -ComObject Shell.Application; $shell.MinimizeAll()"',
        { windowsHide: true }
      )
    } else if (process.platform === 'darwin') {
try {
      // We target "visible" processes and exclude "Electron" (or your App Name)
      // "visible is true" prevents the script from trying to hide background system services
      const hideScript = `
        tell application "System Events"
          set currentAppName to name of first process whose frontmost is true
          set visible of every process whose (visible is true and name is not currentAppName) to false
        end tell
      `;
      execSync(`osascript -e '${hideScript}'`, { stdio: 'ignore' });
    } catch (error) {
      // If permissions aren't granted, we use the "Hide Others" keyboard shortcut as a fallback
      try {
        execSync(`osascript -e 'tell application "System Events" to keystroke "h" using {command down, option down}'`);
      } catch (fallbackError) {
        console.log('Window minimization failed: Accessibility permissions may be required.');
      }
    }
    } else if (process.platform === 'linux') {
      // Linux - try to minimize all windows (requires wmctrl)
      try {
        execSync('wmctrl -k on', { stdio: 'ignore' })
      } catch {
        // Fallback: try xdotool
        try {
          execSync('xdotool search --onlyvisible --class "" windowminimize %@', { stdio: 'ignore' })
        } catch {
          console.log('No window minimization method available on this Linux system')
        }
      }
    }
  } catch (error) {
    console.error('Failed to minimize windows:', error)
  }

  electronApp.setAppUserModelId('com.perek2000.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('close-window', () => {
    app.quit()
  })

  // Dialog IPC handlers
  ipcMain.handle('show-dialog', (event, options) => {
    const { dialogId } = createDialog(options)
    return dialogId
  })

  ipcMain.handle('close-dialog', (event, dialogId) => {
    const dialogWindow = dialogWindows.get(dialogId)
    if (dialogWindow && !dialogWindow.isDestroyed()) {
      dialogWindow.close()
    }
  })

  ipcMain.handle('dialog-button-clicked', (event, dialogId, buttonIndex, buttonText) => {
    const dialogWindow = dialogWindows.get(dialogId)
    if (dialogWindow && !dialogWindow.isDestroyed()) {
      // Send result back to main window
      const mainWindow = BrowserWindow.getAllWindows().find(win =>
        !dialogWindows.has(win.id.toString()) && !win.isDestroyed()
      )
      if (mainWindow) {
        mainWindow.webContents.send('dialog-result', {
          dialogId,
          buttonIndex,
          buttonText,
          result: buttonText
        })
      }
      dialogWindow.close()
    }
  })

  ipcMain.handle('get-dialog-info', (event, dialogId) => {
    if (global.dialogInfo && global.dialogInfo[dialogId]) {
      return global.dialogInfo[dialogId]
    }
    return null
  })

  ipcMain.handle('resize-dialog-to-content', (event, dialogId, width, height) => {
    const dialogWindow = dialogWindows.get(dialogId)
    if (dialogWindow && !dialogWindow.isDestroyed()) {
      // Add some padding and minimum sizes
      const newWidth = Math.max(width + 40, 300)
      const newHeight = Math.max(height + 60, 150) // Extra for title bar

      dialogWindow.setSize(newWidth, newHeight)
      dialogWindow.center() // Re-center after resize
      return { success: true }
    }
    return { success: false }
  })

  // Handle video path resolution for production
  ipcMain.handle('get-video-path', (event, videoName) => {
    if (is.dev) {
      // In development, return the public path
      return `/videos/${videoName}`
    } else {
      // In production, return path to extraResources
      const fs = require('fs')
      const path = require('path')
      const videoPath = path.join(process.resourcesPath, 'videos', videoName)

      // Check if video exists and return file:// URL
      if (fs.existsSync(videoPath)) {
        return `file://${videoPath.replace(/\\/g, '/')}`
      } else {
        console.error('Video not found:', videoPath)
        return null
      }
    }
  })

  ipcMain.handle('set-wallpaper', async (event, imageName) => {
    try {
      const fs = require('fs')
      const path = require('path')

      let imagePath = null
      const possiblePaths = [
        // Production paths (when packaged)
        path.join(process.resourcesPath, imageName),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', imageName),
        // Development paths - images folder
        path.join(__dirname, '../renderer/assets/images', imageName),
        path.join(__dirname, '../../src/renderer/assets/images', imageName),
        path.join(process.cwd(), 'src/renderer/assets/images', imageName),
        // Development paths - animation folder (singular)
        path.join(__dirname, '../renderer/assets/animation', imageName),
        path.join(__dirname, '../../src/renderer/assets/animation', imageName),
        path.join(process.cwd(), 'src/renderer/assets/animation', imageName),
        // Development paths - animations folder (plural)
        path.join(__dirname, '../renderer/assets/animations', imageName),
        path.join(__dirname, '../../src/renderer/assets/animations', imageName),
        path.join(process.cwd(), 'src/renderer/assets/animations', imageName),
        // Direct path for renderer assets folder (most common in dev)
        path.join(__dirname, '../../src/renderer/assets', imageName),
        path.join(process.cwd(), 'src/renderer/assets', imageName),
        // Additional fallback paths
        path.join(__dirname, '../../resources', imageName),
        path.join(process.cwd(), 'resources', imageName)
      ]

      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          imagePath = testPath
          break
        }
      }

      if (!imagePath) {
        console.log('image not found:', imageName)
      }

      const absolutePath = path.resolve(imagePath)

      if (process.platform === 'win32') {
        const tempScriptPath = path.join(require('os').tmpdir(), `set_strobe_wallpaper_${Date.now()}.ps1`)
        const scriptContent = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Wallpaper {
    [DllImport("user32.dll", CharSet=CharSet.Auto)]
    public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
[Wallpaper]::SystemParametersInfo(20, 0, "${absolutePath}", 3)
`

        fs.writeFileSync(tempScriptPath, scriptContent)
        const command = `powershell.exe -ExecutionPolicy Bypass -File "${tempScriptPath}"`

        return new Promise((resolve) => {
          exec(command, (error, stdout, stderr) => {
            // Clean up temp file
            try {
              fs.unlinkSync(tempScriptPath)
            } catch (cleanupError) {
              console.log('Failed to cleanup temp script:', cleanupError.message)
            }

            if (error) {
              resolve({ success: false, error: error.message })
            } else {
              resolve({ success: true, path: absolutePath })
            }
          })
        })
      }else if (process.platform === 'darwin') {
      // macOS Implementation
      const script = `osascript -e 'tell application "System Events" to tell every desktop to set picture to POSIX file "${absolutePath}"'`;

      return new Promise((resolve) => {
        exec(script, (error) => {
          if (error) resolve({ success: false, error: error.message });
          else resolve({ success: true, path: absolutePath });
        });
      });
    }

    return { success: false, error: 'Platform not supported' }
  } catch (error) {
    return { success: false, error: error.message }
  }
  })

  // Handle close app request
  ipcMain.on('close-app', () => {
    app.quit()
  })

  // Handle frame count detection
  ipcMain.handle('count-animation-frames', async (event, animationName) => {
    try {
      const fs = require('fs')
      const path = require('path')

      const possibleBasePaths = [
        path.join(process.resourcesPath, 'animations', animationName),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'animations', animationName),
        path.join(__dirname, '../../src/renderer/assets/animations', animationName),
        path.join(process.cwd(), 'src/renderer/assets/animations', animationName),
      ]

      let animationFolder = possibleBasePaths.find(p => fs.existsSync(p))
      if (!animationFolder) return { success: false, frameCount: 0 }

      const files = fs.readdirSync(animationFolder)
      const frameFiles = files.filter(f => f.startsWith('frame_') && f.endsWith('.png'))
      return { success: true, frameCount: frameFiles.length }
    } catch (error) {
      return { success: false, frameCount: 0, error: error.message }
    }
  })

  // Handle CMD window spam functionality
  ipcMain.handle('open-cmd-spam', async () => {
    if( process.platform !== 'win32') {
    try {
      const cmdProcesses = []

      // Function to create PowerShell positioning command
      const createPositioningCommand = (title, x, y, width, height) => {
        return `powershell -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/k title ${title} & mode con: cols=60 lines=20 & echo === ${title} === & for /l %i in (1,1,9999999) do @(dir C:\\ /s /a & tree C:\\ /f & ping localhost -n 2 >nul)' -WindowStyle Normal; Start-Sleep -Milliseconds 400; $w = Get-Process -Name cmd | Where-Object {$_.MainWindowTitle -like '*${title}*'}; if ($w) { Add-Type -Name Window -Namespace Console -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int width, int height, uint uFlags);'; [Console.Window]::SetWindowPos($w.MainWindowHandle, 0, ${x}, ${y}, ${width}, ${height}, 0x0040) }"`
      }

      // Define commands with explicit positions for 1920x1080 display
      const commands = [
        createPositioningCommand('CMD1', 0, 0, 480, 270),           // Top-Left
        createPositioningCommand('CMD2', 1440, 0, 480, 270),        // Top-Right
        createPositioningCommand('CMD3', 0, 540, 480, 270),         // Bottom-Left
        createPositioningCommand('CMD4', 1440, 540, 480, 270),      // Bottom-Right
        createPositioningCommand('CMD5', 480, 0, 480, 270),         // Top-Center-Left
        createPositioningCommand('CMD6', 960, 0, 480, 270),         // Top-Center-Right
        createPositioningCommand('CMD7', 480, 540, 480, 270),       // Bottom-Center-Left
        createPositioningCommand('CMD8', 960, 540, 480, 270),       // Bottom-Center-Right
        createPositioningCommand('CMD9', 240, 270, 480, 270),       // Center-Left
        createPositioningCommand('CMD10', 1200, 270, 480, 270),     // Center-Right
        createPositioningCommand('CMD11', 720, 135, 480, 270),      // Center-Top
        createPositioningCommand('CMD12', 720, 405, 480, 270)       // Center-Bottom
      ]

      // Execute all commands with small delays to ensure they open properly
      commands.forEach((command, i) => {
        setTimeout(() => {
          const cmd = exec(command, (error) => {
            if (error) {
              console.error(`CMD ${i + 1} positioning error:`, error.message)
            } else {
              console.log(`CMD window ${i + 1} opened and positioned`)
            }
          })
          cmdProcesses.push(cmd)
        }, i * 200) // 200ms delay between each for better positioning
      })

      setTimeout(() => {
        try {
          exec('taskkill /f /im cmd.exe', (error) => {
            if (error) {
              console.error('Error closing CMD windows:', error)
            } else {
              console.log('All CMD windows closed')
            }
          })
        } catch (closeError) {
          console.error('Failed to close CMD windows:', closeError)
        }
      }, 5000) // 5 seconds duration for the waterfall effect

      return { success: true, message: 'CMD spam initiated with PowerShell positioning' }
    } catch (error) {
      return { success: false, error: error.message }
    } }
    else if (process.platform === 'darwin') {
      const script = `osascript -e 'tell application "Terminal"
        repeat 6 times
            do script "echo === SYSTEM BREACH ===; find /usr/share -name *.png"
            delay 0.2
        end repeat
      end tell'`
      exec(script)
      setTimeout(() => exec('osascript -e "tell application \\"Terminal\\" to quit"'), 5000)
      return { success: true }
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
