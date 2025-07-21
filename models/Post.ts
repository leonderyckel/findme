import mongoose, { Document, Schema } from 'mongoose'

export interface IPost extends Document {
  _id: string
  title: string
  content: string
  author: mongoose.Types.ObjectId
  category: 'question' | 'tutorial' | 'discussion'
  tags: string[]
  images?: string[]
  videoUrl?: string
  upvotes: mongoose.Types.ObjectId[]
  downvotes: mongoose.Types.ObjectId[]
  commentCount: number
  views: number
  isSticky: boolean
  createdAt: Date
  updatedAt: Date
}

const PostSchema = new Schema<IPost>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['question', 'tutorial', 'discussion'],
    required: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  images: [String],
  videoUrl: String,
  upvotes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  downvotes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  commentCount: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  isSticky: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

// Indexes for performance
PostSchema.index({ createdAt: -1 })
PostSchema.index({ category: 1, createdAt: -1 })
PostSchema.index({ tags: 1 })
PostSchema.index({ author: 1 })

export default mongoose.models.Post || mongoose.model<IPost>('Post', PostSchema) 