import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { lang } from './i18n.ts'
import { initAnalytics } from './lib/analytics.ts'

document.documentElement.lang = lang;
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
