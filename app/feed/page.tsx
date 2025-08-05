'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import Navbar from '@/components/layout/Navbar'
import PostCard from '@/components/feed/PostCard'
import CreatePostModal from '@/components/feed/CreatePostModal'
import { 
  PlusIcon, 
  FunnelIcon, 
  FireIcon, 
  SparklesIcon,
  TrophyIcon,
  BoltIcon,
  HeartIcon,
  BookmarkIcon
} from '@heroicons/react/24/outline'

interface Post {
  _id: string
  title: string
  content: string
  category: 'question' | 'tutorial' | 'discussion'
  tags: string[]
  upvoteCount: number
  downvoteCount: number
  commentCount: number
  views: number
  createdAt: string
  author: {
    _id: string
    username: string
    displayName: string
    avatar?: string
    reputation?: number
    expertBadges?: string[]
  }
  aiRecommended?: boolean
  trending?: boolean
}

interface TrendingTopic {
  tag: string
  postCount: number
  growth: string
}

interface UserStats {
  reputation: number
  postsCreated: number
  helpfulAnswers: number
  badges: string[]
  level: string
}

export default function FeedPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('smart')
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([
    { tag: 'brake-pads', postCount: 23, growth: '+15%' },
    { tag: 'oil-change', postCount: 18, growth: '+8%' },
    { tag: 'engine-trouble', postCount: 31, growth: '+22%' },
    { tag: 'honda-cb750', postCount: 12, growth: '+5%' },
    { tag: 'diy-repair', postCount: 27, growth: '+18%' }
  ])
  const [userStats, setUserStats] = useState<UserStats>({
    reputation: 1250,
    postsCreated: 8,
    helpfulAnswers: 23,
    badges: ['Helper', 'First Post', 'Problem Solver'],
    level: 'Mechanic Apprentice'
  })
  const [showAIRecommendations, setShowAIRecommendations] = useState(true)

  useEffect(() => {
    fetchPosts()
  }, [category, sort])

  const fetchPosts = async () => {
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.append('category', category)
      params.append('sort', sort)
      params.append('limit', '20')
      if (showAIRecommendations) params.append('aiRecommended', 'true')

      const response = await fetch(`/api/posts?${params}`)
      if (response.ok) {
        const data = await response.json()
        // Add mock AI recommendations and trending flags
        const enhancedPosts = data.posts.map((post: Post, idx: number) => ({
          ...post,
          aiRecommended: showAIRecommendations && idx < 3,
          trending: idx === 0 || idx === 4,
          author: {
            ...post.author,
            reputation: Math.floor(Math.random() * 2000) + 500,
            expertBadges: idx % 3 === 0 ? ['Expert'] : []
          }
        }))
        setPosts(enhancedPosts)
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePostCreated = (newPost: Post) => {
    setPosts([newPost, ...posts])
    setShowCreateModal(false)
  }

  const categories = [
    { value: 'all', label: 'All Posts', icon: '📋' },
    { value: 'question', label: 'Questions', icon: '❓' },
    { value: 'tutorial', label: 'Tutorials', icon: '📚' },
    { value: 'discussion', label: 'Discussions', icon: '💬' }
  ]

  const sortOptions = [
    { value: 'smart', label: 'AI Smart Feed', icon: '🤖' },
    { value: 'recent', label: 'Most Recent', icon: '🕒' },
    { value: 'popular', label: 'Most Popular', icon: '🔥' },
    { value: 'views', label: 'Most Viewed', icon: '👀' }
  ]

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Please sign in to view the feed</h2>
            <p className="mt-2 text-gray-600">Create an account or sign in to start participating in the community.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Community Feed</h1>
            <p className="text-gray-600">Share knowledge and get help from the community</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Post
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-input w-auto"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="form-input w-auto"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-2 text-gray-600">Loading posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900">No posts yet</h3>
              <p className="text-gray-500">Be the first to start a conversation!</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 btn-primary"
              >
                Create First Post
              </button>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post._id} post={post} />
            ))
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePostModal
          onClose={() => setShowCreateModal(false)}
          onPostCreated={handlePostCreated}
        />
      )}
    </div>
  )
} 