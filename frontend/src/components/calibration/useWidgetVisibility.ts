import { useState, useEffect } from 'react'
import type { WidgetId } from './widgets/types'
import { WIDGET_REGISTRY, WIDGET_IDS } from './widgets/registry'

const STORAGE_KEY = 'team-resourcer:calibration:visibleWidgets:v1'

function getDefaultVisible(): Set<WidgetId> {
  return new Set(
    WIDGET_IDS.filter((id) => WIDGET_REGISTRY[id].defaultVisible),
  )
}

function loadFromStorage(): Set<WidgetId> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const ids = parsed.filter((id): id is WidgetId => WIDGET_IDS.includes(id as WidgetId))
    return new Set(ids)
  } catch {
    return null
  }
}

function saveToStorage(visible: Set<WidgetId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visible]))
  } catch {
    // localStorage may be unavailable (e.g., tests)
  }
}

export function useWidgetVisibility() {
  const [visible, setVisible] = useState<Set<WidgetId>>(() => {
    return loadFromStorage() ?? getDefaultVisible()
  })

  useEffect(() => {
    saveToStorage(visible)
  }, [visible])

  function toggle(id: WidgetId) {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function isVisible(id: WidgetId) {
    return visible.has(id)
  }

  return { visible, toggle, isVisible }
}
