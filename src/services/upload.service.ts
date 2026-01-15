import cloudinary from "../config/cloudinary,config";
import { UploadApiResponse } from "cloudinary";
import { Readable } from "stream";

export class UploadService {
  // Helper method to upload buffer to Cloudinary
  private uploadBuffer(
    buffer: Buffer,
    folder: string,
    resourceType: "image" | "video",
    options: any = {}
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: resourceType,
          ...options,
        },
        (error: any, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result as UploadApiResponse);
          }
        }
      );

      // Convert buffer to stream and pipe to Cloudinary
      const bufferStream = Readable.from(buffer);
      bufferStream.pipe(uploadStream);
    });
  }

  // Upload image to Cloudinary from buffer
  async uploadImage(
    fileBuffer: Buffer,
    folder: string = "decave/images"
  ): Promise<UploadApiResponse> {
    try {
      const result = await this.uploadBuffer(fileBuffer, folder, "image", {
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: [
          { quality: "auto" },
          { fetch_format: "auto" }
        ],
      });

      return result;
    } catch (error: any) {
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  // Upload video to Cloudinary from buffer
  async uploadVideo(
    fileBuffer: Buffer,
    folder: string = "decave/videos"
  ): Promise<UploadApiResponse> {
    try {
      const result = await this.uploadBuffer(fileBuffer, folder, "video", {
        allowed_formats: ["mp4", "mov", "avi", "mkv", "webm"],
        chunk_size: 6000000, // 6MB chunks
        eager: [
          { streaming_profile: "hd", format: "m3u8" },
          { format: "mp4", transformation: [{ quality: "auto" }] }
        ],
        eager_async: true,
      });

      return result;
    } catch (error: any) {
      throw new Error(`Video upload failed: ${error.message}`);
    }
  }

  // Upload multiple images from buffers
  async uploadMultipleImages(
    fileBuffers: Buffer[],
    folder: string = "decave/images"
  ): Promise<UploadApiResponse[]> {
    try {
      const uploadPromises = fileBuffers.map((buffer) =>
        this.uploadImage(buffer, folder)
      );
      return await Promise.all(uploadPromises);
    } catch (error: any) {
      throw new Error(`Multiple image upload failed: ${error.message}`);
    }
  }

  // Upload from file path (for local development only - won't work on Vercel)
  async uploadImageFromPath(
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

      return result;
    } catch (error: any) {
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }

  // Upload video from file path (for local development only - won't work on Vercel)
  async uploadVideoFromPath(
    filePath: string,
    folder: string = "decave/videos"
  ): Promise<UploadApiResponse> {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: folder,
        resource_type: "video",
        allowed_formats: ["mp4", "mov", "avi", "mkv", "webm"],
        chunk_size: 6000000,
        eager: [
          { streaming_profile: "hd", format: "m3u8" },
          { format: "mp4", transformation: [{ quality: "auto" }] }
        ],
        eager_async: true,
      });

      return result;
    } catch (error: any) {
      throw new Error(`Video upload failed: ${error.message}`);
    }
  }

  // Delete image from Cloudinary
  async deleteImage(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
      });

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

      if (result.result !== 'ok') {
        throw new Error(`Video deletion failed: ${result.result}`);
      }

      return result;
    } catch (error: any) {
      throw new Error(`Video deletion failed: ${error.message}`);
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

  // Extract public_id from Cloudinary URL
  extractPublicId(cloudinaryUrl: string): string {
    try {
      // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567890/folder/image.jpg
      const parts = cloudinaryUrl.split('/');
      const uploadIndex = parts.findIndex(part => part === 'upload');
      
      if (uploadIndex === -1) {
        throw new Error('Invalid Cloudinary URL');
      }

      // Get everything after 'upload' and version (v1234567890)
      const pathAfterUpload = parts.slice(uploadIndex + 2).join('/');
      
      // Remove file extension
      const publicId = pathAfterUpload.replace(/\.[^/.]+$/, '');
      
      return publicId;
    } catch (error: any) {
      throw new Error(`Failed to extract public_id: ${error.message}`);
    }
  }
}

export default new UploadService();