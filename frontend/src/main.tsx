import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ProvedorAuth } from './lib/auth'
import { ProvedorConfig } from './lib/config'
import { ProvedorAvisos } from './components/ui'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (tentativas, erro) => {
        const status = (erro as { status?: number }).status
        if (status && status >= 400 && status < 500) return false
        return tentativas < 2
      },
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProvedorAuth>
          <ProvedorConfig>
            <ProvedorAvisos>
              <App />
            </ProvedorAvisos>
          </ProvedorConfig>
        </ProvedorAuth>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
