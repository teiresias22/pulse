import { StrictMode } from 'react'
document.documentElement.lang = navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
