import Joi from "joi";
import { Request, Response, NextFunction } from "express";

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
  "string.pattern.base": '"{{#label}}" must be a valid id',
});

// POST /apply/start — creates/finds the Applicant and opens a draft
// Application for a category.
const startApplicationSchema = Joi.object({
  categorySlug: Joi.string().trim().required().messages({
    "string.empty": "categorySlug is required",
  }),
  fullName: Joi.string().trim().min(2).max(200).required(),
  email: Joi.string().trim().email().required(),
  phoneNumber: Joi.string().trim().min(5).max(30).required(),
});

export const validateStartApplication = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = startApplicationSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.details.map((d) => ({ field: d.path.join("."), message: d.message })),
    });
    return;
  }
  req.body = value;
  next();
};

// PATCH /apply/:token — saves progress. Deliberately loose: a draft
// can be partially filled, so this only checks the SHAPE of what's
// sent, not that every required field is present yet. Required-field
// enforcement happens only at submit time (validateSubmitApplication
// below), driven by the category's own field config, not hardcoded
// here — that's what keeps this reusable across all 8 categories.
const saveProgressSchema = Joi.object({
  profile: Joi.object({
    fullName: Joi.string().trim().min(2).max(200),
    country: Joi.string().trim().allow(""),
    city: Joi.string().trim().allow(""),
    bio: Joi.string().trim().max(1000).allow(""),
    socialHandles: Joi.object({
      instagram: Joi.string().trim().allow(""),
      tiktok: Joi.string().trim().allow(""),
      twitter: Joi.string().trim().allow(""),
      website: Joi.string().trim().allow(""),
    }),
  }),
  answers: Joi.array().items(
    Joi.object({
      fieldName: Joi.string().trim().required(),
      value: Joi.any(),
    })
  ),
});

export const validateSaveProgress = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = saveProgressSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.details.map((d) => ({ field: d.path.join("."), message: d.message })),
    });
    return;
  }
  req.body = value;
  next();
};

// PATCH /admin/applications/:id/status
const APPLICATION_STATUSES = ["draft", "submitted", "under_review", "shortlisted", "accepted", "rejected"];
const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...APPLICATION_STATUSES).required(),
  reviewNote: Joi.string().trim().max(2000).allow("", null),
});

export const validateUpdateApplicationStatus = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = updateStatusSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.details.map((d) => ({ field: d.path.join("."), message: d.message })),
    });
    return;
  }
  req.body = value;
  next();
};

// Category management (admin) — used if/when Afrospook adds a 9th
// category through the admin UI rather than the seed script.
const categoryFieldSchema = Joi.object({
  name: Joi.string().trim().required(),
  label: Joi.string().trim().required(),
  type: Joi.string().valid("text", "textarea", "select", "multiselect", "file", "url", "number").required(),
  required: Joi.boolean().default(false),
  options: Joi.array().items(Joi.string()),
  placeholder: Joi.string().trim().allow(""),
  helpText: Joi.string().trim().allow(""),
  order: Joi.number().default(0),
});

const createCategorySchema = Joi.object({
  slug: Joi.string().trim().lowercase().pattern(/^[a-z0-9-]+$/).required().messages({
    "string.pattern.base": "slug must be lowercase letters, numbers, and hyphens only",
  }),
  name: Joi.string().trim().required(),
  description: Joi.string().trim().allow(""),
  active: Joi.boolean().default(true),
  order: Joi.number().default(0),
  fields: Joi.array().items(categoryFieldSchema).default([]),
});

export const validateCreateCategory = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = createCategorySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.details.map((d) => ({ field: d.path.join("."), message: d.message })),
    });
    return;
  }
  req.body = value;
  next();
};

export { objectId };