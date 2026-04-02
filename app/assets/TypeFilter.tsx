'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function TypeFilter({ types, current }: { types: string[]; current: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('type', value)
    } else {
      params.delete('type')
    }
    router.push(`/assets?${params.toString()}`)
  }

  return (
    <select
      className="input"
      value={current}
      onChange={e => handleChange(e.target.value)}
    >
      <option value="">All Types</option>
      {types.map(t => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  )
}
