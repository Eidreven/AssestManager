import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { sendMaintenanceAssignedNotification, sendMaintenanceStatusUpdate } from '@/lib/email'

const VALID_ACTIONS = ['assign', 'start', 'hold', 'resume', 'complete'] as const

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  const body = await req.json()
  const action = String(body.action ?? '')
  if (!VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) {
    return NextResponse.json({ error: 'Invalid maintenance action' }, { status: 400 })
  }

  const job = await db.getMaintenanceJobById(id)
  if (!job) return NextResponse.json({ error: 'Maintenance job not found' }, { status: 404 })
  if (job.status === 'completed') {
    return NextResponse.json({ error: 'This maintenance job is already completed' }, { status: 400 })
  }

  const note = typeof body.note === 'string' ? body.note.trim() : ''

  if (action === 'assign') {
    if (!body.assigned_to_id) return NextResponse.json({ error: 'assigned_to_id is required' }, { status: 400 })
    await db.updateMaintenanceJob(id, { assigned_to_id: Number(body.assigned_to_id), latest_note: note || job.latest_note })
    const updated = await db.getMaintenanceJobById(id)
    if (updated?.assigned_to_email) {
      try {
        await sendMaintenanceAssignedNotification({
          assigneeEmail: updated.assigned_to_email,
          assigneeName: updated.assigned_to_name ?? 'IT team member',
          assetTag: updated.asset_tag ?? '',
          assetName: updated.asset_name ?? '',
          priority: updated.priority,
          faultDescription: updated.fault_description,
          requesterName: updated.reported_by_name,
        })
      } catch (err) { console.error('Maintenance assignment email error:', err) }
    }
    return NextResponse.json(updated)
  }

  if (action === 'start' || action === 'resume') {
    await db.updateMaintenanceJob(id, {
      status: 'in_progress',
      assigned_to_id: body.assigned_to_id ? Number(body.assigned_to_id) : job.assigned_to_id ?? auth.userId,
      started_at: job.started_at ?? new Date().toISOString(),
      latest_note: note || (action === 'resume' ? 'Maintenance resumed.' : 'Maintenance started.'),
    })
    await db.logAssetEvent(job.asset_id, action === 'resume' ? 'maintenance_resumed' : 'maintenance_started', auth.name, auth.userId,
      note || (action === 'resume' ? 'Maintenance resumed' : 'Maintenance started'))
  }

  if (action === 'hold') {
    if (!note) return NextResponse.json({ error: 'Hold note is required' }, { status: 400 })
    await db.updateMaintenanceJob(id, {
      status: 'on_hold',
      held_at: new Date().toISOString(),
      latest_note: note,
    })
    await db.logAssetEvent(job.asset_id, 'maintenance_on_hold', auth.name, auth.userId, note)
  }

  if (action === 'complete') {
    if (!note) return NextResponse.json({ error: 'Completion note is required' }, { status: 400 })
    const returnMode = String(body.return_mode ?? '')
    const asset = await db.getAssetById(job.asset_id)
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    if (asset.current_allocation) {
      await db.returnAllocation(asset.current_allocation.id, asset.id)
    }

    let returnLocationId: number | null = null
    let returnSetId: number | null = null

    if (returnMode === 'location') {
      if (!body.location_id) return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
      returnLocationId = Number(body.location_id)
      await db.removeAssetFromSet(asset.id)
      await db.updateAsset(asset.id, { status: 'available', location_id: returnLocationId })
    } else if (returnMode === 'set') {
      if (!body.set_id) return NextResponse.json({ error: 'set_id is required' }, { status: 400 })
      const set = await db.getSetById(Number(body.set_id))
      if (!set) return NextResponse.json({ error: 'Class set not found' }, { status: 404 })
      returnSetId = set.id
      if (set.location_id) returnLocationId = set.location_id
      await db.addAssetToSet(asset.id, set.id)
      await db.updateAsset(asset.id, { status: 'available', location_id: set.location_id })
    } else {
      return NextResponse.json({ error: 'Choose a return location or class set' }, { status: 400 })
    }

    await db.updateMaintenanceJob(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      latest_note: note,
      resolution_note: note,
      return_location_id: returnLocationId,
      return_set_id: returnSetId,
    })
    if (job.request_id) await db.updateRequestStatus(job.request_id, 'completed', auth.userId, note)
    await db.logAssetEvent(job.asset_id, 'maintenance_completed', auth.name, auth.userId, note)
  }

  const updated = await db.getMaintenanceJobById(id)
  if (updated?.reported_by_email) {
    try {
      await sendMaintenanceStatusUpdate({
        toEmail: updated.reported_by_email,
        toName: updated.reported_by_name ?? 'there',
        assetTag: updated.asset_tag ?? '',
        assetName: updated.asset_name ?? '',
        status: updated.status,
        note: updated.latest_note,
        assignedToName: updated.assigned_to_name,
      })
    } catch (err) { console.error('Maintenance status email error:', err) }
  }

  return NextResponse.json(updated)
}
