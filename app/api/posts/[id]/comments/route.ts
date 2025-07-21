import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Comment from '@/models/Comment'
import Post from '@/models/Post'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase()

    const comments = await Comment.find({ 
      post: params.id, 
      parentComment: null,
      isDeleted: false
    })
      .populate('author', 'username displayName avatar')
      .populate({
        path: 'replies',
        populate: {
          path: 'author',
          select: 'username displayName avatar'
        }
      })
      .sort({ createdAt: 1 })
      .lean()

    return NextResponse.json({
      comments: comments.map(comment => ({
        ...comment,
        upvoteCount: comment.upvotes?.length || 0,
        downvoteCount: comment.downvotes?.length || 0,
        upvotes: undefined,
        downvotes: undefined,
        replies: comment.replies?.map((reply: any) => ({
          ...reply,
          upvoteCount: reply.upvotes?.length || 0,
          downvoteCount: reply.downvotes?.length || 0,
          upvotes: undefined,
          downvotes: undefined
        })) || []
      }))
    })
  } catch (error) {
    console.error('Get comments error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    const { content, parentComment } = await request.json()

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      )
    }

    await connectToDatabase()

    // Check if post exists
    const post = await Post.findById(params.id)
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    // If it's a reply, check if parent comment exists
    if (parentComment) {
      const parentExists = await Comment.findById(parentComment)
      if (!parentExists) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        )
      }
    }

    const comment = new Comment({
      content,
      author: userPayload.userId,
      post: params.id,
      parentComment: parentComment || null
    })

    await comment.save()
    await comment.populate('author', 'username displayName avatar')

    // Update post comment count
    await Post.findByIdAndUpdate(params.id, { $inc: { commentCount: 1 } })

    // If it's a reply, add to parent's replies array
    if (parentComment) {
      await Comment.findByIdAndUpdate(parentComment, {
        $push: { replies: comment._id }
      })
    }

    return NextResponse.json({
      message: 'Comment created successfully',
      comment: {
        ...comment.toObject(),
        upvoteCount: 0,
        downvoteCount: 0,
        upvotes: undefined,
        downvotes: undefined
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Create comment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 