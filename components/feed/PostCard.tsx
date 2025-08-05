'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  ChatBubbleLeftIcon, 
  EyeIcon,
  UserCircleIcon,
  StarIcon,
  FireIcon,
  SparklesIcon,
  BookmarkIcon,
  HeartIcon,
  ShareIcon
} from '@heroicons/react/24/outline'
import {
  HeartIcon as HeartIconSolid,
  BookmarkIcon as BookmarkIconSolid
} from '@heroicons/react/24/solid'

interface PostCardProps {
  post: {
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
    aiRecommended?: boolean
    trending?: boolean
    author: {
      _id: string
      username: string
      displayName: string
      avatar?: string | null
      reputation?: number
      expertBadges?: string[]
    } | null
  }
}

export default function PostCard({ post }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(false)

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'question':
        return 'bg-blue-100 text-blue-800'
      case 'tutorial':
        return 'bg-green-100 text-green-800'
      case 'discussion':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getReputationLevel = (reputation: number) => {
    if (reputation >= 2000) return { level: 'Expert', color: 'text-purple-600' }
    if (reputation >= 1000) return { level: 'Skilled', color: 'text-blue-600' }
    if (reputation >= 500) return { level: 'Helper', color: 'text-green-600' }
    return { level: 'Novice', color: 'text-gray-600' }
  }

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'like':
        setIsLiked(!isLiked)
        break
      case 'bookmark':
        setIsBookmarked(!isBookmarked)
        break
      case 'share':
        navigator.share({
          title: post.title,
          text: post.content.substring(0, 100) + '...',
          url: `/feed/post/${post._id}`
        })
        break
    }
  }

  // Default author info for when author is null
  const authorInfo = post.author || {
    _id: 'unknown',
    username: 'unknown',
    displayName: 'Unknown User',
    avatar: null,
    reputation: 0,
    expertBadges: []
  }

  const reputationInfo = getReputationLevel(authorInfo.reputation || 0)

  return (
    <div 
      className={`bg-white rounded-lg border transition-all hover:shadow-md ${
        post.aiRecommended ? 'border-purple-200 shadow-sm' : 'border-gray-200'
      }`}
      onMouseEnter={() => setShowQuickActions(true)}
      onMouseLeave={() => setShowQuickActions(false)}
    >
      {/* AI Recommendation & Trending Indicators */}
      {(post.aiRecommended || post.trending) && (
        <div className="px-6 pt-4 pb-2">
          <div className="flex gap-2">
            {post.aiRecommended && (
              <span className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                <SparklesIcon className="h-3 w-3" />
                AI Recommended
              </span>
            )}
            {post.trending && (
              <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                <FireIcon className="h-3 w-3" />
                Trending
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {authorInfo.avatar ? (
              <img
                src={authorInfo.avatar}
                alt={authorInfo.displayName || 'User avatar'}
                className="h-10 w-10 rounded-full object-cover border-2 border-gray-100"
              />
            ) : (
              <UserCircleIcon className="h-10 w-10 text-gray-400" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">
                  {authorInfo.displayName || 'Unknown User'}
                </p>
                {authorInfo.expertBadges && authorInfo.expertBadges.length > 0 && (
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <StarIcon className="h-3 w-3" />
                    {authorInfo.expertBadges[0]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>@{authorInfo.username || 'unknown'}</span>
                <span>•</span>
                <span className={reputationInfo.color}>
                  {authorInfo.reputation || 0} reputation ({reputationInfo.level})
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(post.category)}`}>
              {post.category}
            </span>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Content */}
        <Link href={`/feed/post/${post._id}`} className="block">
          <h3 className="text-lg font-medium text-gray-900 mb-2 hover:text-blue-600 transition-colors">
            {post.title}
          </h3>
          <p className="text-gray-600 mb-4">
            {truncateContent(post.content)}
          </p>
        </Link>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center space-x-6">
            {/* Upvote/Downvote */}
            <div className="flex items-center space-x-2">
              <button className="flex items-center space-x-1 text-gray-500 hover:text-green-600 transition-colors">
                <ArrowUpIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{post.upvoteCount || 0}</span>
              </button>
              <button className="flex items-center space-x-1 text-gray-500 hover:text-red-600 transition-colors">
                <ArrowDownIcon className="h-4 w-4" />
                <span className="text-sm">{post.downvoteCount || 0}</span>
              </button>
            </div>

            {/* Comments */}
            <Link href={`/feed/post/${post._id}#comments`}>
              <button className="flex items-center space-x-1 text-gray-500 hover:text-blue-600 transition-colors">
                <ChatBubbleLeftIcon className="h-4 w-4" />
                <span className="text-sm">{post.commentCount || 0} comments</span>
              </button>
            </Link>

            {/* Views */}
            <div className="flex items-center space-x-1 text-gray-500">
              <EyeIcon className="h-4 w-4" />
              <span className="text-sm">{post.views || 0} views</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick Actions */}
            {showQuickActions && (
              <div className="flex items-center space-x-1 animate-fadeIn">
                <button
                  onClick={() => handleQuickAction('like')}
                  className="p-2 rounded-full hover:bg-red-50 transition-colors"
                  title="Like this post"
                >
                  {isLiked ? (
                    <HeartIconSolid className="h-4 w-4 text-red-500" />
                  ) : (
                    <HeartIcon className="h-4 w-4 text-gray-400 hover:text-red-500" />
                  )}
                </button>
                <button
                  onClick={() => handleQuickAction('bookmark')}
                  className="p-2 rounded-full hover:bg-blue-50 transition-colors"
                  title="Save for later"
                >
                  {isBookmarked ? (
                    <BookmarkIconSolid className="h-4 w-4 text-blue-500" />
                  ) : (
                    <BookmarkIcon className="h-4 w-4 text-gray-400 hover:text-blue-500" />
                  )}
                </button>
                <button
                  onClick={() => handleQuickAction('share')}
                  className="p-2 rounded-full hover:bg-green-50 transition-colors"
                  title="Share this post"
                >
                  <ShareIcon className="h-4 w-4 text-gray-400 hover:text-green-500" />
                </button>
              </div>
            )}

            {/* Read more */}
            <Link href={`/feed/post/${post._id}`}>
              <span className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                Read more →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 