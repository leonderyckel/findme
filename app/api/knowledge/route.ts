import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Knowledge from '@/models/Knowledge'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET - Search knowledge base
export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const category = searchParams.get('category')
    const vehicleMake = searchParams.get('make')
    const vehicleModel = searchParams.get('model')
    const vehicleYear = searchParams.get('year')
    const status = searchParams.get('status') || 'approved'
    const limit = parseInt(searchParams.get('limit') || '10')

    let knowledge: any[] = []

    if (query) {
      // Text search
      knowledge = await (Knowledge as any).searchByQuery(query, {
        category,
        vehicleMake,
        limit
      })
    } else if (vehicleMake) {
      // Vehicle-specific search
      knowledge = await (Knowledge as any).findByVehicle(
        vehicleMake,
        vehicleModel || undefined,
        vehicleYear ? parseInt(vehicleYear) : undefined
      )
    } else {
      // General browse
      const filter: any = { status }
      if (category) filter.category = category

      knowledge = await Knowledge.find(filter)
        .sort({ usefulness_score: -1, usage_count: -1 })
        .limit(limit)
        .populate('created_by', 'username displayName')
    }

    return NextResponse.json({
      knowledge,
      total: knowledge.length
    })

  } catch (error) {
    console.error('Knowledge search error:', error)
    return NextResponse.json(
      { error: 'Failed to search knowledge base' },
      { status: 500 }
    )
  }
}

// POST - Add new knowledge entry
export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const data = await request.json()
    const {
      title,
      content,
      summary,
      category,
      subcategory,
      tags,
      applicableVehicles,
      partNumbers,
      sources,
      search_keywords,
      auto_generated = false
    } = data

    // Validation
    if (!title || !content || !summary || !category) {
      return NextResponse.json(
        { error: 'Title, content, summary, and category are required' },
        { status: 400 }
      )
    }

    // Create knowledge entry
    const knowledge = new Knowledge({
      title,
      content,
      summary,
      category,
      subcategory,
      tags: tags || [],
      applicableVehicles: applicableVehicles || [],
      partNumbers: partNumbers || [],
      sources: sources || [],
      search_keywords: search_keywords || [],
      auto_generated,
      created_by: userPayload.userId,
      status: auto_generated ? 'pending_review' : 'approved' // Auto approve manual entries for now
    })

    await knowledge.save()

    return NextResponse.json({
      message: 'Knowledge entry created successfully',
      knowledge: {
        id: knowledge._id,
        title: knowledge.title,
        category: knowledge.category,
        status: knowledge.status
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Knowledge creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create knowledge entry' },
      { status: 500 }
    )
  }
} 