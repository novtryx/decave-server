import mongoose, { Document, Schema } from "mongoose";


export interface IGallery extends Document {
  type: "video" | "image";
  event: mongoose.Types.ObjectId;
  link: string;
  featured: boolean;
  thumbnail: string;
}

const GallerySchema = new Schema<IGallery>(
  {
    type: {
      type: String,
      enum: ["video", "image"],
      required: true,
    },
    event: {
    type: Schema.Types.ObjectId,
    ref: "Event",
    required: true,
    },
    link: {
      type: String,
      required: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    thumbnail:{
        type: String,
        required:true,
        default: ""
    }
  },
  {
    timestamps: true, 
  }
);

GallerySchema.index({ featured: 1 });
GallerySchema.index({ event: 1 });
GallerySchema.index({ type: 1 });



export default mongoose.model<IGallery>("Gallery", GallerySchema);
