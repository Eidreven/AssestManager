import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeInventory } from '../lib/asset-validation'

test('existing assets default to individual IT records', () => {
  assert.deepEqual(normalizeInventory({}), {
    asset_class: 'it', tracking_mode: 'individual', condition: 'good', quantity_total: 1,
    quantity_good: 1, quantity_fair: 0, quantity_damaged: 0, quantity_missing: 0,
  })
})

test('IT assets cannot be switched to quantity tracking', () => {
  assert.equal(normalizeInventory({ asset_class: 'it', tracking_mode: 'quantity', quantity_total: 20 }).tracking_mode, 'individual')
})

test('classroom quantity records preserve a valid condition breakdown', () => {
  const result = normalizeInventory({
    asset_class: 'classroom', tracking_mode: 'quantity', quantity_total: 24,
    quantity_good: 20, quantity_fair: 2, quantity_damaged: 1, quantity_missing: 1,
  })
  assert.equal(result.quantity_total, 24)
  assert.equal(result.quantity_damaged, 1)
})

test('classroom condition counts must equal the total', () => {
  assert.throws(() => normalizeInventory({
    asset_class: 'classroom', tracking_mode: 'quantity', quantity_total: 24,
    quantity_good: 20, quantity_fair: 2, quantity_damaged: 0, quantity_missing: 0,
  }), /must equal/)
})

test('quantities cannot be negative or fractional', () => {
  assert.throws(() => normalizeInventory({
    asset_class: 'classroom', tracking_mode: 'quantity', quantity_total: 1.5,
    quantity_good: 1.5,
  }), /whole numbers/)
})
