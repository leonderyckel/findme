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

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  parts?: any[]
  webResults?: SearchResult[]
  installation?: string
  tips?: string
  sources?: {
    database: number
    web: number
  }
  aiPowered?: boolean
  webSearchEnabled?: boolean
}

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '🔧 Hi! I\'m your AI vehicle parts assistant. I can help you find parts, provide installation guidance, and search current online listings with real-time pricing. What vehicle part are you looking for today?',
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
        webResults: data.webResults || [],
        installation: data.installation,
        tips: data.tips,
        sources: data.sources,
        aiPowered: data.aiPowered,
        webSearchEnabled: data.webSearchEnabled
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg flex flex-col h-[80vh]">
          {/* Header */}
          <div className="border-b border-gray-200 p-4">
            <h1 className="text-xl font-semibold text-gray-900">🤖 AI Parts Assistant</h1>
            <p className="text-sm text-gray-600 mt-1">
              Expert vehicle parts help with live web search • Database + Real-time pricing
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
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  
                  {/* AI Response extras */}
                  {message.role === 'assistant' && (
                    <div className="mt-3 space-y-3">
                      
                      {/* Sources indicator */}
                      {message.sources && (
                        <div className="flex items-center gap-4 text-xs bg-gray-50 rounded px-3 py-2">
                          <span className="font-medium">Sources:</span>
                          <span className="flex items-center gap-1">
                            🗄️ Database: {message.sources.database}
                          </span>
                          <span className="flex items-center gap-1">
                            🌐 Web: {message.sources.web}
                          </span>
                          {message.aiPowered && (
                            <span className="flex items-center gap-1 text-green-600">
                              🤖 GPT-4 Turbo
                            </span>
                          )}
                        </div>
                      )}

                      {/* Web search results */}
                      {message.webResults && message.webResults.length > 0 && (
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            🛍️ Current Online Listings ({message.webResults.length})
                          </h4>
                          <div className="space-y-2">
                            {message.webResults.slice(0, 5).map((result, idx) => (
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
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                      {result.description}
                                    </p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                      <span className="font-medium">{result.supplier}</span>
                                      {result.source && (
                                        <span className="bg-gray-100 px-2 py-1 rounded">
                                          {result.source.toUpperCase()}
                                        </span>
                                      )}
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
                        </div>
                      )}

                      {/* Database parts */}
                      {message.parts && message.parts.length > 0 && (
                        <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded">
                          <h4 className="font-semibold text-green-900 mb-2">
                            📚 From Our Parts Database ({message.parts.length})
                          </h4>
                          <div className="space-y-2">
                            {message.parts.map((part, idx) => (
                              <div key={idx} className="bg-white p-2 rounded text-sm">
                                <div className="font-medium">{part.name}</div>
                                <div className="text-gray-600">{part.description}</div>
                                {part.partNumber && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Part #: {part.partNumber}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Installation guide */}
                      {message.installation && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                          <h4 className="font-semibold text-yellow-900 mb-2">🔧 Installation Guide</h4>
                          <div className="text-sm whitespace-pre-wrap">{message.installation}</div>
                        </div>
                      )}

                      {/* Tips */}
                      {message.tips && (
                        <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
                          <h4 className="font-semibold text-orange-900 mb-2">💡 Tips & Safety</h4>
                          <div className="text-sm whitespace-pre-wrap">{message.tips}</div>
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
                    <span className="text-gray-600">Searching database and web for parts...</span>
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
                placeholder="Ask about vehicle parts, prices, installation..."
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
                🤖 GPT-4 Turbo enabled
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