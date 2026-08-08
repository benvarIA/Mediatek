import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Widget de remontées Ameliorator — l'URL est machine-dépendante, elle n'a
// rien à faire dans un fichier suivi par git. Absente, le widget ne charge pas.
const amelio = import.meta.env.VITE_AMELIORATOR_URL
if (amelio) {
  const s = document.createElement('script')
  s.src = `${amelio.replace(/\/$/, '')}/widget.js`
  s.async = true
  document.head.appendChild(s)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
