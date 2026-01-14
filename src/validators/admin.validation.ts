import Joi from "joi";
import { Request, Response, NextFunction } from "express";

// Joi Schema for Create Account
export const createAccountSchema = Joi.object({
  fullName: Joi.string()
    .min(2)
    .max(100)
    .trim()
    .required()
    .messages({
      "string.empty": "Full name is required",
      "string.min": "Full name must be at least 2 characters long",
      "string.max": "Full name cannot exceed 100 characters",
      "any.required": "Full name is required",
    }),

  brandName: Joi.string()
    .min(2)
    .max(100)
    .trim()
    .required()
    .messages({
      "string.empty": "Brand name is required",
      "string.min": "Brand name must be at least 2 characters long",
      "string.max": "Brand name cannot exceed 100 characters",
      "any.required": "Brand name is required",
    }),

  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),

  supportEmail: Joi.string()
    .email()
    .lowercase()
    .trim()
    .optional()
    .allow("")
    .messages({
      "string.email": "Please provide a valid support email address",
    }),

  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.empty": "Phone number is required",
      "string.pattern.base": "Please provide a valid phone number",
      "any.required": "Phone number is required",
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/)
    .required()
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 8 characters long",
      "string.max": "Password cannot exceed 128 characters",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      "any.required": "Password is required",
    }),

  twoFactorAuthEnabled: Joi.boolean().optional().default(false),

  socialLinks: Joi.object({
    facebook: Joi.string().uri().allow("").optional().messages({
      "string.uri": "Facebook URL must be a valid URI",
    }),
    twitter: Joi.string().uri().allow("").optional().messages({
      "string.uri": "Twitter URL must be a valid URI",
    }),
    instagram: Joi.string().uri().allow("").optional().messages({
      "string.uri": "Instagram URL must be a valid URI",
    }),
    tiktok: Joi.string().uri().allow("").optional().messages({
      "string.uri": "TikTok URL must be a valid URI",
    }),
  }).optional(),

  address: Joi.string().max(500).trim().optional().allow("").messages({
    "string.max": "Address cannot exceed 500 characters",
  }),

  notificationPreferences: Joi.object({
    orderConfirmation: Joi.boolean().optional().default(false),
    eventReminder: Joi.boolean().optional().default(false),
    marketingEmail: Joi.boolean().optional().default(false),
    lowStockAlert: Joi.boolean().optional().default(false),
    dailyReport: Joi.boolean().optional().default(false),
    systemAlert: Joi.boolean().optional().default(false),
  }).optional(),
});

// Validation Middleware
export const validateCreateAccount = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = createAccountSchema.validate(req.body, {
    abortEarly: false, // Return all errors, not just the first one
    stripUnknown: true, // Remove unknown fields
    presence: 'required'
  });

  if (error) {
    const errorMessages = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errorMessages,
    });
    return;
  }

  // Replace body with validated and sanitized data
  req.body = value;
  next();
};


export const createLoginSchema = Joi.object({


  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    .required()
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 8 characters long",
      "string.max": "Password cannot exceed 128 characters",
      "any.required": "Password is required",
    }),

 
});

// Validation Middleware
export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = createLoginSchema.validate(req.body, {
    abortEarly: false, // Return all errors, not just the first one
    stripUnknown: true, // Remove unknown fields
    presence: 'required'
  });

  if (error) {
    const errorMessages = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errorMessages,
    });
    return;
  }

  // Replace body with validated and sanitized data
  req.body = value;
  next();
};