import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  createDashboardAction,
  fetchActiveActionForDeal,
  fetchDashboardActionById,
  subscribeToDashboardAction,
} from '../services/dashboardActions'
import type { DashboardAction, DashboardActionKind, DashboardActionStatus, Json } from '../types/database'

export type DashboardActionUiState = 'idle' | 'submitting' | 'queued' | 'processing' | 'success' | 'failed' | 'timeout'

const pollIntervalMs = 2500
const timeoutMs = 100000
const terminalResetMs = 1200

type UseDashboardActionOptions = {
  dealId: number | null
  initialAction?: DashboardAction | null
  recoverOnDealChange?: boolean
  onDone?: (action: DashboardAction) => void | Promise<void>
  onFailed?: (action: DashboardAction) => void | Promise<void>
  onTimeout?: (action: DashboardAction | null) => void
}

function statusToState(status: DashboardActionStatus | null | undefined): DashboardActionUiState {
  if (status === 'PENDING') return 'queued'
  if (status === 'PROCESSING') return 'processing'
  if (status === 'DONE') return 'success'
  if (status === 'FAILED') return 'failed'
  return 'idle'
}

function isTerminal(status: DashboardActionStatus | null | undefined) {
  return status === 'DONE' || status === 'FAILED'
}

function resultObject(result: Json | null) {
  return result && typeof result === 'object' && !Array.isArray(result) ? result : null
}

export function dashboardActionErrorMessage(action: DashboardAction | null) {
  if (!action) return null
  const result = resultObject(action.result)
  const error = result?.error
  if (typeof error === 'string' && error.trim()) return error
  return action.note || 'Action failed'
}

export function dashboardActionPriceChange(action: DashboardAction | null) {
  const result = resultObject(action?.result ?? null)
  if (!result) return null

  const code = result.code
  const error = result.error
  const approved = result.approved_price
  const live = result.live_price
  const difference = result.price_difference_percent

  const isPriceChanged =
    code === 'PRICE_CHANGED_BEFORE_POST'
    || (typeof error === 'string' && error.toUpperCase().includes('PRICE_CHANGED_BEFORE_POST'))
    || (approved !== undefined && live !== undefined)

  if (!isPriceChanged) return null

  return {
    approvedPrice: typeof approved === 'number' || typeof approved === 'string' ? approved : null,
    livePrice: typeof live === 'number' || typeof live === 'string' ? live : null,
    differencePercent: typeof difference === 'number' || typeof difference === 'string' ? difference : null,
  }
}

