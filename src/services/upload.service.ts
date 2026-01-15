import cloudinary from "../config/cloudinary,config";
import { UploadApiResponse, UploadApiErrorResponse } from "cloudinary";
import fs from "fs";

export class UploadService {
  // Upload image to Cloudinary
  async uploadImage(
    filePath: string,
    folder: string = "decave/images"
  ): Promise<UploadApiResponse> {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: folder,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: [
          { quality: "auto" },
          { fetch_format: "auto" }
        ],
      });

      // Delete local file after upload
      fs.unlinkSync(filePath);

      return result;
    } catch (error: any) {
      // Delete local file even if upload fails
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  // Upload video to Cloudinary
  async uploadVideo(
    filePath: string,
    folder: string = "decave/videos"
  ): Promise<UploadApiResponse> {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: folder,
        resource_type: "video",
        allowed_formats: ["mp4", "mov", "avi", "mkv", "webm"],
        chunk_size: 6000000, // 6MB chunks
        eager: [
          { streaming_profile: "hd", format: "m3u8" },
          { format: "mp4", transformation: [{ quality: "auto" }] }
        ],
        eager_async: true,
      });

      // Delete local file after upload
      fs.unlinkSync(filePath);

      return result;
    } catch (error: any) {
      // Delete local file even if upload fails
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw new Error(`Video upload failed: ${error.message}`);
    }
  }

  // Upload multiple images
  async uploadMultipleImages(
    filePaths: string[],
    folder: string = "decave/images"
  ): Promise<UploadApiResponse[]> {
    try {
      const uploadPromises = filePaths.map((filePath) =>
        this.uploadImage(filePath, folder)
      );
      return await Promise.all(uploadPromises);
    } catch (error: any) {
      throw new Error(`Multiple image upload failed: ${error.message}`);
    }
  }

  // Delete image from Cloudinary
  async deleteImage(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
      });

      // Cloudinary returns result: 'ok' when successful, 'not found' when image doesn't exist
      if (result.result !== 'ok') {
        throw new Error(`Image deletion failed: ${result.result}`);
      }

      return result;
    } catch (error: any) {
      throw new Error(`Image deletion failed: ${error.message}`);
    }
  }

  // Delete video from Cloudinary
  async deleteVideo(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "video",
      });

      // Cloudinary returns result: 'ok' when successful, 'not found' when image doesn't exist
      if (result.result !== 'ok') {
        throw new Error(`video deletion failed: ${result.result}`);
      }

      return result;
    } catch (error: any) {
      throw new Error(`video deletion failed: ${error.message}`);
    }
  }

  // Get optimized image URL
  getOptimizedImageUrl(publicId: string, options?: any): string {
    return cloudinary.url(publicId, {
      quality: "auto",
      fetch_format: "auto",
      ...options,
    });
  }

  // Get video thumbnail URL
  getVideoThumbnail(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: "video",
      format: "jpg",
      transformation: [
        { width: 300, height: 300, crop: "fill" }
      ],
    });
  }
}

export default new UploadService();