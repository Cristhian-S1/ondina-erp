import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MantineProvider } from '@mantine/core'
import { BrowserRouter } from 'react-router-dom'

import './index.css'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'

import App from './App.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { crearMutationCacheObservable } from './lib/observabilidad'

const queryClient = new QueryClient({
  mutationCache: crearMutationCacheObservable(),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!, {
  // The boundary logs only allowlisted correlation metadata; suppress React's raw caught-error log.
  onCaughtError: () => {},
}).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </MantineProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
