import { Request, Response } from "express";
import uploadService from "../services/upload.service";
import { AuthRequest } from "../middleware/auth.middleware";

// Upload single image
export const uploadSingleImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
      return;
    }

    const result = await uploadService.uploadImage(req.file.buffer);

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Upload multiple images
export const uploadMultipleImages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
      return;
    }

    const filePaths = req.files.map((file) => file.buffer);
    const results = await uploadService.uploadMultipleImages(filePaths);

    const uploadedImages = results.map((result) => ({
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
    }));

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: uploadedImages,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Upload single video
export const uploadSingleVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "No video file uploaded",
      });
      return;
    }

    const result = await uploadService.uploadVideo(req.file.buffer);

    res.status(200).json({
      success: true,
      message: "Video uploaded successfully",
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        duration: result.duration,
        thumbnail: uploadService.getVideoThumbnail(result.public_id),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete image
export const deleteImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
      return;
    }

    const result = await uploadService.deleteImage(publicId);

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete video
export const deleteVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
      return;
    }

    await uploadService.deleteVideo(publicId);

    res.status(200).json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};