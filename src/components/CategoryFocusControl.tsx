import { ChevronDown } from 'lucide-react'
import {
  allCategoryFocusValue,
  categoryIcon,
  categoryLabel,
  focusLabel,
  majorCategoryOptions,
  primaryCategoryOptions,
  techSubcategoryOptions,
  subcategoryLabel,
  type CategoryFocus,
  type MajorCategory,
  type TechSubcategory,
} from '../utils/categories'
import { useCategoryFocus } from './CategoryFocusContext'

type CategoryFocusControlProps = {
  compact?: boolean
  showTechSubcategory?: boolean
}

const moreCategoryOptions = majorCategoryOptions.filter(
  (category) => !primaryCategoryOptions.includes(category as (typeof primaryCategoryOptions)[number]),
)

export function CategoryFocusControl({ compact = false, showTechSubcategory = true }: CategoryFocusControlProps) {
  const { focus, setCategory, setSubcategory } = useCategoryFocus()
  const selectedMoreCategory = moreCategoryOptions.includes(focus.category as MajorCategory) ? focus.category : ''

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'flex flex-wrap items-center gap-2'}>
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-white/[0.08] bg-black/20 p-1 shadow-inner shadow-black/20">
        <FocusButton
          label="All"
          selected={focus.category === allCategoryFocusValue}
          onClick={() => setCategory(allCategoryFocusValue)}
        />
        {primaryCategoryOptions.map((category) => (
          <FocusButton
            key={category}
            focus={focus}
            category={category}
            selected={focus.category === category}
            onClick={() => setCategory(category)}
          />
        ))}
        <label className="relative inline-flex">
          <span className="sr-only">More categories</span>
          <select
            value={selectedMoreCategory}
            onChange={(event) => {
              if (event.target.value) setCategory(event.target.value as MajorCategory)
            }}
            className={[
              'min-h-8 appearance-none rounded-md border border-transparent bg-transparent pl-3 pr-7 text-xs font-semibold outline-none ring-cyan-300/20 transition-colors focus:ring-2',
              selectedMoreCategory ? 'bg-cyan-300/10 text-cyan-50 ring-1 ring-cyan-300/15' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white',
            ].join(' ')}
            title="More categories"
          >
            <option value="">More...</option>
            {moreCategoryOptions.map((category) => (
              <option key={category} value={category}>{categoryLabel(category)}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" size={13} aria-hidden="true" />
        </label>
      </div>

      {showTechSubcategory && focus.category === 'TECH' ? (
        <select
          value={focus.subcategory ?? ''}
          onChange={(event) => setSubcategory(event.target.value ? event.target.value as TechSubcategory : null)}
          className="min-h-10 rounded-lg border border-white/[0.09] bg-[#081014] px-3 text-sm text-white outline-none ring-cyan-300/20 transition focus:ring-2"
          aria-label="Tech subcategory"
        >
          <option value="">All Tech</option>
          {techSubcategoryOptions
            .filter((subcategory) => subcategory !== 'OTHER_TECH')
            .map((subcategory) => (
              <option key={subcategory} value={subcategory}>{subcategoryLabel(subcategory)}</option>
            ))}
        </select>
      ) : null}

      {!compact && focus.category !== allCategoryFocusValue ? (
        <span className="rounded-md border border-cyan-300/15 bg-cyan-300/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-100">Focus: {focusLabel(focus)}</span>
      ) : null}
    </div>
  )
}

function FocusButton({
  category,
  focus,
  label,
  selected,
  onClick,
}: {
  category?: MajorCategory
  focus?: CategoryFocus
  label?: string
  selected: boolean
  onClick: () => void
}) {
  const Icon = category ? categoryIcon(category) : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors',
        selected ? 'bg-cyan-300/10 text-cyan-50 ring-1 ring-cyan-300/15' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white',
      ].join(' ')}
      aria-pressed={selected}
      title={category && focus?.category === category ? focusLabel(focus) : label ?? categoryLabel(category)}
    >
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      {label ?? categoryLabel(category)}
    </button>
  )
}
