# FindMe - Vehicle Parts & Community Platform

A full-stack web application built with Next.js and MongoDB that combines AI-powered parts finding, social community features, and a marketplace for vehicle enthusiasts.

## Features

### ✅ Current Features (Minimal Working Version)

1. **AI Parts Assistant**
   - Intelligent chatbot that helps users find vehicle parts
   - Mock responses for common queries (can be enhanced with OpenAI API)
   - Parts database integration
   - Installation guidance and tips

2. **Social Feed (Reddit-style)**
   - Create, view, and interact with posts
   - Categories: Questions, Tutorials, Discussions
   - Upvoting/downvoting system
   - Comment system with nested replies
   - Post filtering and sorting

3. **Authentication System**
   - JWT-based authentication
   - User registration and login
   - Secure password hashing with bcrypt
   - Protected routes

4. **Modern UI/UX**
   - Tailwind CSS for styling
   - Mobile-responsive design
   - Clean, modern interface
   - Toast notifications

### 🚧 Planned Features

- **Marketplace**: Buy/sell vehicle parts
- **Enhanced AI**: Integration with OpenAI API
- **Image Upload**: Support for post and part images
- **User Profiles**: Extended user management
- **Search**: Advanced search functionality
- **Real-time Features**: Live chat and notifications

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcryptjs
- **Styling**: Tailwind CSS
- **Icons**: Heroicons
- **Notifications**: React Hot Toast
- **Date Handling**: date-fns

## Project Structure

```
findme/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── posts/                # Posts CRUD operations
│   │   └── ai/                   # AI chat assistant
│   ├── chat/                     # AI assistant page
│   ├── feed/                     # Social feed page
│   ├── login/                    # Login page
│   ├── register/                 # Registration page
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
├── components/                   # Reusable components
│   ├── feed/                     # Feed-related components
│   ├── layout/                   # Layout components
│   └── providers/                # Context providers
├── lib/                          # Utility libraries
│   ├── auth.ts                   # Authentication utilities
│   └── mongodb.ts                # Database connection
├── models/                       # Mongoose models
│   ├── User.ts                   # User model
│   ├── Post.ts                   # Post model
│   ├── Comment.ts                # Comment model
│   ├── Part.ts                   # Vehicle parts model
│   └── Listing.ts                # Marketplace listings model
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd findme
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/findme
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   OPENAI_API_KEY=your-openai-api-key-optional
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-nextauth-secret
   ```

4. **Start MongoDB**
   - For local MongoDB: `mongod`
   - For MongoDB Atlas: Use your connection string

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage Guide

### Getting Started

1. **Visit the landing page** at `/`
2. **Create an account** by clicking "Sign up" or visiting `/register`
3. **Sign in** to access the full platform
4. **Explore the features**:
   - `/feed` - Community social feed
   - `/chat` - AI parts assistant
   - `/marketplace` - Coming soon

### Using the AI Assistant

1. Navigate to `/chat`
2. Ask questions like:
   - "My 1980 CB750 needs a new cam chain tensioner"
   - "Best brake pads for Honda CB750"
   - "How to replace motorcycle chain"
3. The AI will provide parts recommendations and installation guidance

### Social Feed

1. Navigate to `/feed`
2. **Create posts** by clicking "Create Post"
3. **Filter posts** by category (Questions, Tutorials, Discussions)
4. **Sort posts** by Recent, Popular, or Most Viewed
5. **Interact** with posts through upvoting and commenting

## Database Schema

### User Model
- Email, username, display name
- Password (hashed)
- Avatar, bio
- Seller status and verification flags

### Post Model
- Title, content, category
- Author reference
- Tags, images, video URL
- Vote counts, comment count, views
- Sticky flag for important posts

### Comment Model
- Content, author, post references
- Parent comment for nested replies
- Vote counts, deletion flag
- Reply tracking

### Part Model
- Name, description, part number
- Category and subcategory
- Compatible vehicles (make, model, year)
- Specifications, images
- Installation guide
- External supplier links

### Listing Model (Marketplace)
- Title, description, seller
- Part reference, category, condition
- Price, images, external URL
- Vehicle compatibility
- Location, activity status

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Posts
- `GET /api/posts` - Fetch posts (with filtering)
- `POST /api/posts` - Create new post
- `GET /api/posts/[id]` - Get single post
- `PATCH /api/posts/[id]` - Update post
- `POST /api/posts/[id]/vote` - Vote on post

### Comments
- `GET /api/posts/[id]/comments` - Get post comments
- `POST /api/posts/[id]/comments` - Create comment

### AI Assistant
- `POST /api/ai/chat` - Chat with AI assistant

## Development

### Adding New Features

1. **Models**: Create new Mongoose models in `/models`
2. **API Routes**: Add endpoints in `/app/api`
3. **Components**: Build reusable components in `/components`
4. **Pages**: Add new pages in `/app`

### Database Indexing

The models include performance indexes for:
- User lookups (email, username)
- Post filtering (category, tags, author)
- Comment queries (post, author)
- Part searches (make, model, text search)

### Security Features

- JWT authentication with HTTP-only cookies
- Password hashing with bcrypt
- Input validation and sanitization
- CORS and security headers
- Protected API routes

## Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** - Vercel handles the rest

### Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

### Database Deployment

- **MongoDB Atlas** (recommended for production)
- Configure connection string in environment variables
- Set up database indexes for performance

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Future Enhancements

### Phase 1 (Next Steps)
- OpenAI API integration for better AI responses
- Image upload functionality
- User profile pages
- Post detail pages with full comment threads

### Phase 2
- Marketplace implementation
- Real-time chat
- Push notifications
- Advanced search with Elasticsearch

### Phase 3
- Mobile app with React Native
- Seller verification system
- Payment integration
- Analytics dashboard

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation
- Review the code examples

---

**Note**: This is a minimal working version focusing on core functionality. The AI assistant currently uses mock responses but can be easily enhanced with OpenAI API integration. 