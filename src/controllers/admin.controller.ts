import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import adminModel from "../models/admin.model";
import { IAdmin } from "../types/database.types";
import adminService from "../services/admin.service";
import activityService from "../services/notification.service";
import { LoginType } from "../types/controller.type";
import { sendOtpEmail } from "../provider/email.provider";
import { generateOTP } from "../constants/generateOTP";


// Create Account Controller
export const createAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      brandName,
      email,
      supportEmail,
      phone,
      password,
      twoFactorAuthEnabled,
      socialLinks,
      address,
      notificationPreferences,
    }:IAdmin = req.body;

    // Check if admin already exists
    const existingAdmin = await adminService.findAdminByEmail( email );
    if (existingAdmin) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
      return;
    }

    // Hash password
    

    // Create new admin
    const newAdmin = adminService.createAdmin({
      fullName,
      brandName,
      email,
      supportEmail: supportEmail || undefined,
      phone,
      password,
      twoFactorAuthEnabled: twoFactorAuthEnabled || false,
      socialLinks: socialLinks || {
        facebook: "",
        twitter: "",
        instagram: "",
        tiktok: "",
      },
      address: address || "",
      notificationPreferences: notificationPreferences || {
        orderConfirmation: false,
        eventReminder: false,
        marketingEmail: false,
        lowStockAlert: false,
        dailyReport: false,
        systemAlert: false,
      },
    });

    

    // Remove password from response
    activityService.createActivity("Admin Created Successfully", "user_registered")
    const adminObj = newAdmin;
    const adminResponse: Omit<typeof adminObj, 'password'> = adminObj;

    // Send success response
    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: adminResponse,
    });
  } catch (err: any) {
    console.error("Error creating account:", err);

    // Handle duplicate key error (in case unique constraint fails)
    if (err.code === 11000) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "An error occurred while creating the account",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};


export const loginAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginType = req.body;

    const userExist = await adminService.findAdminByEmail(email);
    if (!userExist) {
      res.status(401).json({
        success: false,
        message: "Email or password does not match",
      });
      return;
    }

    const passwordCompare = await bcrypt.compare(password, userExist.password);
    if (!passwordCompare) {
      res.status(401).json({
        success: false,
        message: "Email or password does not match",
      });
      return;
    }

    //  Generate OTP
    const otp = generateOTP();
    const hashedOtp = await bcrypt.hash(otp, 10);

    userExist.otp = hashedOtp;
    userExist.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
    userExist.otpVerified = false;

    await userExist.save();

    //  Send OTP email
    await sendOtpEmail(userExist.email, otp);

    res.status(200).json({
      success: true,
      message: "OTP sent to your email",
    });

  } catch (err: any) {
    console.error("Error logging in:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred while logging in",
    });
  }
};


export const verifyLoginOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    const user = await adminService.findAdminByEmail(email);
    if (!user || !user.otp || !user.otpExpiresAt) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
      return;
    }

    if (user.otpExpiresAt < new Date()) {
      res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
      return;
    }

    const otpMatch = await bcrypt.compare(otp, user.otp);
    if (!otpMatch) {
      res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
      return;
    }

    // ✅ OTP verified
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.otpVerified = true;
    await user.save();

    // 🎟 Generate tokens
    const adminInfo = await adminService.findAdminById(user._id)
    const token = await adminService.generateToken(user._id, user.email);
    const refreshToken = await adminService.generateRefreshToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      refreshToken,
      data: adminInfo,
    });

  } catch (err: any) {
    console.log(err)
    res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
};
