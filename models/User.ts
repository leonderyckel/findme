import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
  _id: string
  email: string
  password: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  isVerified: boolean
  isSeller: boolean
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isSeller: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

// Index are automatically created by unique: true, no need for manual indexes

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema) 