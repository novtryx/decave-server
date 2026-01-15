import { Request, Response } from "express";
import partnerService from "../services/partner.service";
import uploadService from "../services/upload.service";

// Create partner
export const createPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const partnerData = req.body;

    // Handle brand logo upload if file is provided
    if (req.file) {
      const result = await uploadService.uploadImage(req.file.buffer, "decave/partners/logos");
      partnerData.brandLogo = result.secure_url;
    }

    const newPartner = await partnerService.createPartner(partnerData);

    res.status(201).json({
      success: true,
      message: "Partner created successfully",
      data: newPartner,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get partner by ID
export const getPartnerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const partner = await partnerService.getPartnerById(id as string);

    if (!partner) {
      res.status(404).json({
        success: false,
        message: "Partner not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: partner,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all partners
export const getAllPartners = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const filters: any = {};
    if (req.query.tier) {
      filters.sponsorshipTier = req.query.tier;
    }
    if (req.query.active !== undefined) {
      filters.isActive = req.query.active === "true";
    }

    const result = await partnerService.getAllPartners(page, limit, filters);

    res.status(200).json({
      success: true,
      data: result.partners,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update partner
export const updatePartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Handle brand logo upload if file is provided
    if (req.file) {
      const result = await uploadService.uploadImage(req.file.buffer, "decave/partners/logos");
      updateData.brandLogo = result.secure_url;

      // Delete old logo if exists
      const partner = await partnerService.getPartnerById(id as string);
      if (partner?.brandLogo) {
        const publicId = partner.brandLogo.split("/").slice(-3).join("/").split(".")[0];
        await uploadService.deleteImage(publicId);
      }
    }

    const updatedPartner = await partnerService.updatePartner(id as string, updateData);

    if (!updatedPartner) {
      res.status(404).json({
        success: false,
        message: "Partner not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Partner updated successfully",
      data: updatedPartner,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete partner
export const deletePartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Get partner to delete logo from cloudinary
    const partner = await partnerService.getPartnerById(id as string);
    if (partner?.brandLogo) {
      const publicId = partner.brandLogo.split("/").slice(-3).join("/").split(".")[0];
      await uploadService.deleteImage(publicId);
    }

    await partnerService.deletePartner(id as string);

    res.status(200).json({
      success: true,
      message: "Partner deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get active partners


// Add event to partner
export const addEventToPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { eventId } = req.body;

    const updatedPartner = await partnerService.addEventToPartner(id as string, eventId);

    res.status(200).json({
      success: true,
      message: "Event added to partner successfully",
      data: updatedPartner,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Remove event from partner
export const removeEventFromPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, eventId } = req.params;

    const updatedPartner = await partnerService.removeEventFromPartner(id as string, eventId as string);

    res.status(200).json({
      success: true,
      message: "Event removed from partner successfully",
      data: updatedPartner,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Search partners
export const searchPartners = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;

    if (!q) {
      res.status(400).json({
        success: false,
        message: "Search query is required",
      });
      return;
    }

    const partners = await partnerService.searchPartners(q as string);

    res.status(200).json({
      success: true,
      data: partners,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get partner statistics
export const getPartnerStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await partnerService.getPartnerStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update visibility control
export const updateVisibilityControl = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { visibilityControl } = req.body;

    const updatedPartner = await partnerService.updateVisibilityControl(id as string, visibilityControl);

    res.status(200).json({
      success: true,
      message: "Visibility control updated successfully",
      data: updatedPartner,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};