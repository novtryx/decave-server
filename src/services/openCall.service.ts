import crypto from "crypto";
import mongoose from "mongoose";
import Applicant, { IApplicant } from "../models/applicant.model";
import Application, { IApplication, IApplicationAnswer, IUploadedFile, ApplicationStatus } from "../models/application.model";
import Category, { ICategory } from "../models/category.model";
import adminModel from "../models/admin.model";
import { sendTransactionalEmail } from "../provider/email.provider";
import { applicationStatusEmailTemplate, getApplicationStatusEmailContent } from "../utils/applicationStatusEmailTemplate";
import { newApplicationAdminEmailTemplate } from "../utils/newApplicationAdminEmailTemplate";

const LOGO_URL = "https://decave-demo-server.vercel.app/decave-logo.png";
// Where the "Review Application" button in the admin notification
// email points. Falls back to a sane default if ADMIN_APP_URL isn't
// set, but should be configured to the real admin dashboard origin.
const ADMIN_APP_URL = process.env.ADMIN_APP_URL || "https://admin.decavemgt.com";

function generateResumeToken(): string {
  // 32 bytes -> 64 hex chars. Unguessable, URL-safe, no lookup table
  // needed to validate shape before hitting the DB.
  return crypto.randomBytes(32).toString("hex");
}

