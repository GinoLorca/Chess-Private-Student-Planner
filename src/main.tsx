import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// The service worker keeps the whole app on the device for offline use. With
// autoUpdate, a new version found on launch (or on the hourly check) installs
// and the page reloads itself, so an installed iPad app never sits on an old
// build.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    window.setInterval(() => registration.update().catch(() => undefined), 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
