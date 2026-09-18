import { RefreshCw, Send, XCircle } from 'lucide-react'
import { ActionStatus, actionStateLabel } from './ActionStatus'
import { useDashboardAction } from '../hooks/useDashboardAction'
import { isPostedStatus, isRejectedStatus } from '../services/deals'
import type { DashboardAction, DashboardActionKind, Deal } from '../types/database'

type DashboardActionController = ReturnType<typeof useDashboardAction>

type DashboardActionButtonsProps = {
  deal: Deal
  pendingAction?: DashboardAction | null
  compact?: boolean
  emphasis?: 'default' | 'review'
  actions?: DashboardActionKind[]
  onActionCreated?: (action?: DashboardActionKind, dashboardAction?: DashboardAction) => void
  onActionCompleted?: (dashboardAction: DashboardAction) => void | Promise<void>
  controller?: DashboardActionController
  onReviewDeal?: () => void
}

const actionLabels: Record<DashboardActionKind, string> = {
  POST: 'Post Deal',
  REJECT: 'Reject',
  REGENERATE_CAPTION: 'Regenerate Caption',
}

const actionIcons = {
  POST: Send,
  REJECT: XCircle,
  REGENERATE_CAPTION: RefreshCw,
}

function isActionAllowed(deal: Deal, action: DashboardActionKind) {
  if (isRejectedStatus(deal.status)) return false
  if (action === 'POST') return !isPostedStatus(deal.status)
  if (action === 'REJECT') return !isPostedStatus(deal.status)
  return true
}

export function DashboardActionButtons({
  deal,
  pendingAction,
  compact = false,
  emphasis = 'default',
  actions,
  onActionCreated,
  onActionCompleted,
  controller,
  onReviewDeal,
}: DashboardActionButtonsProps) {
  const internalController = useDashboardAction({
    dealId: deal.id,
    initialAction: pendingAction ?? null,
    onDone: async (dashboardAction) => {
      onActionCreated?.(dashboardAction.action, dashboardAction)
      await onActionCompleted?.(dashboardAction)
    },
    onFailed: async (dashboardAction) => {
      onActionCreated?.(dashboardAction.action, dashboardAction)
      await onActionCompleted?.(dashboardAction)
    },
  })
  const actionController = controller ?? internalController
  const activeAction = actionController.actionType
  const activeState = actionController.state
  const isActive = activeState === 'submitting' || activeState === 'queued' || activeState === 'processing'
  const visibleActions = actions ?? (Object.keys(actionLabels) as DashboardActionKind[])
  const showLocalStatus = emphasis !== 'review'

  async function submitAction(action: DashboardActionKind) {
    const dashboardAction = await actionController.execute(action)
    if (dashboardAction) onActionCreated?.(action, dashboardAction)
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {showLocalStatus && !compact && activeState !== 'success' ? (
        <ActionStatus
          deal={deal}
          action={actionController.action}
          state={activeState}
          error={actionController.error}
          onCheckAgain={() => void actionController.checkAgain()}
          onRetry={() => void actionController.retry()}
          onReviewDeal={onReviewDeal}
          compact={compact}
        />
      ) : null}

      <div className={emphasis === 'review' ? 'flex w-full flex-wrap gap-2' : 'flex flex-wrap gap-2'}>
        {visibleActions.map((action) => {
          const Icon = actionIcons[action]
          const isCurrentAction = activeAction === action
          const incompatiblePostingDecision = (activeAction === 'POST' || activeAction === 'REJECT') && (action === 'POST' || action === 'REJECT')
          const incompatibleRegenerate = activeAction === 'REGENERATE_CAPTION' && action === 'REGENERATE_CAPTION'
          const isDisabled = (isActive && (incompatiblePostingDecision || incompatibleRegenerate || isCurrentAction))
            || activeState === 'submitting'
            || !isActionAllowed(deal, action)
          const label = isCurrentAction && activeState !== 'failed' && activeState !== 'timeout'
            ? actionStateLabel(action, activeState)
            : actionLabels[action]
          const title = isDisabled && isActive && activeAction
            ? actionStateLabel(activeAction, activeState)
            : actionLabels[action]

          return (
            <button
              key={action}
              type="button"
              data-review-action={action}
              disabled={isDisabled}
              onClick={(event) => {
                event.stopPropagation()
                void submitAction(action)
              }}
              aria-keyshortcuts={action === 'POST' ? 'P' : action === 'REJECT' ? 'R' : 'G'}
              aria-label={actionLabels[action]}
              className={[
                'inline-flex items-center justify-center gap-2 rounded-lg border font-semibold shadow-sm transition-colors duration-200',
                compact ? 'size-10 px-0 text-xs' : emphasis === 'review' ? 'min-h-12 w-full px-5 text-sm' : 'min-h-10 px-3 text-xs',
                isDisabled
                  ? 'cursor-not-allowed border-white/10 text-slate-500'
                  : action === 'POST'
                    ? 'cursor-pointer border-emerald-300/25 bg-emerald-400 text-emerald-950 shadow-emerald-950/20 hover:bg-emerald-300'
                    : action === 'REJECT'
                      ? 'cursor-pointer border-rose-300/25 bg-rose-400/10 text-rose-100 shadow-rose-950/10 hover:bg-rose-400/15'
                      : 'cursor-pointer border-white/[0.1] bg-white/[0.035] text-slate-200 hover:bg-white/[0.065]',
              ].join(' ')}
              title={title}
            >
              <Icon className={isCurrentAction && isActive ? 'animate-spin' : ''} size={14} aria-hidden="true" />
              <span className={compact ? 'sr-only' : ''}>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
