import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  allCategoryFocusValue,
  sanitizeCategoryFocus,
  type CategoryFocus,
  type MajorCategory,
  type TechSubcategory,
} from '../utils/categories'

const storageKey = 'affiliate-ops:category-focus:v1'

type CategoryFocusContextValue = {
  focus: CategoryFocus
  setCategory: (category: CategoryFocus['category']) => void
  setSubcategory: (subcategory: TechSubcategory | null) => void
  clearFocus: () => void
}

const CategoryFocusContext = createContext<CategoryFocusContextValue | null>(null)

function loadInitialFocus() {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return sanitizeCategoryFocus(stored ? JSON.parse(stored) : null)
  } catch {
    return { category: allCategoryFocusValue, subcategory: null } satisfies CategoryFocus
  }
}

export function CategoryFocusProvider({ children }: { children: React.ReactNode }) {
  const [focus, setFocus] = useState<CategoryFocus>(loadInitialFocus)

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(focus))
  }, [focus])

  const setCategory = useCallback((category: CategoryFocus['category']) => {
    setFocus({ category, subcategory: null })
  }, [])

  const setSubcategory = useCallback((subcategory: TechSubcategory | null) => {
    setFocus((current) => ({
      category: current.category === 'TECH' ? current.category : 'TECH',
      subcategory,
    }))
  }, [])

  const clearFocus = useCallback(() => {
    setFocus({ category: allCategoryFocusValue, subcategory: null })
  }, [])

  const value = useMemo(
    () => ({ focus, setCategory, setSubcategory, clearFocus }),
    [clearFocus, focus, setCategory, setSubcategory],
  )

  return <CategoryFocusContext.Provider value={value}>{children}</CategoryFocusContext.Provider>
}

export function useCategoryFocus() {
  const context = useContext(CategoryFocusContext)
  if (!context) throw new Error('useCategoryFocus must be used inside CategoryFocusProvider')
  return context
}

export function isConcreteCategory(category: CategoryFocus['category']): category is MajorCategory {
  return category !== allCategoryFocusValue
}
