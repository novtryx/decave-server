import partnerModel from "../models/partner.model";
import { IPartner } from "../types/database.types";
import { connectDB } from "../config/database"; 

export class PartnerService {
  private async ensureConnection() {
    await connectDB();
  }

  // Create new partner
  async createPartner(partnerData: Partial<IPartner>): Promise<IPartner> {
    try {
      await this.ensureConnection();

      const newPartner = new partnerModel(partnerData);
      await newPartner.save();
      return newPartner;
    } catch (error: any) {
      throw new Error(`Error creating partner: ${error.message}`);
    }
  }

  // Get partner by ID
  async getPartnerById(id: string): Promise<IPartner | null> {
    try {
      await this.ensureConnection();
      return await partnerModel.findById(id).populate("associatedEvents");
    } catch (error: any) {
      throw new Error(`Error fetching partner: ${error.message}`);
    }
  }

  // Get all partners with pagination
  async getAllPartners(page: number = 1, limit: number = 10, filters?: any) {
    try {
      await this.ensureConnection();
      const skip = (page - 1) * limit;

      const query: any = {};

      // Apply filters
      if (filters?.sponsorshipTier) {
        query.sponsorshipTier = filters.sponsorshipTier.toLowerCase();
      }
      if (filters?.isActive !== undefined) {
        const now = new Date();
        if (filters.isActive) {
          query.partnershipStartDate = { $lte: now };
          query.partnershipEndDate = { $gte: now };
        }
      }

      const partners = await partnerModel.find(query)
        .populate("associatedEvents")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await partnerModel.countDocuments(query);

      return {
        partners,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };
    } catch (error: any) {
      throw new Error(`Error fetching partners: ${error.message}`);
    }
  }

  // Update partner
  async updatePartner(id: string, updateData: Partial<IPartner>): Promise<IPartner | null> {
    try {
      await this.ensureConnection();

      const updatedPartner = await partnerModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate("associatedEvents");

      return updatedPartner;
    } catch (error: any) {
      throw new Error(`Error updating partner: ${error.message}`);
    }
  }

  // Delete partner
  async deletePartner(id: string): Promise<void> {
    try {
      await this.ensureConnection();
      await partnerModel.findByIdAndDelete(id);
    } catch (error: any) {
      throw new Error(`Error deleting partner: ${error.message}`);
    }
  }





  // Get expiring partners (within 30 days)
  async getExpiringPartners() {
    try {
      await this.ensureConnection();

      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      return await partnerModel.find({
        partnershipEndDate: {
          $gte: now,
          $lte: thirtyDaysFromNow,
        },
      }).populate("associatedEvents");
    } catch (error: any) {
      throw new Error(`Error fetching expiring partners: ${error.message}`);
    }
  }

  // Add event to partner
  async addEventToPartner(partnerId: string, eventId: string): Promise<IPartner | null> {
    try {
      await this.ensureConnection();

      const partner = await partnerModel.findById(partnerId);
      if (!partner) {
        throw new Error("Partner not found");
      }

      // Check if event is already associated
      if (partner.associatedEvents.includes(eventId as any)) {
        throw new Error("Event is already associated with this partner");
      }

      partner.associatedEvents.push(eventId as any);
      await partner.save();

      return await partner.populate("associatedEvents");
    } catch (error: any) {
      throw new Error(`Error adding event to partner: ${error.message}`);
    }
  }

  // Remove event from partner
  async removeEventFromPartner(partnerId: string, eventId: string): Promise<IPartner | null> {
    try {
      await this.ensureConnection();

      const partner = await partnerModel.findByIdAndUpdate(
        partnerId,
        { $pull: { associatedEvents: eventId } },
        { new: true }
      ).populate("associatedEvents");

      return partner;
    } catch (error: any) {
      throw new Error(`Error removing event from partner: ${error.message}`);
    }
  }

  // Search partners
  async searchPartners(searchTerm: string) {
    try {
      await this.ensureConnection();

      return await partnerModel.find({
        $or: [
          { partnerName: { $regex: searchTerm, $options: "i" } },
          { contactPerson: { $regex: searchTerm, $options: "i" } },
          { contactEmail: { $regex: searchTerm, $options: "i" } },
        ],
      }).populate("associatedEvents");
    } catch (error: any) {
      throw new Error(`Error searching partners: ${error.message}`);
    }
  }

  // Get partner statistics
  async getPartnerStats() {
    try {
      await this.ensureConnection();

      const total = await partnerModel.countDocuments();

      const now = new Date();
      const active = await partnerModel.countDocuments({
        partnershipStartDate: { $lte: now },
        partnershipEndDate: { $gte: now },
      });

      const expired = await partnerModel.countDocuments({
        partnershipEndDate: { $lt: now },
      });

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);
      const expiringSoon = await partnerModel.countDocuments({
        partnershipEndDate: {
          $gte: now,
          $lte: thirtyDaysFromNow,
        },
      });

      const byTier = await partnerModel.aggregate([
        {
          $group: {
            _id: "$sponsorshipTier",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      return {
        total,
        active,
        expired,
        expiringSoon,
        byTier: byTier.map((item) => ({
          tier: item._id,
          count: item.count,
        })),
      };
    } catch (error: any) {
      throw new Error(`Error fetching partner stats: ${error.message}`);
    }
  }

  // Update visibility control
  async updateVisibilityControl(
    id: string,
    visibilityControl: { publicWebsite: boolean; partnershipPage: boolean }
  ): Promise<IPartner | null> {
    try {
      await this.ensureConnection();

      return await partnerModel.findByIdAndUpdate(
        id,
        { $set: { visibilityControl } },
        { new: true, runValidators: true }
      ).populate("associatedEvents");
    } catch (error: any) {
      throw new Error(`Error updating visibility control: ${error.message}`);
    }
  }
}

export default new PartnerService();