import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { IAdmin } from "../types/database.types";
import adminModel from "../models/admin.model";
import mongoose from "mongoose";


const JWT_SECRET = process.env.JWT_SECRET as string
// const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string
// const JWT_REFRESH_EXPIRES_IN = process.env.JWT_EXPIRES_IN || 604800;


export class AdminService {
  // Create new admin account
  async createAdmin(adminData: Partial<IAdmin>): Promise<IAdmin> {
    try {
      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(adminData.password!, saltRounds);

      // Create admin
      const newAdmin = new adminModel({
        ...adminData,
        password: hashedPassword,
      });

      await newAdmin.save();
      return newAdmin;
    } catch (error: any) {
      throw new Error(`Error creating admin: ${error.message}`);
    }
  }

  // Check if admin exists by email
  async findAdminByEmail(email: string): Promise<IAdmin | null> {
    try {
      return await adminModel.findOne({ email: email.toLowerCase() });
    } catch (error: any) {
      throw new Error(`Error finding admin: ${error.message}`);
    }
  }

  // Check if admin exists by ID
  async findAdminById(id: mongoose.Types.ObjectId): Promise<IAdmin | null> {
    try {
      return await adminModel.findById(id).select("-password");
    } catch (error: any) {
      throw new Error(`Error finding admin: ${error.message}`);
    }
  }

  // Update admin profile
  async updateAdmin(id: string, updateData: Partial<IAdmin>): Promise<IAdmin | null> {
    try {
      // Remove password from update data if present
      const { password, ...safeUpdateData } = updateData as any;

      const updatedAdmin = await adminModel.findByIdAndUpdate(
        id,
        { $set: safeUpdateData },
        { new: true, runValidators: true }
      ).select("-password");

      return updatedAdmin;
    } catch (error: any) {
      throw new Error(`Error updating admin: ${error.message}`);
    }
  }

  // Update password
  async updatePassword(id: string, newPassword: string): Promise<void> {
    try {
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      await adminModel.findByIdAndUpdate(id, { password: hashedPassword });
    } catch (error: any) {
      throw new Error(`Error updating password: ${error.message}`);
    }
  }

  // Verify password
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error: any) {
      throw new Error(`Error verifying password: ${error.message}`);
    }
  }

  // Generate JWT token
  generateToken(adminId: mongoose.Types.ObjectId, email: string): string {
    try {
      const payload = {
        id: adminId,
        email: email,
      };

      return jwt.sign(payload, JWT_SECRET, {
        expiresIn: 604800,
      });
    } catch (error: any) {
      throw new Error(`Error generating token: ${error.message}`);
    }
  }

  // Generate refresh token
  generateRefreshToken(adminId:  mongoose.Types.ObjectId): string {
    try {
      return jwt.sign({ id: adminId },JWT_REFRESH_SECRET, {
        expiresIn: 604800 ,
      });
    } catch (error: any) {
      throw new Error(`Error generating refresh token: ${error.message}`);
    }
  }

  // Verify JWT token
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error: any) {
      throw new Error(`Invalid or expired token`);
    }
  }

  // Delete admin account
  async deleteAdmin(id: string): Promise<void> {
    try {
      await adminModel.findByIdAndDelete(id);
    } catch (error: any) {
      throw new Error(`Error deleting admin: ${error.message}`);
    }
  }

  // Get all admins (with pagination)
  async getAllAdmins(page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const admins = await adminModel.find()
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await adminModel.countDocuments();

      return {
        admins,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      throw new Error(`Error fetching admins: ${error.message}`);
    }
  }

  // Update notification preferences
  async updateNotificationPreferences(
    id: string,
    preferences: Partial<IAdmin["notificationPreferences"]>
  ): Promise<IAdmin | null> {
    try {
      return await adminModel.findByIdAndUpdate(
        id,
        { $set: { notificationPreferences: preferences } },
        { new: true, runValidators: true }
      ).select("-password");
    } catch (error: any) {
      throw new Error(`Error updating notification preferences: ${error.message}`);
    }
  }

  // Toggle 2FA
  async toggle2FA(id: string, enabled: boolean): Promise<IAdmin | null> {
    try {
      return await adminModel.findByIdAndUpdate(
        id,
        { twoFactorAuthEnabled: enabled },
        { new: true }
      ).select("-password");
    } catch (error: any) {
      throw new Error(`Error toggling 2FA: ${error.message}`);
    }
  }

  // Search admins by name or email
  async searchAdmins(query: string) {
    try {
      return await adminModel.find({
        $or: [
          { fullName: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
          { brandName: { $regex: query, $options: "i" } },
        ],
      }).select("-password");
    } catch (error: any) {
      throw new Error(`Error searching admins: ${error.message}`);
    }
  }
}

export default new AdminService();