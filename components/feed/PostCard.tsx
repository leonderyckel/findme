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
      avatar?: string
    }
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

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {post.author.avatar ? (
              <img
                src={post.author.avatar}
                alt={post.author.displayName}
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <UserCircleIcon className="h-8 w-8 text-gray-400" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">{post.author.displayName}</p>
              <p className="text-xs text-gray-500">@{post.author.username}</p>
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
        <div className="mb-4">
          <Link href={`/post/${post._id}`} className="block group">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors mb-2">
              {post.title}
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              {truncateContent(post.content)}
            </p>
          </Link>
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center space-x-6">
            {/* Vote buttons */}
            <div className="flex items-center space-x-2">
              <button className="flex items-center space-x-1 text-gray-500 hover:text-green-600 transition-colors">
                <ArrowUpIcon className="h-4 w-4" />
                <span className="text-sm">{post.upvoteCount}</span>
              </button>
              <button className="flex items-center space-x-1 text-gray-500 hover:text-red-600 transition-colors">
                <ArrowDownIcon className="h-4 w-4" />
                <span className="text-sm">{post.downvoteCount}</span>
              </button>
            </div>

            {/* Comments */}
            <Link
              href={`/post/${post._id}#comments`}
              className="flex items-center space-x-1 text-gray-500 hover:text-primary-600 transition-colors"
            >
              <ChatBubbleLeftIcon className="h-4 w-4" />
              <span className="text-sm">{post.commentCount}</span>
            </Link>

            {/* Views */}
            <div className="flex items-center space-x-1 text-gray-500">
              <EyeIcon className="h-4 w-4" />
              <span className="text-sm">{post.views}</span>
            </div>
          </div>

          <Link
            href={`/post/${post._id}`}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Read more
          </Link>
        </div>
      </div>
    </div>
  )
} 