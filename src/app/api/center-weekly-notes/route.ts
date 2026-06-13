import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DB, getCenterId, withCenter } from '@/lib/db'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data, error } = await withCenter(
      supabase.from(DB.centerSettings).select('id, notes').limit(1)
    ).maybeSingle()

    if (error) throw error

    return NextResponse.json({ notes: data?.notes ?? '' })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Failed to load center weekly notes' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawNotes = typeof body?.notes === 'string' ? body.notes : ''
    const notes = rawNotes.trim() ? rawNotes : null

    const { data: existing, error: fetchErr } = await withCenter(
      supabase.from(DB.centerSettings).select('id').limit(1)
    ).maybeSingle()

    if (fetchErr) throw fetchErr

    if (!existing?.id) {
      const { error: insertErr } = await supabase.from(DB.centerSettings).insert({
        center_id: getCenterId(),
        notes,
      } as any)
      if (insertErr) throw insertErr
      return NextResponse.json({ notes: notes ?? '' })
    }

    const { error: updateErr } = await withCenter(
      supabase.from(DB.centerSettings).update({ notes } as any)
    ).eq('id', existing.id)

    if (updateErr) throw updateErr

    return NextResponse.json({ notes: notes ?? '' })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Failed to save center weekly notes' },
      { status: 500 }
    )
  }
}
