import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { hasSupabaseConfig } from '../lib/supabase'

type AsyncState<T> = {
  data: T | null
  error: Error | null
  isLoading: boolean
  isRefreshing: boolean
  lastUpdated: Date | null
  isConfigured: boolean
}

type AsyncDataOptions = {
  refreshIntervalMs?: number
  refetchOnFocus?: boolean
}

export function useAsyncData<T>(
  loader: () => Promise<T>,
  dependencies: readonly unknown[] = [],
  options: AsyncDataOptions = {},
) {
  const { loading: authLoading, user } = useAuth()
  const userId = user?.id ?? null
  const [refreshIndex, setRefreshIndex] = useState(0)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: hasSupabaseConfig && authLoading,
    isRefreshing: false,
    lastUpdated: null,
    isConfigured: hasSupabaseConfig,
  })

  useEffect(() => {
    let isMounted = true

    if (!hasSupabaseConfig) {
      setState({ data: null, error: null, isLoading: false, isRefreshing: false, lastUpdated: null, isConfigured: false })
      return undefined
    }

    if (authLoading) {
      setState((current) => ({ ...current, isLoading: current.data === null, isRefreshing: current.data !== null, isConfigured: true }))
      return undefined
    }

    if (!userId) {
      setState({ data: null, error: null, isLoading: false, isRefreshing: false, lastUpdated: null, isConfigured: true })
      return undefined
    }

    setState((current) => ({ ...current, error: null, isLoading: current.data === null, isRefreshing: current.data !== null, isConfigured: true }))

    loader()
      .then((data) => {
        if (isMounted) {
          setState({ data, error: null, isLoading: false, isRefreshing: false, lastUpdated: new Date(), isConfigured: true })
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState((current) => ({
            data: current.data,
            error: error instanceof Error ? error : new Error('Unable to load data'),
            isLoading: false,
            isRefreshing: false,
            lastUpdated: current.lastUpdated,
            isConfigured: true,
          }))
        }
      })

    return () => {
      isMounted = false
    }
  }, [authLoading, userId, refreshIndex, ...dependencies])

  const reload = useCallback(() => setRefreshIndex((current) => current + 1), [])

  useEffect(() => {
    if (!hasSupabaseConfig || authLoading || !userId) return undefined

    const intervalMs = optionsRef.current.refreshIntervalMs
    if (!intervalMs) return undefined

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload()
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [authLoading, reload, userId])

  useEffect(() => {
    if (!hasSupabaseConfig || authLoading || !userId || optionsRef.current.refetchOnFocus === false) return undefined

    function refreshIfVisible() {
      if (document.visibilityState === 'visible') reload()
    }

    window.addEventListener('focus', refreshIfVisible)
    document.addEventListener('visibilitychange', refreshIfVisible)

    return () => {
      window.removeEventListener('focus', refreshIfVisible)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [authLoading, reload, userId])

  return { ...state, reload }
}
