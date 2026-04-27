import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthFromCookies, isAdmin } from '@/lib/auth'
import { sendMaintenanceAssignedNotification, sendMaintenanceStatusUpdate, sendRequestStatusUpdate } from '@/lib/email'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = getAuthFromCookies()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(auth)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status, handler_notes, set_maintenance, relocate_to, assigned_to_id } = await req.json()

  if (!['approved', 'rejected', 'completed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const requestId = Number(params.id)

  // Fetch request details before updating (to get requester email + asset info)
  const requests = await db.getAllRequests()
  const request = requests.find(r => r.id === requestId)

  await db.updateRequestStatus(requestId, status, auth.userId, handler_notes)

  // For issue requests approved with maintenance — update asset status & location
  let maintenanceApplied = false
  if (request && status === 'approved' && request.request_type === 'issue') {
    const currentAsset = await db.getAssetById(request.asset_id)
    if (set_maintenance && currentAsset) {
      const openMaintenance = await db.getOpenMaintenanceJobForAsset(request.asset_id)
      if (currentAsset.current_allocation) {
        await db.returnAllocation(currentAsset.current_allocation.id, request.asset_id)
      }
      if (currentAsset.set_id) {
        await db.removeAssetFromSet(request.asset_id)
      }
      await db.updateAsset(request.asset_id, { status: 'maintenance' })
      await db.logAssetEvent(request.asset_id, 'status_changed', auth.name, auth.userId,
        `Status changed from ${currentAsset.status} to maintenance (issue report approved)`)
      if (!openMaintenance) {
        const jobId = await db.createMaintenanceJob({
          asset_id: request.asset_id,
          request_id: request.id,
          reported_by_name: request.requester_name,
          reported_by_email: request.requester_email,
          fault_description: request.reason,
          priority: request.priority,
          approved_by_id: auth.userId,
          assigned_to_id: assigned_to_id ? Number(assigned_to_id) : auth.userId,
          latest_note: handler_notes || 'Issue approved for maintenance.',
        })
        await db.logAssetEvent(request.asset_id, 'maintenance_approved', auth.name, auth.userId,
          `Maintenance job #${jobId} approved${handler_notes ? `: ${handler_notes}` : ''}`)
        const job = await db.getMaintenanceJobById(jobId)
        if (job?.assigned_to_email) {
          try {
            await sendMaintenanceAssignedNotification({
              assigneeEmail: job.assigned_to_email,
              assigneeName: job.assigned_to_name ?? 'IT team member',
              assetTag: request.asset_tag ?? '',
              assetName: request.asset_name ?? '',
              priority: request.priority,
              faultDescription: request.reason,
              requesterName: request.requester_name,
            })
          } catch (err) { console.error('Maintenance assigned email error:', err) }
        }
      } else if (assigned_to_id) {
        await db.updateMaintenanceJob(openMaintenance.id, {
          assigned_to_id: Number(assigned_to_id),
          latest_note: handler_notes || openMaintenance.latest_note,
        })
      }
      maintenanceApplied = true
    }
    if (relocate_to && currentAsset) {
      await db.updateAsset(request.asset_id, { location_id: Number(relocate_to) })
      const after = await db.getAssetById(request.asset_id)
      await db.logAssetEvent(request.asset_id, 'edited', auth.name, auth.userId,
        `Location: ${currentAsset.location_name ?? 'None'} → ${after?.location_name ?? 'None'} (issue report)`)
    }
  }

  // Email requester if they provided an email
  if (request?.requester_email) {
    try {
      await sendRequestStatusUpdate({
        requesterName: request.requester_name,
        requesterEmail: request.requester_email,
        assetTag: request.asset_tag ?? '',
        assetName: request.asset_name ?? '',
        requestType: request.request_type,
        status,
        handlerNotes: handler_notes,
        maintenanceApplied,
      })
    } catch (err) { console.error('Status update email error:', err) }

    if (maintenanceApplied) {
      try {
        await sendMaintenanceStatusUpdate({
          toEmail: request.requester_email,
          toName: request.requester_name,
          assetTag: request.asset_tag ?? '',
          assetName: request.asset_name ?? '',
          status: 'approved',
          note: handler_notes,
        })
      } catch (err) { console.error('Maintenance approval email error:', err) }
    }
  }

  return NextResponse.json({ ok: true })
}
