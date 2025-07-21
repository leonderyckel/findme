'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import Link from 'next/link'

interface Listing {
  _id: string
  title: string
  description: string
  price: number
  category: string
  condition: string
  images: string[]
  seller: {
    username: string
    displayName: string
  }
  createdAt: string
}

export default function MarketplacePage() {
  const { user } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    fetchListings()
  }, [])

  const fetchListings = async () => {
    try {
      // For now, we'll use mock data since we haven't implemented the listings API yet
      setListings([
        {
          _id: '1',
          title: 'Honda Civic Brake Pads',
          description: 'OEM brake pads for Honda Civic 2015-2020. Excellent condition, barely used.',
          price: 89.99,
          category: 'brakes',
          condition: 'like_new',
          images: [],
          seller: {
            username: 'autoparts_pro',
            displayName: 'Auto Parts Pro'
          },
          createdAt: new Date().toISOString()
        },
        {
          _id: '2',
          title: 'Toyota Camry Headlight Assembly',
          description: 'Right side headlight assembly for Toyota Camry 2018-2021. Perfect working condition.',
          price: 245.00,
          category: 'lighting',
          condition: 'excellent',
          images: [],
          seller: {
            username: 'parts_dealer',
            displayName: 'Parts Dealer'
          },
          createdAt: new Date().toISOString()
        }
      ])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching listings:', error)
      setLoading(false)
    }
  }

  const filteredListings = listings.filter(listing => {
    const matchesSearch = listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         listing.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || listing.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading marketplace...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🛒 Marketplace</h1>
          <p className="text-gray-600">Buy and sell automotive parts with verified sellers</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Parts
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for parts, brands, models..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="brakes">Brakes</option>
                <option value="engine">Engine</option>
                <option value="transmission">Transmission</option>
                <option value="lighting">Lighting</option>
                <option value="suspension">Suspension</option>
                <option value="electrical">Electrical</option>
                <option value="body">Body Parts</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Listings Grid */}
        {filteredListings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No listings found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Be the first to list a part for sale!'}
            </p>
            {user && (
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                + Create Listing
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing) => (
              <div key={listing._id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                {/* Image placeholder */}
                <div className="h-48 bg-gray-200 flex items-center justify-center">
                  <div className="text-4xl">📦</div>
                </div>
                
                {/* Content */}
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{listing.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{listing.description}</p>
                  
                  {/* Price and condition */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-green-600">${listing.price}</span>
                    <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded capitalize">
                      {listing.condition.replace('_', ' ')}
                    </span>
                  </div>
                  
                  {/* Seller info */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>By {listing.seller.displayName}</span>
                    <span>{new Date(listing.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 text-sm">
                      View Details
                    </button>
                    <button className="bg-gray-100 text-gray-700 py-2 px-4 rounded hover:bg-gray-200 text-sm">
                      💬 Contact
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Coming Soon Notice */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🚧</div>
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Marketplace Coming Soon!</h3>
          <p className="text-blue-700">
            Full marketplace functionality with real listings, payments, and seller verification is under development.
            This is a preview of the upcoming features.
          </p>
        </div>

        {/* Quick Actions */}
        {user && (
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 text-center">
                <div className="text-2xl mb-2">📝</div>
                <div className="font-medium">Create Listing</div>
                <div className="text-sm opacity-90">Sell your parts</div>
              </button>
              <button className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 text-center">
                <div className="text-2xl mb-2">📋</div>
                <div className="font-medium">My Listings</div>
                <div className="text-sm opacity-90">Manage your sales</div>
              </button>
              <button className="bg-orange-600 text-white p-4 rounded-lg hover:bg-orange-700 text-center">
                <div className="text-2xl mb-2">🛒</div>
                <div className="font-medium">My Orders</div>
                <div className="text-sm opacity-90">Track purchases</div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 