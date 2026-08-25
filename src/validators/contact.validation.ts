import Joi from "joi";
import { Request, Response, NextFunction } from "express";
import { INQUIRY_TYPES } from "../models/contactInquiry.model";

const submitInquirySchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(200).required(),
  email: Joi.string().trim().email().required(),
  phoneNumber: Joi.string().trim().min(5).max(30).required(),
  inquiryType: Joi.string().valid(...INQUIRY_TYPES).required(),
  message: Joi.string().trim().min(10).max(5000).required(),
});

export const validateSubmitInquiry = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = submitInquirySchema.validate(req.body, {
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