import { Request, Response } from "express";
import gallerryModel from "../models/gallerry.model";
import UploadService from "../services/upload.service";
import eventModel from "../models/event.model";

class GalleryController {
  // 1️⃣ Create gallery item (image/video upload)
  async create(req: Request, res: Response) {
  try {
    const { type, event, featured = false } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "File is required",
      });
    }

    if (!["image", "video"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type",
      });
    }

    // Upload to Cloudinary
    const uploadResult =
      type === "image"
        ? await UploadService.uploadImage(file.buffer)
        : await UploadService.uploadVideo(file.buffer);

    // ✅ Generate thumbnail
    const thumbnail =
      type === "image"
        ? UploadService.getOptimizedImageUrl(uploadResult.public_id, {
            width: 400,
            height: 400,
            crop: "fill",
          })
        : UploadService.getVideoThumbnail(uploadResult.public_id);

    // Save to DB
    const galleryItem = await gallerryModel.create({
      type,
      event,
      link: uploadResult.secure_url,
      thumbnail,
      featured,
    });

    return res.status(201).json({
      success: true,
      gallery: galleryItem,
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

  // 2️⃣ Get gallery items by type
  async getByType(req: Request, res: Response) {
    try {
      const { type } = req.params as { type: string };
      if (!["image", "video"].includes(type)) {
        return res.status(400).json({success: false, message: "Invalid type" });
      }

      const items = await gallerryModel.find({ type }).sort({ createdAt: -1 }).populate({
        path: "event",              
        select: "eventDetails.eventTitle _id eventDetails.eventTheme", 
    });;
      return res.status(200).json({success: true, gallery: items });
    } catch (error: any) {
      return res.status(500).json({success: false, message: error.message });
    }
  }

  async getEvent(req: Request, res: Response) {
    try {
      const items = await eventModel.find({published: true}).select("_id eventDetails.eventTitle").sort({ createdAt: -1 });
      return res.status(200).json({success: true, events: items });
    } catch (error: any) {
      return res.status(500).json({success: false, message: error.message });
    }
  }
  
  // 3️⃣ Get all gallery items for a specific event
  async getByEvent(req: Request, res: Response) {
    try {
      const { eventId } = req.params;
      const items = await gallerryModel.find({ event: eventId, type: "image" }).sort({ createdAt: -1 });
      return res.status(200).json({success: true, events: items });
    } catch (error: any) {
      return res.status(500).json({success: false, message: error.message });
    }
  }

  // 4️ Get only featured items
  async getFeatured(req: Request, res: Response) {
    try {
      const filter: any = { featured: true, type: "image" };

    const items = await gallerryModel.find(filter)
    .sort({ createdAt: -1 })
    .populate({
        path: "event",              
        select: "eventDetails.eventTitle _id eventDetails.eventTheme", 
    })
    

  return res.status(200).json({success: true, gallery: items });
    } catch (error: any) {
      return res.status(500).json({success: false, message: error.message });
    }
  } 
}

export default new GalleryController();
