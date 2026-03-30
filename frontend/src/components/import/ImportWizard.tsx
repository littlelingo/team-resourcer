import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { MappedPreviewResult, CommitResult, EntityType } from '@/api/importApi'
import SourceStep from './SourceStep'
import MapColumnsStep, {
  MEMBER_TARGET_FIELDS,
  PROGRAM_TARGET_FIELDS,
  AREA_TARGET_FIELDS,
  AGENCY_TARGET_FIELDS,
  TEAM_TARGET_FIELDS,
  SALARY_HISTORY_TARGET_FIELDS,
  BONUS_HISTORY_TARGET_FIELDS,
  PTO_HISTORY_TARGET_FIELDS,
  type TargetField,
} from './MapColumnsStep'
import PreviewStep from './PreviewStep'
import ResultStep from './ResultStep'

// ─── Entity configs ──────────────────────────────────────────────────────────

interface EntityConfig {
  targetFields: TargetField[]
  requiredFields: string[]
}

// Keep in sync with ENTITY_CONFIGS in backend/app/services/import_mapper.py (target_fields, required_fields)
const ENTITY_CONFIGS: Record<EntityType, EntityConfig> = {
  member: { targetFields: MEMBER_TARGET_FIELDS, requiredFields: ['employee_id', 'first_name', 'last_name'] },
  program: { targetFields: PROGRAM_TARGET_FIELDS, requiredFields: ['name'] },
  area: { targetFields: AREA_TARGET_FIELDS, requiredFields: ['name'] },
  team: { targetFields: TEAM_TARGET_FIELDS, requiredFields: ['name'] },
  agency: { targetFields: AGENCY_TARGET_FIELDS, requiredFields: ['name'] },
  salary_history: {
    targetFields: SALARY_HISTORY_TARGET_FIELDS,
    requiredFields: ['employee_id', 'effective_date', 'amount'],
  },
  bonus_history: {
    targetFields: BONUS_HISTORY_TARGET_FIELDS,
    requiredFields: ['employee_id', 'effective_date', 'amount'],
  },
  pto_history: {
    targetFields: PTO_HISTORY_TARGET_FIELDS,
    requiredFields: ['employee_id', 'effective_date', 'amount'],
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 'source' | 'map' | 'preview' | 'result'

interface WizardState {
  step: WizardStep
  sessionId: string | null
  headers: string[]
  previewRows: Record<string, unknown>[]
  totalRowCount: number
  columnMap: Record<string, string | null>
  mappedPreview: MappedPreviewResult | null
  commitResult: CommitResult | null
}

const INITIAL_STATE: WizardState = {
  step: 'source',
  sessionId: null,
  headers: [],
  previewRows: [],
  totalRowCount: 0,
  columnMap: {},
  mappedPreview: null,
  commitResult: null,
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEP_LABELS: { id: WizardStep; label: string }[] = [
  { id: 'source', label: 'Source' },
  { id: 'map', label: 'Map Columns' },
  { id: 'preview', label: 'Preview' },
  { id: 'result', label: 'Result' },
]

const STEP_ORDER: WizardStep[] = ['source', 'map', 'preview', 'result']

function StepIndicator({ current }: { current: WizardStep }) {
  const currentIndex = STEP_ORDER.indexOf(current)
  return (
    <div className="flex items-center mb-8">
      {STEP_LABELS.map(({ id, label }, i) => {
        const stepIndex = STEP_ORDER.indexOf(id)
        const isCompleted = stepIndex < currentIndex
        const isActive = id === current
        return (
          <div key={id} className="flex items-center">
            {/* Connector line before each step except the first */}
            {i > 0 && (
              <div
                className={cn(
                  'h-0.5 w-12 sm:w-20',
                  isCompleted || isActive ? 'bg-slate-700' : 'bg-slate-200',
                )}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2 transition-colors',
                  isActive
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : isCompleted
                      ? 'bg-slate-700 border-slate-700 text-white'
                      : 'bg-white border-slate-300 text-slate-400',
                )}
              >
                {isCompleted ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stepIndex + 1
                )}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-xs font-medium whitespace-nowrap',
                  isActive ? 'text-slate-900' : isCompleted ? 'text-slate-600' : 'text-slate-400',
                )}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

interface ImportWizardProps {
  entityType?: EntityType
  onComplete?: () => void
}

export default function ImportWizard({ entityType = 'member', onComplete }: ImportWizardProps) {
  const entityConfig = ENTITY_CONFIGS[entityType]
  const [state, setState] = useState<WizardState>(INITIAL_STATE)

  function handleStartOver() {
    setState(INITIAL_STATE)
  }

  function handleSourceSuccess(
    sessionId: string,
    headers: string[],
    previewRows: Record<string, unknown>[],
    totalRowCount: number,
  ) {
    setState((prev) => ({
      ...prev,
      step: 'map',
      sessionId,
      headers,
      previewRows,
      totalRowCount,
      columnMap: {},
    }))
  }

  function handleMapPreview(
    columnMap: Record<string, string | null>,
    mappedPreview: MappedPreviewResult,
  ) {
    setState((prev) => ({
      ...prev,
      step: 'preview',
      columnMap,
      mappedPreview,
    }))
  }

  function handleBackToMap() {
    setState((prev) => ({ ...prev, step: 'map', mappedPreview: null }))
  }

  function handleCommitResult(commitResult: CommitResult) {
    setState((prev) => ({ ...prev, step: 'result', commitResult }))
    onComplete?.()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <StepIndicator current={state.step} />

      {state.step !== 'source' && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={handleStartOver}
            className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors"
          >
            Start Over
          </button>
        </div>
      )}

      {state.step === 'source' && (
        <SourceStep onSuccess={handleSourceSuccess} />
      )}

      {state.step === 'map' && state.sessionId && (
        <MapColumnsStep
          sessionId={state.sessionId}
          headers={state.headers}
          initialColumnMap={state.columnMap}
          onPreview={handleMapPreview}
          targetFields={entityConfig.targetFields}
          requiredFields={entityConfig.requiredFields}
          entityType={entityType}
        />
      )}

      {state.step === 'preview' && state.sessionId && state.mappedPreview && (
        <PreviewStep
          sessionId={state.sessionId}
          columnMap={state.columnMap}
          mappedPreview={state.mappedPreview}
          onBack={handleBackToMap}
          onCommit={handleCommitResult}
          entityType={entityType}
        />
      )}

      {state.step === 'result' && state.commitResult && (
        <ResultStep
          commitResult={state.commitResult}
          onImportAgain={handleStartOver}
        />
      )}
    </div>
  )
}
