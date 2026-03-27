'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function TeacherFilter({ teachers, current }: { teachers: string[]; current: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(name: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (name) {
      params.set('teacher', name)
    } else {
      params.delete('teacher')
    }
    router.push(`/assets?${params.toString()}`)
  }

  return (
    <select
      className="input"
      value={current}
      onChange={e => handleChange(e.target.value)}
    >
      <option value="">All Teachers</option>
      {teachers.map(t => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  )
}