export class OpenCallService {
  async ensureConnection() {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database not connected");
    }
  }

  // ==================== CATEGORIES ====================

  async listActiveCategories(): Promise<ICategory[]> {
    await this.ensureConnection();
    return Category.find({ active: true }).sort({ order: 1 });
  }

  async getCategoryBySlug(slug: string): Promise<ICategory> {
    await this.ensureConnection();
    const category = await Category.findOne({ slug: slug.toLowerCase().trim() });
    if (!category) {
      const err: any = new Error(`Category "${slug}" not found`);
      err.statusCode = 404;
      throw err;
    }
    return category;
  }

  async createCategory(data: Partial<ICategory>): Promise<ICategory> {
    await this.ensureConnection();
    const existing = await Category.findOne({ slug: data.slug });
    if (existing) {
      const err: any = new Error(`Category with slug "${data.slug}" already exists`);
      err.statusCode = 409;
      throw err;
    }
    return Category.create(data);
  }

  async listAllCategoriesForAdmin(): Promise<ICategory[]> {
    await this.ensureConnection();
    return Category.find().sort({ order: 1 });
  }

  // ==================== APPLICATIONS: APPLICANT-FACING ====================

  /**
   * Starts (or resumes, if this applicant already has a draft for
   * this category) an application. Applicant identity is deduped by
   * email — a returning applicant applying to a second category
   * reuses their existing Applicant record rather than creating a
   * duplicate (spec section 23).
   */
  async startApplication(input: {
    categorySlug: string;
    fullName: string;
    email: string;
    phoneNumber: string;
  }): Promise<{ application: IApplication; applicant: IApplicant; category: ICategory }> {
    await this.ensureConnection();

    const category = await this.getCategoryBySlug(input.categorySlug);
    const email = input.email.toLowerCase().trim();

    let applicant = await Applicant.findOne({ email });
    if (!applicant) {
      applicant = await Applicant.create({
        fullName: input.fullName,
        email,
        phoneNumber: input.phoneNumber,
      });
    }

    // Reuse an existing draft for this category+applicant instead of
    // creating a second one — the unique (applicant, category) index
    // on Application also enforces this at the DB level as a backstop.
    let application = await Application.findOne({ applicant: applicant._id, category: category._id });
    if (!application) {
      application = await Application.create({
        applicant: applicant._id,
        category: category._id,
        status: "draft",
        resumeToken: generateResumeToken(),
      });
    }

    return { application, applicant, category };
  }

  /**
   * Fetches an in-progress or submitted application by its resume
   * token — this is the applicant's private "edit link", the sole
   * mechanism for returning to a saved application since there's no
   * login (spec: private link with a token, like a Google Form edit link).
   */
  async getByResumeToken(token: string): Promise<{ application: IApplication; applicant: IApplicant; category: ICategory }> {
    await this.ensureConnection();
    const application = await Application.findOne({ resumeToken: token });
    if (!application) {
      const err: any = new Error("Application not found. Check your resume link and try again.");
      err.statusCode = 404;
      throw err;
    }
    const [applicant, category] = await Promise.all([
      Applicant.findById(application.applicant),
      Category.findById(application.category),
    ]);
    if (!applicant || !category) {
      const err: any = new Error("Application data is incomplete");
      err.statusCode = 500;
      throw err;
    }
    return { application, applicant, category };
  }

  /**
   * Autosaves progress — profile fields and/or category answers.
   * Intentionally permissive: this is what powers the multi-step
   * form saving as the applicant moves between steps, so it must
   * accept a partial, incomplete state. Required-field enforcement
   * only happens at submit time (see submitApplication).
   */
  async saveProgress(
    token: string,
    updates: {
      profile?: Partial<Pick<IApplicant, "fullName" | "country" | "city" | "bio" | "socialHandles">>;
      answers?: IApplicationAnswer[];
    }
  ): Promise<{ application: IApplication; applicant: IApplicant }> {
    await this.ensureConnection();
    const { application, applicant } = await this.getByResumeToken(token);

    if (application.status !== "draft") {
      const err: any = new Error("This application has already been submitted and can no longer be edited");
      err.statusCode = 409;
      throw err;
    }

    if (updates.profile) {
      Object.assign(applicant, updates.profile);
      await applicant.save();
    }

    if (updates.answers) {
      // Merge by fieldName rather than replacing wholesale, so saving
      // progress on step 2 doesn't wipe out answers already saved on
      // a previous visit to step 2 for fields not included this time.
      const existing = new Map(application.answers.map((a) => [a.fieldName, a]));
      for (const incoming of updates.answers) {
        existing.set(incoming.fieldName, incoming);
      }
      application.answers = Array.from(existing.values());
      await application.save();
    }

    return { application, applicant };
  }

  async attachFile(token: string, file: IUploadedFile): Promise<IApplication> {
    await this.ensureConnection();
    const { application } = await this.getByResumeToken(token);
    if (application.status !== "draft") {
      const err: any = new Error("This application has already been submitted and can no longer be edited");
      err.statusCode = 409;
      throw err;
    }
    // Replace any existing file for this same field (re-uploading a
    // portfolio should overwrite, not accumulate duplicates).
    application.files = application.files.filter((f) => f.fieldName !== file.fieldName);
    application.files.push(file);
    await application.save();
    return application;
  }

  /**
   * Validates the application against its category's field config —
   * every field marked `required: true` in Category.fields must have
   * a non-empty answer (or an uploaded file, for type "file") before
   * this will allow submission. This is the one place category rules
   * are enforced, and it reads them from data, not from a hardcoded
   * switch statement — that's what keeps this reusable across all 8
   * categories, and any future ones added via the admin.
   */
  async submitApplication(token: string): Promise<IApplication> {
    await this.ensureConnection();
    const { application, category } = await this.getByResumeToken(token);

    if (application.status !== "draft") {
      const err: any = new Error("This application has already been submitted");
      err.statusCode = 409;
      throw err;
    }

    const answerMap = new Map(application.answers.map((a) => [a.fieldName, a.value]));
    const fileFieldNames = new Set(application.files.map((f) => f.fieldName));

    const missing: string[] = [];
    for (const field of category.fields) {
      if (!field.required) continue;
      if (field.type === "file") {
        if (!fileFieldNames.has(field.name)) missing.push(field.label);
        continue;
      }
      const value = answerMap.get(field.name);
      const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "") ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) missing.push(field.label);
    }

    if (missing.length > 0) {
      const err: any = new Error(`Please complete the following required fields: ${missing.join(", ")}`);
      err.statusCode = 400;
      err.missingFields = missing;
      throw err;
    }

    application.status = "submitted";
    application.submittedAt = new Date();
    await application.save();

    // Fire-and-forget — see notifyAdminsOfNewApplication for why this
    // never throws back into the submit response. Both the admin
    // alert and the applicant's confirmation email fire from the
    // same submit event, using the applicant record fetched once
    // above rather than hitting the DB twice.
    const applicant = await Applicant.findById(application.applicant);
    if (applicant) {
      this.notifyAdminsOfNewApplication(application, applicant, category);
      this.notifyApplicantOfStatusChange(applicant, category, "submitted");
    }

    return application;
  }

  // ==================== EMAIL NOTIFICATIONS ====================
  // Both of these are deliberately fire-and-forget from the caller's
  // perspective (errors are caught and logged here, never thrown) —
  // an email provider hiccup must never turn a successful submission
  // or status update into a failed API response.

  private async notifyAdminsOfNewApplication(application: IApplication, applicant: IApplicant, category: ICategory) {
    try {
      const admins = await adminModel.find().select("email supportEmail fullName");
      const recipients = admins
        .map((a: any) => a.supportEmail || a.email)
        .filter((email: string | undefined): email is string => !!email);

      if (recipients.length === 0) {
        console.warn("No admin email found to notify of new open call submission");
        return;
      }

      const reviewUrl = `${ADMIN_APP_URL}/open-call?applicationId=${application._id}`;
      const html = newApplicationAdminEmailTemplate(
        LOGO_URL,
        applicant.fullName,
        applicant.email,
        category.name,
        reviewUrl
      );

      await Promise.allSettled(
        recipients.map((email) =>
          sendTransactionalEmail({ email }, `New ${category.name} application — ${applicant.fullName}`, html)
        )
      );
    } catch (error: any) {
      console.error("Failed to send admin new-submission notification:", error.message);
    }
  }

  private async notifyApplicantOfStatusChange(
    applicant: IApplicant,
    category: ICategory,
    status: ApplicationStatus
  ) {
    try {
      const content = getApplicationStatusEmailContent(status);
      // "draft" has no copy defined (nothing to notify about before
      // submission) — every other real status does.
      if (!content) return;

      const html = applicationStatusEmailTemplate(
        LOGO_URL,
        applicant.fullName,
        category.name,
        content.heading,
        content.body
      );
      await sendTransactionalEmail({ email: applicant.email, name: applicant.fullName }, content.subject, html);
    } catch (error: any) {
      console.error("Failed to send applicant status-change email:", error.message);
    }
  }

  // ==================== ADMIN-FACING ====================

  async listApplications(filters: {
    categorySlug?: string;
    status?: ApplicationStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ applications: any[]; total: number; page: number; pages: number }> {
    await this.ensureConnection();

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

    const match: any = {};
    if (filters.status) match.status = filters.status;

    if (filters.categorySlug) {
      const category = await Category.findOne({ slug: filters.categorySlug });
      // A slug that matches no category should return zero results,
      // not "ignore the filter and show everything" — use an id that
      // can never match rather than silently dropping the filter.
      match.category = category ? category._id : new mongoose.Types.ObjectId();
    }

    let applicantIds: mongoose.Types.ObjectId[] | null = null;
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      const matchingApplicants = await Applicant.find({
        $or: [
          { fullName: { $regex: term, $options: "i" } },
          { email: { $regex: term, $options: "i" } },
          { phoneNumber: { $regex: term, $options: "i" } },
        ],
      }).select("_id");
      applicantIds = matchingApplicants.map((a) => a._id as mongoose.Types.ObjectId);
      match.applicant = { $in: applicantIds };
    }

    const [applications, total] = await Promise.all([
      Application.find(match)
        .populate("applicant", "fullName email phoneNumber country city")
        .populate("category", "name slug")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Application.countDocuments(match),
    ]);

    return { applications, total, page, pages: Math.ceil(total / limit) || 1 };
  }

  async getApplicationById(id: string): Promise<IApplication> {
    await this.ensureConnection();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const err: any = new Error("Invalid application id");
      err.statusCode = 400;
      throw err;
    }
    const application = await Application.findById(id)
      .populate("applicant")
      .populate("category");
    if (!application) {
      const err: any = new Error("Application not found");
      err.statusCode = 404;
      throw err;
    }
    return application;
  }

  async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    reviewedBy: string | null,
    reviewNote?: string | null
  ): Promise<IApplication> {
    await this.ensureConnection();
    const application = await Application.findById(id);
    if (!application) {
      const err: any = new Error("Application not found");
      err.statusCode = 404;
      throw err;
    }
    const statusChanged = application.status !== status;
    application.status = status;
    if (reviewedBy && mongoose.Types.ObjectId.isValid(reviewedBy)) {
      application.reviewedBy = new mongoose.Types.ObjectId(reviewedBy);
    }
    if (reviewNote !== undefined) {
      application.reviewNote = reviewNote;
    }
    await application.save();

    // Only email on an actual change — resaving the same status
    // (e.g. re-saving a review note without changing status) 
    // shouldn't re-trigger a notification the applicant already got.
    if (statusChanged) {
      const [applicant, category] = await Promise.all([
        Applicant.findById(application.applicant),
        Category.findById(application.category),
      ]);
      if (applicant && category) {
        this.notifyApplicantOfStatusChange(applicant, category, status);
      }
    }

    return application;
  }

  async getDashboardStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: { category: string; slug: string; count: number }[];
  }> {
    await this.ensureConnection();

    const [total, statusCounts, categoryCounts] = await Promise.all([
      Application.countDocuments(),
      Application.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Application.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "cat" } },
        { $unwind: "$cat" },
        { $project: { _id: 0, category: "$cat.name", slug: "$cat.slug", count: 1 } },
      ]),
    ]);

    const byStatus: Record<string, number> = {
      draft: 0,
      submitted: 0,
      under_review: 0,
      shortlisted: 0,
      accepted: 0,
      rejected: 0,
    };
    for (const row of statusCounts) {
      byStatus[row._id] = row.count;
    }

    return { total, byStatus, byCategory: categoryCounts };
  }
}

export default new OpenCallService();