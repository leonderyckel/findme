import mongoose, { Document, Schema } from 'mongoose'

export interface IComment extends Document {
  _id: string
  content: string
  author: mongoose.Types.ObjectId
  post: mongoose.Types.ObjectId
  parentComment?: mongoose.Types.ObjectId
  upvotes: mongoose.Types.ObjectId[]
  downvotes: mongoose.Types.ObjectId[]
  replies: mongoose.Types.ObjectId[]
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

const CommentSchema = new Schema<IComment>({
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  parentComment: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  upvotes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  downvotes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

// Indexes for performance
CommentSchema.index({ post: 1, createdAt: 1 })
CommentSchema.index({ author: 1 })
CommentSchema.index({ parentComment: 1 })

export default mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema) 