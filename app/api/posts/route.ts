import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import Post from '@/models/Post'
import { getUserFromRequest } from '@/lib/auth'

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
      posts: posts.map(post => ({
        ...post,
        upvoteCount: post.upvotes?.length || 0,
        downvoteCount: post.downvotes?.length || 0,
        upvotes: undefined,
        downvotes: undefined
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get posts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request)
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { title, content, category, tags, images, videoUrl } = await request.json()

    // Validate required fields
    if (!title || !content || !category) {
      return NextResponse.json(
        { error: 'Title, content, and category are required' },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const post = new Post({
      title,
      content,
      category,
      tags: tags || [],
      images: images || [],
      videoUrl,
      author: userPayload.userId
    })

    await post.save()
    await post.populate('author', 'username displayName avatar')

    return NextResponse.json({
      message: 'Post created successfully',
      post: {
        ...post.toObject(),
        upvoteCount: 0,
        downvoteCount: 0,
        upvotes: undefined,
        downvotes: undefined
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Create post error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 