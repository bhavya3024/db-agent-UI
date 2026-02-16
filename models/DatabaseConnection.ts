import mongoose, { Schema, Document, Model } from "mongoose";

export type DatabaseType = "postgresql" | "mongodb" | "mysql";

export interface IDatabaseConnection extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string; // Google user ID
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string; // Will be encrypted
  connectionString?: string; // Alternative to individual fields
  isActive: boolean;
  lastConnectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DatabaseConnectionSchema = new Schema<IDatabaseConnection>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["postgresql", "mongodb", "mysql"],
      required: true,
    },
    host: {
      type: String,
      required: true,
      trim: true,
    },
    port: {
      type: Number,
      required: true,
    },
    database: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      // Note: In production, encrypt this field
    },
    connectionString: {
      type: String,
      // Alternative to individual fields, also should be encrypted
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastConnectedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user's connections
DatabaseConnectionSchema.index({ userId: 1, name: 1 }, { unique: true });

// Prevent duplicate model compilation in development
const DatabaseConnection: Model<IDatabaseConnection> =
  mongoose.models.DatabaseConnection ||
  mongoose.model<IDatabaseConnection>("DatabaseConnection", DatabaseConnectionSchema);

export default DatabaseConnection;
