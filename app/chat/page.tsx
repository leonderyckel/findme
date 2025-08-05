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
                      {/* AI Response */}
                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </div>

                      {/* Conversation Context Info */}
                      {message.conversationContext && (
                        <div className="bg-indigo-50 border-l-4 border-indigo-400 p-3 rounded">
                          <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                            🧠 Smart Context & Learning
                          </h4>
                          <div className="text-sm space-y-2">
                            {message.conversationContext.userPreferences?.vehicleMake && (
                              <p className="text-indigo-800">
                                <span className="font-medium">Your Vehicle:</span> {message.conversationContext.userPreferences.vehicleMake} {message.conversationContext.userPreferences.vehicleModel} {message.conversationContext.userPreferences.vehicleYear}
                              </p>
                            )}
                            <p className="text-indigo-800">
                              <span className="font-medium">Experience Level:</span> {message.conversationContext.userPreferences?.experienceLevel || 'Intermediate'}
                            </p>
                                                         {message.conversationContext.proactiveSearchesPerformed && message.conversationContext.proactiveSearchesPerformed.length > 0 && (
                               <div>
                                 <p className="text-indigo-800 font-medium">🔍 Proactive Searches Performed:</p>
                                 <ul className="list-disc list-inside text-indigo-700 text-xs ml-2">
                                   {message.conversationContext.proactiveSearchesPerformed.map((search, idx) => (
                                     <li key={idx}>{search}</li>
                                   ))}
                                 </ul>
                               </div>
                             )}
                            <div className="flex gap-4 text-xs text-indigo-600">
                              <span>📊 Found: {message.conversationContext.totalResultsFound} results</span>
                              <span>✨ Filtered to: {message.conversationContext.filteredResultsCount} relevant</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expert Knowledge */}
                      {message.knowledgeBase && message.knowledgeBase.length > 0 && (
                        <div className="bg-purple-50 border-l-4 border-purple-400 p-3 rounded">
                          <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                            🧠 Expert Knowledge ({message.knowledgeBase.length})
                          </h4>
                          <p className="text-sm text-purple-800 mb-3 italic">
                            These are verified guides and tips from our expert knowledge base - trusted by mechanics and DIYers:
                          </p>
                          <div className="space-y-2">
                            {message.knowledgeBase.slice(0, 3).map((kb, idx) => (
                              <div key={idx} className="bg-white p-3 rounded border">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-purple-800 line-clamp-1 flex items-center gap-2">
                                      {kb.category === 'installation_guide' && '🔧'}
                                      {kb.category === 'troubleshooting' && '🔍'}
                                      {kb.category === 'safety_warning' && '⚠️'}
                                      {kb.category === 'maintenance_tip' && '🛠️'}
                                      {kb.category === 'part_specification' && '📋'}
                                      {!['installation_guide', 'troubleshooting', 'safety_warning', 'maintenance_tip', 'part_specification'].includes(kb.category) && '📄'}
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
                                        <span className="text-purple-600">
                                          {kb.usefulness_score >= 8 ? 'Excellent' : 
                                           kb.usefulness_score >= 6 ? 'Good' : 
                                           kb.usefulness_score >= 4 ? 'Fair' : 'Basic'}
                                        </span>
                                      </span>
                                      <span className="text-green-600">
                                        ✓ Used {kb.usage_count}x
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
                                      👍 Helpful
                                    </button>
                                    <button
                                      onClick={() => provideFeedback(kb._id, false)}
                                      className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-200 transition-colors"
                                      title="Not what I needed"
                                    >
                                      👎 Not helpful
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {message.knowledgeBase.length > 3 && (
                            <p className="text-xs text-purple-600 mt-2 text-center">
                              And {message.knowledgeBase.length - 3} more expert entries found - all verified and reliable!
                            </p>
                          )}
                        </div>
                      )}

                      {/* Web Results */}
                      {message.webResults && message.webResults.length > 0 && (
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            🛒 Live Market Results ({message.webResults.length})
                          </h4>
                          <p className="text-sm text-blue-800 mb-3 italic">
                            Fresh from the web - here's what's available right now with current pricing:
                          </p>
                          <div className="space-y-2">
                            {message.webResults.slice(0, 5).map((result, idx) => (
                              <div key={idx} className="bg-white p-3 rounded border">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <a 
                                      href={result.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="font-medium text-blue-700 hover:text-blue-900 line-clamp-2 flex items-center gap-2"
                                    >
                                      {result.supplier === 'eBay' && '🏪'}
                                      {result.supplier === 'Amazon' && '📦'}
                                      {result.supplier === 'RockAuto' && '🔧'}
                                      {!['eBay', 'Amazon', 'RockAuto'].includes(result.supplier || '') && '🛒'}
                                      {result.title}
                                    </a>
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                      {result.description}
                                    </p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                      <span className="font-medium bg-blue-100 px-2 py-1 rounded flex items-center gap-1">
                                        {result.supplier === 'eBay' && '🏪 eBay'} 
                                        {result.supplier === 'Amazon' && '📦 Amazon'}
                                        {result.supplier === 'RockAuto' && '🔧 RockAuto'}
                                        {!['eBay', 'Amazon', 'RockAuto'].includes(result.supplier || '') && `🛒 ${result.supplier}`}
                                      </span>
                                      {result.source && (
                                        <span className="bg-gray-100 px-2 py-1 rounded">
                                          {result.source.toUpperCase()}
                                        </span>
                                      )}
                                      {idx === 0 && (
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                                          🏆 Top Pick
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {result.price && (
                                    <div className="ml-3 text-right">
                                      <div className="font-bold text-green-600 text-lg">{result.price}</div>
                                      {idx === 0 && message.webResults && message.webResults.length > 1 && (
                                        <div className="text-xs text-gray-500">
                                          Compare others →
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Price Analysis */}
                          {(() => {
                            const pricesAvailable = message.webResults.filter(r => r.price)
                            if (pricesAvailable.length > 1) {
                              const prices = pricesAvailable.map(r => parseFloat(r.price?.replace(/[^0-9.]/g, '') || '0'))
                              const lowestPrice = Math.min(...prices)
                              const highestPrice = Math.max(...prices)
                              const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length
                              
                              return (
                                <div className="mt-3 bg-white p-2 rounded border text-xs">
                                  <p className="font-medium text-blue-800 mb-1">💰 Price Analysis:</p>
                                  <div className="flex gap-4 text-gray-600">
                                    <span>Lowest: <span className="text-green-600 font-medium">${lowestPrice.toFixed(2)}</span></span>
                                    <span>Average: <span className="text-blue-600 font-medium">${avgPrice.toFixed(2)}</span></span>
                                    <span>Highest: <span className="text-red-600 font-medium">${highestPrice.toFixed(2)}</span></span>
                                  </div>
                                  {highestPrice / lowestPrice > 1.5 && (
                                    <p className="text-orange-600 mt-1">
                                      💡 Significant price spread - consider OEM vs aftermarket quality differences
                                    </p>
                                  )}
                                </div>
                              )
                            }
                            return null
                          })()}
                          
                          {message.webResults.length > 5 && (
                            <p className="text-xs text-blue-600 mt-2 text-center">
                              And {message.webResults.length - 5} more listings available - shop around for the best deal!
                            </p>
                          )}
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
                          <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                            🔧 Step-by-Step Installation
                          </h4>
                          <div className="text-sm">
                            <p className="text-yellow-800 mb-2 italic">
                              Here's how to tackle this installation safely:
                            </p>
                            <div className="whitespace-pre-wrap bg-white p-3 rounded border">
                              {message.installation}
                            </div>
                            <p className="text-xs text-yellow-700 mt-2">
                              💡 Take your time with each step - rushing leads to mistakes!
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Tips */}
                      {message.tips && (
                        <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
                          <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                            💡 Pro Tips & Safety Reminders
                          </h4>
                          <div className="text-sm">
                            <p className="text-orange-800 mb-2 italic">
                              Learn from the pros - here's what seasoned mechanics want you to know:
                            </p>
                            <div className="whitespace-pre-wrap bg-white p-3 rounded border">
                              {message.tips}
                            </div>
                            <p className="text-xs text-orange-700 mt-2">
                              ⚠️ When in doubt, consult a professional - your safety is worth more than any part!
                            </p>
                          </div>
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