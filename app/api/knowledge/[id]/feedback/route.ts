import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Knowledge from '@/models/Knowledge'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST - Add feedback to knowledge entry
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const { id } = params
    const { rating, comment, helpful } = await request.json()

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Find knowledge entry
    const knowledge = await Knowledge.findById(id)
    if (!knowledge) {
      return NextResponse.json(
        { error: 'Knowledge entry not found' },
        { status: 404 }
      )
    }

    // Check if user already gave feedback
    const existingFeedback = knowledge.feedback.find((fb: any) => 
      fb.user.toString() === userPayload.userId
    )

    if (existingFeedback) {
      return NextResponse.json(
        { error: 'You have already provided feedback for this entry' },
        { status: 400 }
      )
    }

    // Add feedback using the model method
    await (knowledge as any).addFeedback(
      { _id: userPayload.userId },
      rating,
      comment,
      helpful
    )

    // Increment usage count
    await (knowledge as any).incrementUsage()

    return NextResponse.json({
      message: 'Feedback added successfully',
      usefulness_score: knowledge.usefulness_score,
      total_feedback: knowledge.feedback.length
    })

  } catch (error) {
    console.error('Knowledge feedback error:', error)
    return NextResponse.json(
      { error: 'Failed to add feedback' },
      { status: 500 }
    )
  }
}

// GET - Get feedback for knowledge entry
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const { id } = params

    const knowledge = await Knowledge.findById(id)
      .populate('feedback.user', 'username displayName')
      .select('feedback usefulness_score usage_count')

    if (!knowledge) {
      return NextResponse.json(
        { error: 'Knowledge entry not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      feedback: knowledge.feedback,
      usefulness_score: knowledge.usefulness_score,
      usage_count: knowledge.usage_count,
      average_rating: knowledge.feedback.length > 0 
        ? knowledge.feedback.reduce((sum: number, fb: any) => sum + fb.rating, 0) / knowledge.feedback.length
        : 0
    })

  } catch (error) {
    console.error('Get feedback error:', error)
    return NextResponse.json(
      { error: 'Failed to get feedback' },
      { status: 500 }
    )
  }
} 