export type AssetClass = 'it' | 'classroom'
export type TrackingMode = 'individual' | 'quantity'
export type AssetCondition = 'good' | 'fair' | 'damaged' | 'missing'

export interface InventoryInput {
  asset_class?: unknown
  tracking_mode?: unknown
  condition?: unknown
  quantity_total?: unknown
  quantity_good?: unknown
  quantity_fair?: unknown
  quantity_damaged?: unknown
  quantity_missing?: unknown
}

export interface NormalizedInventory {
  asset_class: AssetClass
  tracking_mode: TrackingMode
  condition: AssetCondition
  quantity_total: number
  quantity_good: number
  quantity_fair: number
  quantity_damaged: number
  quantity_missing: number
}

export function normalizeInventory(input: InventoryInput): NormalizedInventory {
  const assetClass = input.asset_class ?? 'it'
  const trackingMode = assetClass === 'it' ? 'individual' : (input.tracking_mode ?? 'individual')
  const condition = input.condition ?? 'good'

  if (assetClass !== 'it' && assetClass !== 'classroom') throw new Error('Invalid asset class')
  if (trackingMode !== 'individual' && trackingMode !== 'quantity') throw new Error('Invalid tracking mode')
  if (!['good', 'fair', 'damaged', 'missing'].includes(String(condition))) throw new Error('Invalid condition')

  if (trackingMode === 'individual') {
    return {
      asset_class: assetClass,
      tracking_mode: trackingMode,
      condition: condition as AssetCondition,
      quantity_total: 1,
      quantity_good: condition === 'good' ? 1 : 0,
      quantity_fair: condition === 'fair' ? 1 : 0,
      quantity_damaged: condition === 'damaged' ? 1 : 0,
      quantity_missing: condition === 'missing' ? 1 : 0,
    }
  }

  const total = Number(input.quantity_total)
  const good = Number(input.quantity_good ?? total)
  const fair = Number(input.quantity_fair ?? 0)
  const damaged = Number(input.quantity_damaged ?? 0)
  const missing = Number(input.quantity_missing ?? 0)
  const quantities = [total, good, fair, damaged, missing]
  if (quantities.some(value => !Number.isInteger(value) || value < 0) || total < 1) {
    throw new Error('Quantities must be positive whole numbers')
  }
  if (good + fair + damaged + missing !== total) {
    throw new Error('Condition quantities must equal the total quantity')
  }

  return {
    asset_class: assetClass,
    tracking_mode: trackingMode,
    condition: condition as AssetCondition,
    quantity_total: total,
    quantity_good: good,
    quantity_fair: fair,
    quantity_damaged: damaged,
    quantity_missing: missing,
  }
}
