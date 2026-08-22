import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import openCallService from "../services/openCall.service";
import { ApplicationStatus } from "../models/application.model";

export const listApplications = async (req: AuthRequest, res: Response) => {
  try {
    const { category, status, search, page, limit } = req.query;
    const result = await openCallService.listApplications({
      categorySlug: category as string | undefined,
      status: status as ApplicationStatus | undefined,
      search: search as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error listing applications:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const getApplication = async (req: AuthRequest, res: Response) => {
  try {
    const application = await openCallService.getApplicationById(String(req.params.id));
    res.status(200).json({ success: true, data: application });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const updateApplicationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, reviewNote } = req.body;
    const application = await openCallService.updateApplicationStatus(
      String(req.params.id),
      status,
      req.user?.id || null,
      reviewNote
    );
    res.status(200).json({ success: true, data: application });
  } catch (error: any) {
    console.error("Error updating application status:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await openCallService.getDashboardStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const listAllCategories = async (req: AuthRequest, res: Response) => {
  try {
    const categories = await openCallService.listAllCategoriesForAdmin();
    res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const category = await openCallService.createCategory(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    console.error("Error creating category:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};