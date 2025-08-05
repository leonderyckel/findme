'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { redirect } from 'next/navigation'

interface SearchResult {
  title: string
  url: string
  description: string
  price?: string
  supplier?: string
  partNumber?: string
  compatibility?: string
  imageUrl?: string
  source: 'brave' | 'ebay' | 'amazon' | 'rockauto' | 'scraped'
}

interface KnowledgeEntry {
  _id: string
  title: string
  summary: string
  category: string
  usefulness_score: number
  usage_count: number
  sources: Array<{
    url?: string
    reliability_score: number
  }>
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  parts?: any[]
  knowledgeBase?: KnowledgeEntry[]
  webResults?: SearchResult[]
  installation?: string
  tips?: string
  sources?: {
    database: number
    knowledge: number
    web: number
  }
  aiPowered?: boolean
  webSearchEnabled?: boolean
  knowledgeBaseEnabled?: boolean
  conversationContext?: {
    userPreferences?: {
      vehicleMake?: string
      vehicleModel?: string
      vehicleYear?: string
      experienceLevel?: string
    }
    proactiveSearchesPerformed?: string[]
    totalResultsFound?: number
    filteredResultsCount?: number
  }
}

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '🧠 Hi! I\'m your AI vehicle parts assistant with access to verified knowledge base and live web search. I can help you find parts, provide expert installation guidance, and search current online listings with real-time pricing. What vehicle part are you looking for today?',
      timestamp: new Date().toISOString()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (!user) {
    redirect('/login')
  }

  const sendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setIsLoading(true)

    // Add user message
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, newUserMessage])

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          context: messages.slice(-5) // Last 5 messages for context
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await response.json()

      // Add AI response
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp,
        parts: data.parts || [],
        knowledgeBase: data.knowledgeBase || [],
        webResults: data.webResults || [],
        installation: data.installation,
        tips: data.tips,
        sources: data.sources,
        aiPowered: data.aiPowered,
        webSearchEnabled: data.webSearchEnabled,
        knowledgeBaseEnabled: data.knowledgeBaseEnabled,
        conversationContext: data.conversationContext
      }
      setMessages(prev => [...prev, aiMessage])

    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const provideFeedback = async (knowledgeId: string, helpful: boolean) => {
    try {
      await fetch(`/api/knowledge/${knowledgeId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: helpful ? 5 : 2,
          helpful,
          comment: helpful ? 'Helpful in chat' : 'Not helpful in chat'
        })
      })
    } catch (error) {
      console.error('Feedback error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg flex flex-col h-[80vh]">
          {/* Header */}
          <div className="border-b border-gray-200 p-4">
            <h1 className="text-xl font-semibold text-gray-900">🧠 AI Parts Assistant</h1>
            <p className="text-sm text-gray-600 mt-1">
              Expert knowledge base + Live web search + Real-time pricing
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-3xl p-4 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  {/* Message content */}
                  {message.role === 'assistant' && (
                    <div className="space-y-4">
                      {/* AI Response - Natural conversation first */}
                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">{message.content}</div>
                      </div>

                      {/* Only show context if AI made proactive searches */}
                      {message.conversationContext?.proactiveSearchesPerformed && 
                       message.conversationContext.proactiveSearchesPerformed.length > 0 && (
                        <div className="bg-indigo-50 border-l-4 border-indigo-400 p-3 rounded">
                          <details className="cursor-pointer">
                            <summary className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                              🔍 Behind the scenes: I also searched for related info
                            </summary>
                            <div className="text-sm space-y-2 mt-2">
                              <div>
                                <p className="text-indigo-800 font-medium">Additional searches I performed:</p>
                                <ul className="list-disc list-inside text-indigo-700 text-xs ml-2">
                                  {message.conversationContext.proactiveSearchesPerformed.map((search, idx) => (
                                    <li key={idx}>{search}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="flex gap-4 text-xs text-indigo-600">
                                <span>📊 Found: {message.conversationContext.totalResultsFound} total results</span>
                                <span>✨ Filtered to: {message.conversationContext.filteredResultsCount} relevant</span>
                              </div>
                            </div>
                          </details>
                        </div>
                      )}

                      {/* Only show expert knowledge if there are high-quality, relevant entries */}
                      {message.knowledgeBase && 
                       message.knowledgeBase.filter(kb => kb.usefulness_score >= 7).length > 0 && (
                        <div className="bg-purple-50 border-l-4 border-purple-400 p-3 rounded">
                          <details className="cursor-pointer">
                            <summary className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                              📚 Technical guides available ({message.knowledgeBase.filter(kb => kb.usefulness_score >= 7).length})
                            </summary>
                            <div className="space-y-2 mt-2">
                              {message.knowledgeBase
                                .filter(kb => kb.usefulness_score >= 7)
                                .slice(0, 3)
                                .map((kb, idx) => (
                                <div key={idx} className="bg-white p-3 rounded border">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h5 className="font-medium text-purple-800 line-clamp-1 flex items-center gap-2">
                                        {kb.category === 'installation_guide' && '🔧'}
                                        {kb.category === 'troubleshooting' && '🔍'}
                                        {kb.category === 'safety_warning' && '⚠️'}
                                        {kb.category === 'maintenance_tip' && '🛠️'}
                                        {kb.category === 'part_specification' && '📋'}
                                        {kb.title}
                                      </h5>
                                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                        {kb.summary}
                                      </p>
                                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                        <span className="font-medium capitalize bg-purple-100 px-2 py-1 rounded">
                                          {kb.category.replace('_', ' ')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                          ⭐ {kb.usefulness_score}/10
                                        </span>
                                        {kb.sources[0]?.url && (
                                          <a 
                                            href={kb.sources[0].url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-purple-600 hover:text-purple-800 flex items-center gap-1"
                                          >
                                            🔗 Source
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <div className="ml-3 flex flex-col gap-1">
                                      <button
                                        onClick={() => provideFeedback(kb._id, true)}
                                        className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-200 transition-colors"
                                        title="This helped me!"
                                      >
                                        👍
                                      </button>
                                      <button
                                        onClick={() => provideFeedback(kb._id, false)}
                                        className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-200 transition-colors"
                                        title="Not what I needed"
                                      >
                                        👎
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}

                      {/* Only show web results if there are quality results with prices or from good sources */}
                      {message.webResults && 
                       message.webResults.filter(r => r.price || ['RockAuto', 'Amazon'].includes(r.supplier || '')).length > 0 && (
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                          <details className="cursor-pointer">
                            <summary className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                              🛒 Current market options ({message.webResults.filter(r => r.price || ['RockAuto', 'Amazon'].includes(r.supplier || '')).length})
                            </summary>
                            <div className="space-y-2 mt-2">
                              {message.webResults
                                .filter(r => r.price || ['RockAuto', 'Amazon'].includes(r.supplier || ''))
                                .slice(0, 4)
                                .map((result, idx) => (
                                <div key={idx} className="bg-white p-3 rounded border">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <a 
                                        href={result.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="font-medium text-blue-700 hover:text-blue-900 line-clamp-2"
                                      >
                                        {result.title}
                                      </a>
                                      <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                                        {result.description}
                                      </p>
                                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                        <span className="font-medium">{result.supplier}</span>
                                      </div>
                                    </div>
                                    {result.price && (
                                      <div className="ml-3 text-right">
                                        <div className="font-bold text-green-600">{result.price}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}

                      {/* Installation guide - only if specifically relevant */}
                      {message.installation && message.installation.length > 100 && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                          <details className="cursor-pointer">
                            <summary className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                              🔧 Installation guidance available
                            </summary>
                            <div className="text-sm mt-2">
                              <div className="whitespace-pre-wrap bg-white p-3 rounded border text-gray-800">
                                {message.installation}
                              </div>
                            </div>
                          </details>
                        </div>
                      )}

                      {/* Tips - only if they're substantial and helpful */}
                      {message.tips && message.tips.length > 50 && 
                       !message.tips.includes('Always use quality parts and follow proper torque specifications') && (
                        <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
                          <details className="cursor-pointer">
                            <summary className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                              💡 Pro tips
                            </summary>
                            <div className="text-sm mt-2">
                              <div className="whitespace-pre-wrap bg-white p-3 rounded border text-gray-800">
                                {message.tips}
                              </div>
                            </div>
                          </details>
                        </div>
                      )}

                      {/* Sources summary - simplified */}
                      {message.sources && (
                        <div className="flex items-center gap-4 text-xs bg-gray-50 rounded px-3 py-2 text-gray-600">
                          <span>Sources used:</span>
                          {message.sources.knowledge > 0 && <span>📚 {message.sources.knowledge} guides</span>}
                          {message.sources.web > 0 && <span>🌐 {message.sources.web} listings</span>}
                          {message.sources.database > 0 && <span>🗄️ {message.sources.database} parts</span>}
                          {message.aiPowered && <span className="text-green-600">🤖 AI-powered</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-gray-600">Searching knowledge base, database and web for parts...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex space-x-4">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
                placeholder="Ask about vehicle parts, installation, pricing..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                🧠 Knowledge base enabled
              </span>
              <span className="flex items-center gap-1">
                🤖 GPT-4 Turbo powered
              </span>
              <span className="flex items-center gap-1">
                🌐 Live web search
              </span>
              <span className="flex items-center gap-1">
                📊 Real-time pricing
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 