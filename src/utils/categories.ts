import {
  Baby,
  BookOpen,
  Car,
  Cpu,
  Gamepad2,
  Headphones,
  Home,
  Monitor,
  MoreHorizontal,
  Package,
  PlugZap,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Tv,
  Watch,
  Wifi,
  Camera,
  HardDrive,
  Laptop,
  MemoryStick,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Deal } from '../types/database'

export const allCategoryFocusValue = 'all'
export const uncategorizedCategoryValue = 'UNCATEGORIZED'

export const majorCategoryOptions = [
  'TECH',
  'FASHION',
  'HOME',
  'BEAUTY',
  'GROCERY',
  'AUTOMOTIVE',
  'BABY',
  'SPORTS',
  'BOOKS',
  'OTHER',
  uncategorizedCategoryValue,
] as const

export const primaryCategoryOptions = ['TECH', 'FASHION', 'HOME', 'BEAUTY'] as const

export const techSubcategoryOptions = [
  'PHONES_TABLETS',
  'COMPUTERS_LAPTOPS',
  'GAMING',
  'AUDIO',
  'TV_HOME_ENTERTAINMENT',
  'MONITORS',
  'STORAGE',
  'NETWORKING',
  'CHARGERS_POWER',
  'WEARABLES',
  'CAMERAS',
  'PC_COMPONENTS',
  'ACCESSORIES',
  'OTHER_TECH',
] as const

export type MajorCategory = (typeof majorCategoryOptions)[number]
export type TechSubcategory = (typeof techSubcategoryOptions)[number]

export type CategoryFocus = {
  category: typeof allCategoryFocusValue | MajorCategory
  subcategory?: TechSubcategory | null
}

const categoryLabels: Record<MajorCategory, string> = {
  TECH: 'Tech',
  FASHION: 'Fashion',
  HOME: 'Home',
  BEAUTY: 'Beauty',
  GROCERY: 'Grocery',
  AUTOMOTIVE: 'Automotive',
  BABY: 'Baby',
  SPORTS: 'Sports',
  BOOKS: 'Books',
  OTHER: 'Other',
  UNCATEGORIZED: 'Uncategorized',
}

const subcategoryLabels: Record<TechSubcategory, string> = {
  PHONES_TABLETS: 'Phones & Tablets',
  COMPUTERS_LAPTOPS: 'Computers & Laptops',
  GAMING: 'Gaming',
  AUDIO: 'Audio',
  TV_HOME_ENTERTAINMENT: 'TV',
  MONITORS: 'Monitors',
  STORAGE: 'Storage',
  NETWORKING: 'Networking',
  CHARGERS_POWER: 'Chargers & Power',
  WEARABLES: 'Wearables',
  CAMERAS: 'Cameras',
  PC_COMPONENTS: 'PC Components',
  ACCESSORIES: 'Accessories',
  OTHER_TECH: 'Other Tech',
}

const categoryIcons: Partial<Record<MajorCategory, LucideIcon>> = {
  TECH: Cpu,
  FASHION: Shirt,
  HOME: Home,
  BEAUTY: Sparkles,
  GROCERY: ShoppingBasket,
  AUTOMOTIVE: Car,
  BABY: Baby,
  SPORTS: Package,
  BOOKS: BookOpen,
  OTHER: MoreHorizontal,
  UNCATEGORIZED: Package,
}

const subcategoryIcons: Partial<Record<TechSubcategory, LucideIcon>> = {
  PHONES_TABLETS: Smartphone,
  COMPUTERS_LAPTOPS: Laptop,
  GAMING: Gamepad2,
  AUDIO: Headphones,
  TV_HOME_ENTERTAINMENT: Tv,
  MONITORS: Monitor,
  STORAGE: HardDrive,
  NETWORKING: Wifi,
  CHARGERS_POWER: PlugZap,
  WEARABLES: Watch,
  CAMERAS: Camera,
  PC_COMPONENTS: MemoryStick,
  ACCESSORIES: Package,
  OTHER_TECH: MoreHorizontal,
}

export function isMajorCategory(value: string): value is MajorCategory {
  return majorCategoryOptions.includes(value as MajorCategory)
}

export function isTechSubcategory(value: string): value is TechSubcategory {
  return techSubcategoryOptions.includes(value as TechSubcategory)
}

export function categoryLabel(category: string | null | undefined) {
  if (!category) return categoryLabels.UNCATEGORIZED
  return isMajorCategory(category) ? categoryLabels[category] : humanizeToken(category)
}

export function subcategoryLabel(subcategory: string | null | undefined) {
  if (!subcategory) return null
  return isTechSubcategory(subcategory) ? subcategoryLabels[subcategory] : humanizeToken(subcategory)
}

export function categoryIcon(category: string | null | undefined) {
  if (!category || !isMajorCategory(category)) return categoryIcons.UNCATEGORIZED ?? Package
  return categoryIcons[category] ?? Package
}

export function subcategoryIcon(subcategory: string | null | undefined) {
  if (!subcategory || !isTechSubcategory(subcategory)) return Package
  return subcategoryIcons[subcategory] ?? Package
}

export function normalizedDealCategory(deal: Pick<Deal, 'category'>) {
  return deal.category ?? uncategorizedCategoryValue
}

export function dealCategoryText(deal: Pick<Deal, 'category' | 'subcategory'>) {
  const major = categoryLabel(deal.category)
  const subcategory = subcategoryLabel(deal.subcategory)
  return subcategory ? `${major} / ${subcategory}` : major
}

export function compactDealCategoryText(deal: Pick<Deal, 'category' | 'subcategory'>) {
  const major = categoryLabel(deal.category).toUpperCase()
  const subcategory = subcategoryLabel(deal.subcategory)
  return subcategory ? `${major} · ${subcategory}` : major
}

export function focusLabel(focus: CategoryFocus) {
  if (focus.category === allCategoryFocusValue) return 'All Categories'
  const major = categoryLabel(focus.category)
  const subcategory = subcategoryLabel(focus.subcategory)
  return subcategory ? `${major} / ${subcategory}` : major
}

export function sanitizeCategoryFocus(value: unknown): CategoryFocus {
  if (!value || typeof value !== 'object') return { category: allCategoryFocusValue, subcategory: null }
  const candidate = value as Partial<CategoryFocus>
  const category = typeof candidate.category === 'string' && isMajorCategory(candidate.category)
    ? candidate.category
    : allCategoryFocusValue
  const subcategory = category === 'TECH' && typeof candidate.subcategory === 'string' && isTechSubcategory(candidate.subcategory)
    ? candidate.subcategory
    : null

  return { category, subcategory }
}

function humanizeToken(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
