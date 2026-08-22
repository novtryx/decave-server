import { Request, Response } from "express";
import multer from "multer";
import openCallService from "../services/openCall.service";
import uploadService from "../services/upload.service";

// ==================== CATEGORIES ====================

export const listCategories = async (req: Request, res: Response) => {
  try {
    const categories = await openCallService.listActiveCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategory = async (req: Request, res: Response) => {
  try {
    const category = await openCallService.getCategoryBySlug(String(req.params.slug));
    res.status(200).json({ success: true, data: category });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ==================== APPLICATION LIFECYCLE ====================

export const startApplication = async (req: Request, res: Response) => {
  try {
    const { categorySlug, fullName, email, phoneNumber } = req.body;
    const { application, applicant, category } = await openCallService.startApplication({
      categorySlug,
      fullName,
      email,
      phoneNumber,
    });

    res.status(201).json({
      success: true,
      data: {
        resumeToken: application.resumeToken,
        status: application.status,
        category: { slug: category.slug, name: category.name, fields: category.fields },
        applicant: {
          fullName: applicant.fullName,
          email: applicant.email,
          phoneNumber: applicant.phoneNumber,
        },
        answers: application.answers,
        files: application.files,
      },
    });
  } catch (error: any) {
    console.error("Error starting application:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const getApplicationByToken = async (req: Request, res: Response) => {
  try {
    const { application, applicant, category } = await openCallService.getByResumeToken(String(req.params.token));
    res.status(200).json({
      success: true,
      data: {
        resumeToken: application.resumeToken,
        status: application.status,
        submittedAt: application.submittedAt,
        category: { slug: category.slug, name: category.name, fields: category.fields },
        applicant: {
          fullName: applicant.fullName,
          email: applicant.email,
          phoneNumber: applicant.phoneNumber,
          country: applicant.country,
          city: applicant.city,
          bio: applicant.bio,
          socialHandles: applicant.socialHandles,
        },
        answers: application.answers,
        files: application.files,
      },
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const saveApplicationProgress = async (req: Request, res: Response) => {
  try {
    const { profile, answers } = req.body;
    const { application, applicant } = await openCallService.saveProgress(String(req.params.token), {
      profile,
      answers,
    });
    res.status(200).json({
      success: true,
      data: {
        status: application.status,
        answers: application.answers,
        applicant: {
          fullName: applicant.fullName,
          country: applicant.country,
          city: applicant.city,
          bio: applicant.bio,
          socialHandles: applicant.socialHandles,
        },
      },
    });
  } catch (error: any) {
    console.error("Error saving application progress:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// File uploads use multer's memory storage (matches the pattern used
// for event banners/cocktail images elsewhere) capped at 15MB — big
// enough for a portfolio PDF or a few photos, small enough to not
// tie up the request for minutes on a slow mobile upload, which
// matters here since spec section 22 expects most applicants to be
// on their phones via QR code.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});
export const uploadApplicationFileMiddleware = upload.single("file");

export const uploadApplicationFile = async (req: Request, res: Response) => {
  try {
    const { fieldName } = req.body;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!fieldName) {
      res.status(400).json({ success: false, message: "fieldName is required" });
      return;
    }
    if (!file) {
      res.status(400).json({ success: false, message: "No file was uploaded" });
      return;
    }

    const isVideo = file.mimetype.startsWith("video/");
    const isImage = file.mimetype.startsWith("image/");

    const result = isVideo
      ? await uploadService.uploadVideo(file.buffer, "decave/open-call")
      : isImage
      ? await uploadService.uploadImage(file.buffer, "decave/open-call")
      : await uploadService.uploadRaw(file.buffer, "decave/open-call");

    const application = await openCallService.attachFile(String(req.params.token), {
      fieldName,
      url: result.secure_url,
      publicId: result.public_id,
      originalName: file.originalname,
      format: result.format,
      resourceType: isVideo ? "video" : isImage ? "image" : "raw",
    });

    res.status(200).json({ success: true, data: { files: application.files } });
  } catch (error: any) {
    console.error("Error uploading application file:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const submitApplication = async (req: Request, res: Response) => {
  try {
    const application = await openCallService.submitApplication(String(req.params.token));
    res.status(200).json({
      success: true,
      message: "Your Afrospook 2026 application has been successfully submitted. Our team will review your application and contact selected applicants with the next steps.",
      data: { status: application.status, submittedAt: application.submittedAt },
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      ...(error.missingFields && { missingFields: error.missingFields }),
    });
  }
};