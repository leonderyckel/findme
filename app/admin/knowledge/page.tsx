'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { redirect } from 'next/navigation'

interface KnowledgeEntry {
  _id: string
  title: string
  summary: string
  category: string
  status: string
  usefulness_score: number
  usage_count: number
  createdAt: string
  sources: Array<{
    type: string
    url?: string
    reliability_score: number
    verified: boolean
  }>
}

export default function KnowledgeAdminPage() {
  const { user } = useAuth()
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [adminCheckLoading, setAdminCheckLoading] = useState(true)
  const [newSource, setNewSource] = useState({
    url: '',
    category: '',
    notes: '',
    reliability_score: 7
  })

  if (!user) {
    redirect('/login')
  }

  useEffect(() => {
    checkAdminStatus()
  }, [user])

  useEffect(() => {
    if (isAdmin === true) {
      fetchKnowledge()
    }
  }, [isAdmin])

  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const userData = await response.json()
        setIsAdmin(userData.user?.isAdmin === true)
      } else {
        setIsAdmin(false)
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
      setIsAdmin(false)
    } finally {
      setAdminCheckLoading(false)
    }
  }

  const fetchKnowledge = async () => {
    try {
      const response = await fetch('/api/knowledge?status=approved&limit=20')
      if (response.ok) {
        const data = await response.json()
        setKnowledge(data.knowledge)
      } else if (response.status === 403) {
        setIsAdmin(false)
      }
    } catch (error) {
      console.error('Error fetching knowledge:', error)
    } finally {
      setLoading(false)
    }
  }

  const addSource = async () => {
    if (!newSource.url) return

    setAdding(true)
    try {
      const response = await fetch('/api/knowledge/add-source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSource)
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Source added successfully!\nTitle: ${data.knowledge.title}\nCategory: ${data.knowledge.category}`)
        setNewSource({ url: '', category: '', notes: '', reliability_score: 7 })
        fetchKnowledge() // Refresh the list
      } else if (response.status === 403) {
        setIsAdmin(false)
        alert('Admin access required. You do not have permission to add sources.')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error adding source:', error)
      alert('Failed to add source')
    } finally {
      setAdding(false)
    }
  }

  const addFeedback = async (knowledgeId: string, rating: number, helpful: boolean) => {
    try {
      const response = await fetch(`/api/knowledge/${knowledgeId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating,
          helpful,
          comment: helpful ? 'Helpful' : 'Not helpful'
        })
      })

      if (response.ok) {
        alert('Feedback added successfully!')
        fetchKnowledge() // Refresh to see updated scores
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error adding feedback:', error)
    }
  }

  const CategoryIcon = ({ category }: { category: string }) => {
    const icons: { [key: string]: string } = {
      'installation_guide': '🔧',
      'troubleshooting': '🔍',
      'part_specification': '📋',
      'vehicle_compatibility': '🚗',
      'maintenance_tip': '🛠️',
      'safety_warning': '⚠️',
      'supplier_info': '🏪',
      'pricing_info': '💰',
      'general_automotive': '🚙',
      'other': '📄'
    }
    return <span className="text-lg">{icons[category] || icons.other}</span>
  }

  // Loading admin status
  if (adminCheckLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking admin permissions...</p>
        </div>
      </div>
    )
  }

  // Not admin
  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Access Required</h1>
          <p className="text-gray-600 mb-6">
            This page is restricted to administrators only. You need admin permissions to access the AI knowledge base training interface.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Current user: <span className="font-medium">{user.displayName || user.username}</span>
            </p>
            <p className="text-sm text-gray-500">
              Admin status: <span className="font-medium text-red-600">Not an administrator</span>
            </p>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400">
              If you believe you should have admin access, please contact a system administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Loading knowledge data
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading knowledge base...</p>
        </div>
      </div>
    )
  }

  // Admin interface
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">🧠 Knowledge Base Admin</h1>
            <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium">
              Admin Access
            </span>
          </div>
          <p className="text-gray-600">Manage reliable sources and knowledge entries for the AI assistant</p>
          <p className="text-sm text-green-600 mt-1">
            ✅ Welcome, {user.displayName || user.username}! You have administrator privileges.
          </p>
        </div>

        {/* Add Source Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📚 Add Reliable Source</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL *
              </label>
              <input
                type="url"
                value={newSource.url}
                onChange={(e) => setNewSource({...newSource, url: e.target.value})}
                placeholder="https://example.com/article"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category (auto-detected if empty)
              </label>
              <select
                value={newSource.category}
                onChange={(e) => setNewSource({...newSource, category: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Auto-detect</option>
                <option value="installation_guide">Installation Guide</option>
                <option value="troubleshooting">Troubleshooting</option>
                <option value="part_specification">Part Specification</option>
                <option value="maintenance_tip">Maintenance Tip</option>
                <option value="safety_warning">Safety Warning</option>
                <option value="pricing_info">Pricing Info</option>
                <option value="general_automotive">General Automotive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reliability Score (1-10)
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={newSource.reliability_score}
                onChange={(e) => setNewSource({...newSource, reliability_score: parseInt(e.target.value)})}
                className="w-full"
              />
              <div className="text-center text-sm text-gray-600 mt-1">
                {newSource.reliability_score}/10
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <input
                type="text"
                value={newSource.notes}
                onChange={(e) => setNewSource({...newSource, notes: e.target.value})}
                placeholder="Why is this source reliable?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={addSource}
            disabled={adding || !newSource.url}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {adding ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                ➕ Add Source
              </>
            )}
          </button>
        </div>

        {/* Knowledge Entries */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📖 Knowledge Entries ({knowledge.length})
          </h2>
          
          {knowledge.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No knowledge entries found. Add some reliable sources to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {knowledge.map((entry) => (
                <div key={entry._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryIcon category={entry.category} />
                        <h3 className="font-semibold text-gray-900">{entry.title}</h3>
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                          {entry.category.replace('_', ' ')}
                        </span>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {entry.summary}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          📊 Score: {entry.usefulness_score}/10
                        </span>
                        <span className="flex items-center gap-1">
                          👁️ Used: {entry.usage_count} times
                        </span>
                        <span className="flex items-center gap-1">
                          📅 {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                        {entry.sources[0]?.url && (
                          <a 
                            href={entry.sources[0].url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            🔗 Source
                          </a>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => addFeedback(entry._id, 5, true)}
                        className="bg-green-100 text-green-700 px-3 py-1 rounded text-sm hover:bg-green-200"
                        title="Mark as helpful"
                      >
                        👍 Helpful
                      </button>
                      <button
                        onClick={() => addFeedback(entry._id, 2, false)}
                        className="bg-red-100 text-red-700 px-3 py-1 rounded text-sm hover:bg-red-200"
                        title="Mark as not helpful"
                      >
                        👎 Not helpful
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 