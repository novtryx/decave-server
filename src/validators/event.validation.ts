import Joi from "joi";
import { Request, Response, NextFunction } from "express";

// Brand Color Schema
const brandColorSchema = Joi.object({
  primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default("#CCA33A").messages({
    "string.pattern.base": "Primary color must be a valid hex color (e.g., #CCA33A)",
  }),
  secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default("#001D3D").messages({
    "string.pattern.base": "Secondary color must be a valid hex color (e.g., #001D3D)",
  }),
});

// Event Details Schema
const eventDetailsSchema = Joi.object({
  eventType: Joi.string().trim().required().messages({
    "string.empty": "Event type is required",
  }),
  eventTitle: Joi.string().trim().min(3).max(200).required().messages({
    "string.empty": "Event title is required",
    "string.min": "Event title must be at least 3 characters",
    "string.max": "Event title cannot exceed 200 characters",
  }),
  eventTheme: Joi.string().trim().required().messages({
    "string.empty": "Event theme is required",
  }),
  supportingText: Joi.string().trim().required().messages({
    "string.empty": "Supporting text is required",
  }),
  eventBanner: Joi.string().uri().required().messages({
    "string.empty": "Event banner is required",
    "string.uri": "Event banner must be a valid URL",
  }),
  startDate: Joi.date().iso().required().messages({
    "date.base": "Start date must be a valid date",
    "any.required": "Start date is required",
  }),
  endDate: Joi.date().iso().greater(Joi.ref("startDate")).required().messages({
    "date.base": "End date must be a valid date",
    "date.greater": "End date must be after start date",
    "any.required": "End date is required",
  }),
  venue: Joi.string().trim().required().messages({
    "string.empty": "Venue is required",
  }),
  address: Joi.string().trim().optional().allow(""),
  brandColor: brandColorSchema.optional(),
  eventVisibility: Joi.boolean().default(true),
});

// Content Section Schema
const contentSectionSchema = Joi.object({
  subTitle: Joi.string().trim().required(),
  sectionContent: Joi.string().trim().required(),
  supportingImage: Joi.string().uri().required(),
});

// About Event Schema
const aboutEventSchema = Joi.object({
  heading: Joi.string().trim().required(),
  description: Joi.string().trim().required(),
  content: Joi.array().items(contentSectionSchema).optional(),
});

// Ticket Schema
const ticketSchema = Joi.object({
  ticketName: Joi.string().trim().required(),
  price: Joi.number().min(0).required(),
  currency: Joi.string().uppercase().default("NGN"),
  initialQuantity: Joi.number().min(0).required(),
  availableQuantity: Joi.number().min(0).required(),
  benefits: Joi.array().items(Joi.string()).optional(),
});

// Socials Schema
const socialsSchema = Joi.object({
  instagram: Joi.string().uri().allow("").optional(),
  twitter: Joi.string().uri().allow("").optional(),
  website: Joi.string().uri().allow("").optional(),
});

const faqSchema = Joi.object({
  question: Joi.string().trim().required(),
  answer: Joi.string().trim().required()
})

const codeSchema = Joi.object({
  title: Joi.string().trim().required(),
  body: Joi.string().trim().required()
})

// Artist Line Up Schema
const artistLineUpSchema = Joi.object({
  artistImage: Joi.string().uri().required(),
  artistName: Joi.string().trim().required(),
  artistGenre: Joi.string().trim().required(),
  headliner: Joi.boolean().default(false),
  socials: socialsSchema.required(),
});

// Emergency Contact Schema
const emergencyContactSchema = Joi.object({
  security: Joi.string().trim().required(),
  medical: Joi.string().trim().required(),
  lostButFound: Joi.string().trim().required(),
  supportingInfo: Joi.string().trim().optional().allow(""),
});

// Create Event Schema (Stage 1 - Required)
export const createEventSchema = Joi.object({
  stage: Joi.number().min(1).max(5).default(1),
  published: Joi.boolean().default(false),
  eventDetails: eventDetailsSchema.required(),
});

// Update Event Schema (Can update any stage)
export const updateEventSchema = Joi.object({
  stage: Joi.number().min(1).max(5).optional(),
  published: Joi.boolean().optional(),
  eventDetails: eventDetailsSchema.optional(),
  aboutEvent: aboutEventSchema.optional(),
  tickets: Joi.array().items(ticketSchema).optional(),
  artistLineUp: Joi.array().items(artistLineUpSchema).optional(),
  emergencyContact: emergencyContactSchema.optional(),
});

// Update Stage 2 Schema
export const updateStage2Schema = Joi.object({
  stage: Joi.number().valid(2).required(),
  aboutEvent: aboutEventSchema.required(),
});

// Update Stage 3 Schema
export const updateStage3Schema = Joi.object({
  stage: Joi.number().valid(3).required(),
  tickets: Joi.array().items(ticketSchema).min(1).required().messages({
    "array.min": "At least one ticket type is required",
  }),
});

// Update Stage 4 Schema
export const updateStage4Schema = Joi.object({
  stage: Joi.number().valid(4).required(),
  artistLineUp: Joi.array().items(artistLineUpSchema).optional(),
});

// Update Stage 5 Schema
export const updateStage5Schema = Joi.object({
  stage: Joi.number().valid(5).required(),
  emergencyContact: emergencyContactSchema.required(),
  faq: Joi.array().items(faqSchema).required(),
  code: Joi.array().items(codeSchema).required(),
  published: Joi.boolean().default(true),
});

// Validation Middlewares
export const validateCreateEvent = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = createEventSchema.validate(req.body, {
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

export const validateUpdateEvent = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = updateEventSchema.validate(req.body, {
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