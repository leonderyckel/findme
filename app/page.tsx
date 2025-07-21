import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { ArrowRightIcon, ChatBubbleLeftIcon, UserGroupIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'

export default function HomePage() {
  const features = [
    {
      name: 'AI Assistant',
      description: 'Get help finding the right parts for your vehicle with our intelligent assistant.',
      icon: ChatBubbleLeftIcon,
      href: '/chat'
    },
    {
      name: 'Community Feed',
      description: 'Ask questions, share tutorials, and connect with fellow enthusiasts.',
      icon: UserGroupIcon,
      href: '/feed'
    },
    {
      name: 'Marketplace',
      description: 'Buy and sell vehicle parts with confidence in our trusted marketplace.',
      icon: ShoppingBagIcon,
      href: '/marketplace'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Hero Section */}
      <div className="relative bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative pt-16 pb-20 sm:pt-24 sm:pb-24">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
                <span className="block">Find the right parts for</span>
                <span className="block text-primary-600">your vehicle</span>
              </h1>
              <p className="mx-auto mt-6 max-w-md text-lg text-gray-500 sm:max-w-3xl">
                Get AI-powered assistance, connect with the community, and discover parts for your motorcycle, car, or truck. Everything you need in one place.
              </p>
              <div className="mx-auto mt-10 max-w-sm sm:max-w-none sm:flex sm:justify-center">
                <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex">
                  <Link
                    href="/register"
                    className="flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 md:py-4 md:text-lg md:px-10 transition-colors"
                  >
                    Get started
                    <ArrowRightIcon className="ml-2 h-5 w-5" />
                  </Link>
                  <Link
                    href="/chat"
                    className="flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-primary-50 hover:bg-primary-100 md:py-4 md:text-lg md:px-10 transition-colors"
                  >
                    Try AI Assistant
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need for your vehicle
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
              From finding parts to getting installation help, our platform has you covered.
            </p>
          </div>

          <div className="mt-16">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Link key={feature.name} href={feature.href} className="group">
                  <div className="relative rounded-lg bg-white p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div>
                      <feature.icon className="h-8 w-8 text-primary-600" />
                      <h3 className="mt-4 text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {feature.name}
                      </h3>
                      <p className="mt-2 text-gray-500">
                        {feature.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center text-primary-600 group-hover:text-primary-700">
                      <span className="text-sm font-medium">Learn more</span>
                      <ArrowRightIcon className="ml-2 h-4 w-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
              Join thousands of vehicle enthusiasts who trust FindMe for their parts and maintenance needs.
            </p>
            <div className="mt-8">
              <Link
                href="/register"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-gray-50 transition-colors"
              >
                Sign up for free
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 