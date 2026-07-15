import Joi from "joi";
import { Request, Response, NextFunction } from "express";
import { TICKET_TIER_CATEGORIES } from "../constants/ticketTiers";

// Reusable Mongo ObjectId pattern (24 hex chars)
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
  "string.pattern.base": '"{{#label}}" must be a valid id',
});

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

// Ticket Schema (used when tickets are submitted as part of a full
// event update / stage-3 payload). _id is accepted so existing tickets
// keep their identity instead of being silently replaced with a new
// one — this matters because transactions, QR codes, and check-ins
// reference a ticket by its _id.
const ticketSchema = Joi.object({
  _id: objectId.optional(),
  ticketName: Joi.string().trim().required(),
  price: Joi.number().min(0).required(),
  currency: Joi.string().uppercase().default("NGN"),
  initialQuantity: Joi.number().integer().min(0).required(),
  availableQuantity: Joi.number().integer().min(0).required(),
  benefits: Joi.array().items(Joi.string()).optional(),
  saleStartDate: Joi.date().iso().allow(null).optional(),
  saleEndDate: Joi.date().iso().allow(null).optional(),
  tierCategory: Joi.string().valid(...TICKET_TIER_CATEGORIES).optional(),
})
  .custom((value, helpers) => {
    if (value.availableQuantity > value.initialQuantity) {
      return helpers.message({
        custom: '"availableQuantity" cannot exceed "initialQuantity"',
      });
    }
    if (value.saleStartDate && value.saleEndDate && value.saleEndDate <= value.saleStartDate) {
      return helpers.message({
        custom: '"saleEndDate" must be after "saleStartDate"',
      });
    }
    return value;
  });

// Create Single Ticket Schema (POST /create-ticket/:eventId)
// availableQuantity is intentionally not accepted here — it always
// starts equal to initialQuantity, set server-side.
export const createTicketSchema = Joi.object({
  ticketName: Joi.string().trim().required().messages({
    "string.empty": "Ticket name is required",
  }),
  price: Joi.number().min(0).required().messages({
    "any.required": "Price is required",
  }),
  currency: Joi.string().uppercase().default("NGN"),
  initialQuantity: Joi.number().integer().min(1).required().messages({
    "number.min": "Initial quantity must be at least 1",
    "any.required": "Initial quantity is required",
  }),
  benefits: Joi.array().items(Joi.string()).optional(),
  saleStartDate: Joi.date().iso().allow(null).optional(),
  saleEndDate: Joi.date().iso().allow(null).optional(),
  tierCategory: Joi.string().valid(...TICKET_TIER_CATEGORIES).optional(),
}).custom((value, helpers) => {
  if (value.saleStartDate && value.saleEndDate && value.saleEndDate <= value.saleStartDate) {
    return helpers.message({
      custom: '"saleEndDate" must be after "saleStartDate"',
    });
  }
  return value;
});

// Update Single Ticket Schema (PATCH /:eventId/tickets/:ticketId)
// Price is explicitly forbidden post-creation — tickets may already be
// sold at the original price, and silently changing it would corrupt
// revenue reporting. Reject loudly instead of ignoring it.
export const updateTicketSchema = Joi.object({
  ticketName: Joi.string().trim().optional(),
  price: Joi.any().forbidden().messages({
    "any.unknown": "Ticket price cannot be changed after creation",
  }),
  currency: Joi.string().uppercase().optional(),
  initialQuantity: Joi.number().integer().min(0).optional(),
  availableQuantity: Joi.number().integer().min(0).optional(),
  benefits: Joi.array().items(Joi.string()).optional(),
  saleStartDate: Joi.date().iso().allow(null).optional(),
  saleEndDate: Joi.date().iso().allow(null).optional(),
  tierCategory: Joi.string().valid(...TICKET_TIER_CATEGORIES).optional(),
})
  .min(1)
  .messages({ "object.min": "At least one field must be provided to update" })
  .custom((value, helpers) => {
    if (value.saleStartDate && value.saleEndDate && value.saleEndDate <= value.saleStartDate) {
      return helpers.message({
        custom: '"saleEndDate" must be after "saleStartDate"',
      });
    }
    return value;
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
   faq: Joi.array().items(faqSchema).optional(),        
  code: Joi.array().items(codeSchema).optional(),      
});

// Update Stage 1 Schema (revisiting/editing stage 1 before moving forward)
export const updateStage1Schema = Joi.object({
  stage: Joi.number().valid(1).required(),
  eventDetails: eventDetailsSchema.required(),
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

const stageSchemas: Record<number, Joi.ObjectSchema> = {
  1: updateStage1Schema,
  2: updateStage2Schema,
  3: updateStage3Schema,
  4: updateStage4Schema,
  5: updateStage5Schema,
};

/**
 * PATCH /:id/stage was previously unvalidated — stage 3 (ticket
 * creation) in particular went straight to the database with no
 * shape or type checking. This dispatches to the correct per-stage
 * schema based on req.body.stage before anything touches the DB.
 */
export const validateEventStage = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const stage = Number(req.body?.stage);

  if (!stage || !stageSchemas[stage]) {
    res.status(400).json({
      success: false,
      message: "Invalid stage number. Stage must be between 1 and 5",
    });
    return;
  }

  const { error, value } = stageSchemas[stage].validate(req.body, {
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

// Validation Middlewares
/**
 * The create-event route accepts multipart/form-data (for the banner
 * file upload). Multipart fields are always flat strings, so a client
 * that sends `eventDetails` as JSON.stringify(...) will otherwise fail
 * Joi's object() check before ever reaching the controller. Parse it
 * back into an object here, before validation runs.
 */
export const parseMultipartEventFields = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (typeof req.body?.eventDetails === "string") {
    try {
      req.body.eventDetails = JSON.parse(req.body.eventDetails);
    } catch {
      res.status(400).json({
        success: false,
        message: "eventDetails must be valid JSON",
      });
      return;
    }
  }
  next();
};

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

// Send Event Feedback Request Schema (POST /:id/send-feedback-request)
export const sendFeedbackRequestSchema = Joi.object({
  formLink: Joi.string()
    .uri({ scheme: ["http", "https"] })
    .required()
    .messages({
      "string.empty": "formLink is required",
      "string.uri": "formLink must be a valid http(s) URL",
      "any.required": "formLink is required",
    }),
  subject: Joi.string().trim().max(150).optional(),
  message: Joi.string().trim().max(1000).optional(),
});

export const validateSendFeedbackRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = sendFeedbackRequestSchema.validate(req.body, {
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

export const validateCreateTicket = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = createTicketSchema.validate(req.body, {
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

export const validateUpdateTicket = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = updateTicketSchema.validate(req.body, {
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