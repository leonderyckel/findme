import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Post from '@/models/Post'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase()

    const post = await Post.findById(params.id)
      .populate('author', 'username displayName avatar')
      .lean()

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Increment view count
    await Post.findByIdAndUpdate(params.id, { $inc: { views: 1 } })

    return NextResponse.json({
      post: {
        ...post,
        upvoteCount: post.upvotes?.length || 0,
        downvoteCount: post.downvotes?.length || 0,
        upvotes: undefined,
        downvotes: undefined
      }
    })
  } catch (error) {
    console.error('Get post error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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

    await connectToDatabase()

    const post = await Post.findById(params.id)
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // Check if user owns the post
    if (post.author.toString() !== userPayload.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { title, content, tags, images, videoUrl } = await request.json()

    // Update post
    const updatedPost = await Post.findByIdAndUpdate(
      params.id,
      {
        ...(title && { title }),
        ...(content && { content }),
        ...(tags && { tags }),
        ...(images && { images }),
        ...(videoUrl !== undefined && { videoUrl })
      },
      { new: true }
    ).populate('author', 'username displayName avatar')

    return NextResponse.json({
      message: 'Post updated successfully',
      post: {
        ...updatedPost.toObject(),
        upvoteCount: updatedPost.upvotes?.length || 0,
        downvoteCount: updatedPost.downvotes?.length || 0,
        upvotes: undefined,
        downvotes: undefined
      }
    })
  } catch (error) {
    console.error('Update post error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 