export function useDashboardAction({
  dealId,
  initialAction,
  recoverOnDealChange = true,
  onDone,
  onFailed,
  onTimeout,
}: UseDashboardActionOptions) {
  const { user } = useAuth()
  const [action, setAction] = useState<DashboardAction | null>(initialAction ?? null)
  const [state, setState] = useState<DashboardActionUiState>(statusToState(initialAction?.status))
  const [error, setError] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(initialAction ? Date.now() : null)
  const terminalNotifiedRef = useRef<Set<string>>(new Set())
  const actionRef = useRef<DashboardAction | null>(initialAction ?? null)

  const applyAction = useCallback((nextAction: DashboardAction) => {
    actionRef.current = nextAction
    setAction(nextAction)
    setState(statusToState(nextAction.status))
    if (nextAction.status !== 'FAILED') setError(null)
  }, [])

  const notifyTerminal = useCallback((nextAction: DashboardAction) => {
    if (!isTerminal(nextAction.status)) return

    const key = `${nextAction.id}:${nextAction.status}`
    if (terminalNotifiedRef.current.has(key)) return
    terminalNotifiedRef.current.add(key)

    if (nextAction.status === 'DONE') void onDone?.(nextAction)
    if (nextAction.status === 'FAILED') {
      setError(dashboardActionErrorMessage(nextAction))
      void onFailed?.(nextAction)
    }
  }, [onDone, onFailed])

  const reset = useCallback(() => {
    actionRef.current = null
    setAction(null)
    setState('idle')
    setError(null)
    setStartedAt(null)
  }, [])

  const execute = useCallback(async (actionType: DashboardActionKind) => {
    if (!dealId) {
      setError('No deal is selected.')
      return null
    }
    if (!user) {
      setError('You must be signed in to request an action.')
      return null
    }
    if (state === 'submitting' || state === 'queued' || state === 'processing') {
      return actionRef.current
    }

    setState('submitting')
    setError(null)
    setStartedAt(Date.now())

    try {
      const created = await createDashboardAction(dealId, actionType, user.id)
      applyAction(created)
      return created
    } catch (caughtError) {
      actionRef.current = null
      setAction(null)
      setState('failed')
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to queue action')
      return null
    }
  }, [applyAction, dealId, state, user])

  const retry = useCallback(async () => {
    const currentActionType = actionRef.current?.action
    if (!currentActionType) return null
    reset()
    return execute(currentActionType)
  }, [execute, reset])

  const checkAgain = useCallback(async () => {
    const currentId = actionRef.current?.id
    if (!currentId) return null

    try {
      const current = await fetchDashboardActionById(currentId)
      applyAction(current)
      notifyTerminal(current)
      return current
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to check action')
      return null
    }
  }, [applyAction, notifyTerminal])

  useEffect(() => {
    if (!initialAction) return
    applyAction(initialAction)
    setStartedAt(Date.now())
  }, [applyAction, initialAction])

  useEffect(() => {
    if (!dealId || !recoverOnDealChange) {
      reset()
      return
    }

    let cancelled = false
    fetchActiveActionForDeal(dealId)
      .then((pendingAction) => {
        if (cancelled) return
        if (pendingAction) {
          applyAction(pendingAction)
          setStartedAt(Date.now())
        } else if (actionRef.current?.deal_id !== dealId) {
          reset()
        }
      })
      .catch((caughtError) => {
        if (!cancelled) setError(caughtError instanceof Error ? caughtError.message : 'Unable to recover pending action')
      })

    return () => {
      cancelled = true
    }
  }, [applyAction, dealId, recoverOnDealChange, reset])

  useEffect(() => {
    if (!action?.id || isTerminal(action.status) || state === 'timeout') return
    return subscribeToDashboardAction(action.id, (nextAction) => {
      applyAction(nextAction)
      notifyTerminal(nextAction)
    })
  }, [action?.id, action?.status, applyAction, notifyTerminal, state])

  useEffect(() => {
    if (!action?.id || isTerminal(action.status) || state === 'timeout') return

    let cancelled = false
    let timer: number | undefined

    async function poll() {
      if (!actionRef.current?.id) return
      if (startedAt && Date.now() - startedAt > timeoutMs) {
        setState('timeout')
        onTimeout?.(actionRef.current)
        return
      }

      try {
        const current = await fetchDashboardActionById(actionRef.current.id)
        if (cancelled) return
        applyAction(current)
        notifyTerminal(current)
        if (!isTerminal(current.status)) timer = window.setTimeout(poll, pollIntervalMs)
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to check action')
          timer = window.setTimeout(poll, pollIntervalMs)
        }
      }
    }

    timer = window.setTimeout(poll, pollIntervalMs)
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [action?.id, action?.status, applyAction, notifyTerminal, onTimeout, startedAt, state])

  useEffect(() => {
    function onFocus() {
      if (actionRef.current?.id && !isTerminal(actionRef.current.status)) void checkAgain()
    }

    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [checkAgain])

  useEffect(() => {
    if (state !== 'success') return
    const timer = window.setTimeout(reset, terminalResetMs)
    return () => window.clearTimeout(timer)
  }, [reset, state])

  return useMemo(() => ({
    actionId: action?.id ?? null,
    actionType: action?.action ?? null,
    backendStatus: action?.status ?? null,
    action,
    state,
    error,
    result: action?.result ?? null,
    startedAt,
    execute,
    retry,
    reset,
    checkAgain,
  }), [action, checkAgain, error, execute, reset, retry, startedAt, state])
}
