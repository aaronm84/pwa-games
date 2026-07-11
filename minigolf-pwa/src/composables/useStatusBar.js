import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'

export function useStatusBar() {
  const isNative = Capacitor.isNativePlatform()

  async function setLightContent() {
    if (!isNative) return

    try {
      await StatusBar.setStyle({ style: Style.Light })
      await StatusBar.setOverlaysWebView({ overlay: true })
    } catch (error) {
      console.warn('Failed to set status bar style:', error)
    }
  }

  async function setDarkContent() {
    if (!isNative) return

    try {
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.setOverlaysWebView({ overlay: true })
    } catch (error) {
      console.warn('Failed to set status bar style:', error)
    }
  }

  async function show() {
    if (!isNative) return

    try {
      await StatusBar.show()
    } catch (error) {
      console.warn('Failed to show status bar:', error)
    }
  }

  async function hide() {
    if (!isNative) return

    try {
      await StatusBar.hide()
    } catch (error) {
      console.warn('Failed to hide status bar:', error)
    }
  }

  return {
    setLightContent,
    setDarkContent,
    show,
    hide,
  }
}
