type LocatedAsset = {
  location_id: number | null
  current_allocation?: { location_id: number | null } | null
}

export function getEffectiveLocationId(asset: LocatedAsset): number | null {
  return asset.current_allocation?.location_id ?? asset.location_id
}
