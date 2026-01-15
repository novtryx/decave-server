import Joi from "joi";
import { Request, Response, NextFunction } from "express";

// Visibility Control Schema
const visibilityControlSchema = Joi.object({
  publicWebsite: Joi.boolean().default(true),
  partnershipPage: Joi.boolean().default(true),
});

// Create Partner Schema
export const createPartnerSchema = Joi.object({
  partnerName: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .required()
    .messages({
      "string.empty": "Partner name is required",
      "string.min": "Partner name must be at least 2 characters",
      "string.max": "Partner name cannot exceed 200 characters",
      "any.required": "Partner name is required",
    }),

  brandLogo: Joi.string()
    .uri()
    .required()
    .messages({
      "string.empty": "Brand logo is required",
      "string.uri": "Brand logo must be a valid URL",
      "any.required": "Brand logo is required",
    }),

  contactPerson: Joi.string()
    .trim()
    .min(2)
    .required()
    .messages({
      "string.empty": "Contact person is required",
      "string.min": "Contact person name must be at least 2 characters",
      "any.required": "Contact person is required",
    }),

  contactEmail: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      "string.empty": "Contact email is required",
      "string.email": "Please provide a valid email address",
      "any.required": "Contact email is required",
    }),

  contactPhone: Joi.string()
    .pattern(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
    .required()
    .messages({
      "string.empty": "Contact phone is required",
      "string.pattern.base": "Please provide a valid phone number",
      "any.required": "Contact phone is required",
    }),

  sponsorshipTier: Joi.string()
    .lowercase()
    .valid("platinum", "gold", "silver", "bronze", "partner")
    .required()
    .messages({
      "string.empty": "Sponsorship tier is required",
      "any.only": "Sponsorship tier must be one of: platinum, gold, silver, bronze, partner",
      "any.required": "Sponsorship tier is required",
    }),

  associatedEvents: Joi.array()
    .items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
    .optional()
    .messages({
      "string.pattern.base": "Invalid event ID format",
    }),

  partnershipStartDate: Joi.date()
    .iso()
    .required()
    .messages({
      "date.base": "Partnership start date must be a valid date",
      "any.required": "Partnership start date is required",
    }),

  partnershipEndDate: Joi.date()
    .iso()
    .greater(Joi.ref("partnershipStartDate"))
    .required()
    .messages({
      "date.base": "Partnership end date must be a valid date",
      "date.greater": "Partnership end date must be after start date",
      "any.required": "Partnership end date is required",
    }),

  internalNotes: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow("")
    .messages({
      "string.max": "Internal notes cannot exceed 1000 characters",
    }),

  visibilityControl: visibilityControlSchema.optional(),
});

// Update Partner Schema
export const updatePartnerSchema = Joi.object({
  partnerName: Joi.string().trim().min(2).max(200).optional(),
  brandLogo: Joi.string().uri().optional(),
  contactPerson: Joi.string().trim().min(2).optional(),
  contactEmail: Joi.string().email().lowercase().trim().optional(),
  contactPhone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional(),
  sponsorshipTier: Joi.string()
    .lowercase()
    .valid("platinum", "gold", "silver", "bronze", "partner")
    .optional(),
  associatedEvents: Joi.array()
    .items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
    .optional(),
  partnershipStartDate: Joi.date().iso().optional(),
  partnershipEndDate: Joi.date().iso().optional(),
  internalNotes: Joi.string().trim().max(1000).optional().allow(""),
  visibilityControl: visibilityControlSchema.optional(),
});

// Add Event to Partner Schema
export const addEventToPartnerSchema = Joi.object({
  eventId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.empty": "Event ID is required",
      "string.pattern.base": "Invalid event ID format",
      "any.required": "Event ID is required",
    }),
});

// Validation Middlewares
export const validateCreatePartner = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = createPartnerSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
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

  req.body = value;
  next();
};

export const validateUpdatePartner = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = updatePartnerSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
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

  req.body = value;
  next();
};

export const validateAddEvent = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = addEventToPartnerSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
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

  req.body = value;
  next();
};