import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Post from '@/models/Post'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET - Fetch posts with filters
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const category = searchParams.get('category')
    const tag = searchParams.get('tag')
    const sort = searchParams.get('sort') || 'recent'

    const skip = (page - 1) * limit

    // Build query
    const query: any = {}
    if (category && category !== 'all') {
      query.category = category
    }
    if (tag) {
      query.tags = { $in: [tag] }
    }

    // Build sort
    let sortQuery: any = {}
    switch (sort) {
      case 'popular':
        sortQuery = { upvotes: -1, createdAt: -1 }
        break
      case 'views':
        sortQuery = { views: -1, createdAt: -1 }
        break
      case 'recent':
      default:
        sortQuery = { isSticky: -1, createdAt: -1 }
    }

    const posts = await Post.find(query)
      .populate('author', 'username displayName avatar')
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean()

    const total = await Post.countDocuments(query)

    return NextResponse.json({
      posts: posts.map((post: any) => ({
        ...post,
        // Ensure author is never null - provide fallback
        author: post.author || {
          _id: 'unknown',
          username: 'unknown',
          displayName: 'Unknown User',
          avatar: null
        },
        upvoteCount: post.upvotes?.length || 0,
        downvoteCount: post.downvotes?.length || 0,
        commentCount: post.comments?.length || 0,
        views: post.views || 0,
        // Remove sensitive fields
        upvotes: undefined,
        downvotes: undefined,
        comments: undefined
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    })

  } catch (error) {
    console.error('Get posts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}

// POST - Create new post
export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await connectToDatabase()

    const { title, content, category, tags } = await request.json()

    // Validation
    if (!title || !content || !category) {
      return NextResponse.json(
        { error: 'Title, content, and category are required' },
        { status: 400 }
      )
    }

    // Create post
    const post = new Post({
      title,
      content,
      category,
      tags: tags || [],
      author: userPayload.userId,
      upvotes: [],
      downvotes: [],
      views: 0,
      isSticky: false,
      isLocked: false
    })

    await post.save()

    // Populate author info for response
    await post.populate('author', 'username displayName avatar')

    // Ensure author is not null in response
    const responsePost = {
      ...post.toObject(),
      author: post.author || {
        _id: userPayload.userId,
        username: 'unknown',
        displayName: 'Unknown User',
        avatar: null
      },
      upvoteCount: 0,
      downvoteCount: 0,
      commentCount: 0,
      upvotes: undefined,
      downvotes: undefined
    }

    return NextResponse.json({ 
      post: responsePost,
      message: 'Post created successfully' 
    }, { status: 201 })

  } catch (error) {
    console.error('Create post error:', error)
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    )
  }
} 