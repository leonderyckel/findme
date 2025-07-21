import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Post from '@/models/Post'
import { getUserFromRequest } from '@/lib/auth'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { type } = await request.json() // 'up', 'down', or 'remove'

    const validTypes = ['up', 'down', 'remove']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid vote type' },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const post = await Post.findById(params.id)
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    const userId = userPayload.userId

    // Remove existing votes
    post.upvotes = post.upvotes.filter((id: any) => id.toString() !== userId)
    post.downvotes = post.downvotes.filter((id: any) => id.toString() !== userId)

    // Add new vote if not removing
    if (type === 'up') {
      post.upvotes.push(userId as any)
    } else if (type === 'down') {
      post.downvotes.push(userId as any)
    }

    await post.save()

    return NextResponse.json({
      message: 'Vote updated successfully',
      upvoteCount: post.upvotes.length,
      downvoteCount: post.downvotes.length
    })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 