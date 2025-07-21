export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🛒 Marketplace</h1>
        <p className="text-gray-600">Buy and sell automotive parts with verified sellers</p>
        
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Featured Parts</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border rounded-lg p-4">
              <div className="text-4xl mb-2">🔧</div>
              <h3 className="font-semibold">Honda Brake Pads</h3>
              <p className="text-gray-600 text-sm">OEM quality brake pads</p>
              <p className="text-lg font-bold text-green-600 mt-2">$89.99</p>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="text-4xl mb-2">💡</div>
              <h3 className="font-semibold">Toyota Headlight</h3>
              <p className="text-gray-600 text-sm">Right side assembly</p>
              <p className="text-lg font-bold text-green-600 mt-2">$245.00</p>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="text-4xl mb-2">⚙️</div>
              <h3 className="font-semibold">Ford Air Filter</h3>
              <p className="text-gray-600 text-sm">High-performance filter</p>
              <p className="text-lg font-bold text-green-600 mt-2">$45.00</p>
            </div>
          </div>
        </div>
        
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🚧</div>
          <h3 className="text-lg font-semibold text-blue-900">Marketplace Coming Soon!</h3>
          <p className="text-blue-700">Full functionality under development.</p>
        </div>
      </div>
    </div>
  )
} 