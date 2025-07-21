'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import Navbar from '@/components/layout/Navbar'
import { PaperAirplaneIcon, SparklesIcon, WrenchIcon, LinkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  parts?: any[]
  installation?: string
  tips?: string
}

interface PartInfo {
  name: string
  partNumber: string
  description: string
  compatibleVehicles: Array<{
    make: string
    model: string
    year: number[]
  }>
  externalLinks: Array<{
    supplier: string
    url: string
    price?: number
  }>
}

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hi! I'm your AI parts assistant. I can help you find vehicle parts, provide installation guidance, and answer maintenance questions. What's your vehicle and what do you need help with?",
      isUser: false,
      timestamp: new Date()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      isUser: true,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage.trim(),
          context: messages.slice(-5) // Send last 5 messages for context
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (response.ok) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          isUser: false,
          timestamp: new Date(),
          parts: data.parts || [],
          installation: data.installation,
          tips: data.tips
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        toast.error(data.error || 'Failed to get response')
      }
    } catch (error) {
      toast.error('Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  const renderPart = (part: PartInfo, index: number) => (
    <div key={index} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50">
      <h4 className="font-semibold text-gray-900 mb-2">{part.name}</h4>
      <p className="text-sm text-gray-600 mb-2">{part.description}</p>
      <p className="text-xs text-gray-500 mb-2">Part #: {part.partNumber}</p>
      
      {part.compatibleVehicles && part.compatibleVehicles.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-700 mb-1">Compatible with:</p>
          {part.compatibleVehicles.map((vehicle, idx) => (
            <span key={idx} className="inline-block text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2 mb-1">
              {vehicle.make} {vehicle.model} ({vehicle.year.join(', ')})
            </span>
          ))}
        </div>
      )}
      
      {part.externalLinks && part.externalLinks.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Available from:</p>
          <div className="space-y-1">
            {part.externalLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-sm text-primary-600 hover:text-primary-800"
              >
                <LinkIcon className="h-3 w-3 mr-1" />
                {link.supplier} {link.price && `- $${link.price}`}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <SparklesIcon className="mx-auto h-12 w-12 text-primary-600 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">AI Parts Assistant</h2>
            <p className="mt-2 text-gray-600">Please sign in to use the AI assistant</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[calc(100vh-12rem)] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <SparklesIcon className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI Parts Assistant</h1>
                <p className="text-sm text-gray-600">Get help finding parts and installation guidance</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl px-4 py-3 rounded-lg ${
                    message.isUser
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Parts recommendations */}
                  {message.parts && message.parts.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-3 flex items-center">
                        <WrenchIcon className="h-4 w-4 mr-1" />
                        Recommended Parts:
                      </h4>
                      {message.parts.map((part, index) => renderPart(part, index))}
                    </div>
                  )}
                  
                  {/* Installation guide */}
                  {message.installation && (
                    <div className="mt-4 p-3 bg-white bg-opacity-20 rounded">
                      <h4 className="text-sm font-semibold mb-2">Installation Guide:</h4>
                      <p className="text-sm whitespace-pre-wrap">{message.installation}</p>
                    </div>
                  )}
                  
                  {/* Tips */}
                  {message.tips && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <h4 className="text-sm font-semibold mb-2 text-yellow-800">💡 Pro Tips:</h4>
                      <p className="text-sm text-yellow-800">{message.tips}</p>
                    </div>
                  )}
                  
                  <p className="text-xs mt-2 opacity-75">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                    <span className="text-sm text-gray-600">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-6 border-t border-gray-200">
            <form onSubmit={handleSendMessage} className="flex space-x-4">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about parts, installation, or maintenance..."
                className="flex-1 form-input"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </button>
            </form>
            
            {/* Quick suggestions */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "My 1980 CB750 needs a new cam chain tensioner",
                  "Best brake pads for Honda CB750",
                  "How to replace motorcycle chain",
                  "Oil filter for 2020 Honda Civic"
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setInputMessage(suggestion)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 