import mongoose, { Schema, Document, Model } from "mongoose";

export interface IThread extends Document {
  _id: mongoose.Types.ObjectId;
  threadId: string; // LangGraph thread ID
  connectionId: mongoose.Types.ObjectId; // Reference to DatabaseConnection
  userId: string; // Google user ID (denormalized for quick queries)
  title: string;
  lastMessage?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadSchema = new Schema<IThread>(
  {
    threadId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    connectionId: {
      type: Schema.Types.ObjectId,
      ref: "DatabaseConnection",
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Conversation",
      trim: true,
    },
    lastMessage: {
      type: String,
      trim: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fetching threads by connection
ThreadSchema.index({ connectionId: 1, updatedAt: -1 });

// Prevent duplicate model compilation in development
const Thread: Model<IThread> =
  mongoose.models.Thread || mongoose.model<IThread>("Thread", ThreadSchema);

export default Thread;
