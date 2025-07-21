'use client'

import React from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  ChatBubbleLeftIcon, 
  EyeIcon,
  UserCircleIcon 
} from '@heroicons/react/24/outline'

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
    author: {
      _id: string
      username: string
      displayName: string
      avatar?: string | null
    } | null
  }
}

export default function PostCard({ post }: PostCardProps) {
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

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  // Default author info for when author is null
  const authorInfo = post.author || {
    _id: 'unknown',
    username: 'unknown',
    displayName: 'Unknown User',
    avatar: null
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {authorInfo.avatar ? (
              <img
                src={authorInfo.avatar}
                alt={authorInfo.displayName || 'User avatar'}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <UserCircleIcon className="h-8 w-8 text-gray-400" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">
                {authorInfo.displayName || 'Unknown User'}
              </p>
              <p className="text-xs text-gray-500">
                @{authorInfo.username || 'unknown'}
              </p>
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
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
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
                <span className="text-sm">{post.upvoteCount || 0}</span>
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

          {/* Read more */}
          <Link href={`/feed/post/${post._id}`}>
            <span className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Read more →
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
} 