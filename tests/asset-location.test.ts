import test from 'node:test'
import assert from 'node:assert/strict'
import { getEffectiveLocationId } from '../lib/asset-location'

test('active allocation location overrides the registered asset location', () => {
  assert.equal(getEffectiveLocationId({
    location_id: 1,
    current_allocation: { location_id: 2 },
  }), 2)
})

test('registered location is used when the allocation has no location', () => {
  assert.equal(getEffectiveLocationId({
    location_id: 1,
    current_allocation: { location_id: null },
  }), 1)
})

test('assets without a location remain unassigned', () => {
  assert.equal(getEffectiveLocationId({ location_id: null }), null)
})
