import {  Request, Response } from "express";
import eventService from "../services/event.service";
import uploadService from "../services/upload.service";
import { AuthRequest } from "../middleware/auth.middleware";
import activityService  from "../services/notification.service";
import transactionService from "../services/transaction.service";
import { sendBulkEmail } from "../utils/bulkMail";
import { eventFeedbackTemplate } from "../utils/eventFeedbackEmailTemplate";



// Create event (Stage 1)
export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const eventData = req.body;

    // This route accepts multipart/form-data (for the banner file upload),
    // so nested objects like `eventDetails` may arrive as a JSON string
    // rather than a parsed object, depending on how the client built the
    // form. Parse defensively instead of crashing on `.eventBanner = ...`.
    if (typeof eventData.eventDetails === "string") {
      try {
        eventData.eventDetails = JSON.parse(eventData.eventDetails);
      } catch {
        res.status(400).json({
          success: false,
          message: "eventDetails must be valid JSON",
        });
        return;
      }
    }

    if (!eventData.eventDetails || typeof eventData.eventDetails !== "object") {
      res.status(400).json({
        success: false,
        message: "eventDetails is required",
      });
      return;
    }

    // Handle event banner upload if file is provided
    if (req.file) {
      const result = await uploadService.uploadImage(req.file.buffer, "decave/events/banners");
      eventData.eventDetails.eventBanner = result.secure_url;
    }

    const newEvent = await eventService.createEvent(eventData);
    
    res.status(201).json({
      success: true,
      message: "Event created successfully (Stage 1)",
      data: newEvent,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get event by ID
export const getEventById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const event = await eventService.getEventById(id as string);

    if (!event) {
      res.status(404).json({
        success: false,
        message: "Event not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateEventTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { eventId , ticketId } = req.params;
    const updateData = req.body;
    const eventIdStr = Array.isArray(eventId) ? eventId[0] : eventId;
    const ticketIdStr = Array.isArray(ticketId) ? ticketId[0] : ticketId;


    if (!eventId || !ticketId) {
      return res.status(400).json({
        success: false,
        message: "Event ID and Ticket ID are required",
      });
    }

    const result = await eventService.updateEventTicket(
      eventIdStr,
      ticketIdStr,
      updateData
    );

    return res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      data: result.event,
      ...(result.warnings.length > 0 && { warnings: result.warnings }),
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};


export const createEventTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { eventId } = req.params;
    const data = req.body;

    const eventIdStr = Array.isArray(eventId)
      ? eventId[0]
      : eventId;

    if (!eventIdStr) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required",
      });
    }

    // Required fields validation
    if (
      !data.ticketName ||
      data.price === undefined ||
      data.initialQuantity === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "ticketName, price and initialQuantity are required",
      });
    }

    const createdEvent = await eventService.createEventTicket(
      eventIdStr,
      data
    );

    if (!createdEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data: createdEvent,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};


export const getEventByTitle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventTitle } = req.params;

    const event = await eventService.getEventByName(eventTitle as string);

    if (!event) {
      res.status(404).json({
        success: false,
        message: "Event not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all events
export const getAllEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const filters: any = {};
    if (req.query.published !== undefined) {
      filters.published = req.query.published === "true";
    }
    if (req.query.stage) {
      filters.stage = parseInt(req.query.stage as string);
    }

    const result = await eventService.getAllEvents(page, limit, filters);

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update event (general)
export const updateEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    console.log("keys", Object.keys(updateData))

    const updatedEvent = await eventService.updateEvent(id as string, updateData);

    if (!updatedEvent) {
      res.status(404).json({
        success: false,
        message: "Event not found",
      });
      return;
    }

    if(updatedEvent.published){
        try {
          await activityService.createActivity( `"${updatedEvent.eventDetails.eventTitle}" is published live`, "event_published")
        } catch (activityError: any) {
          console.error("Failed to log event_published activity:", activityError.message);
        }
        res.status(200).json({
        success: true,
        message: "Event updated successfully",
        data: updatedEvent,
    });
    } else {
        try {
          await activityService.createActivity( `"${updatedEvent.eventDetails.eventTitle}" was updated`, "event_updated")
        } catch (activityError: any) {
          console.error("Failed to log event_updated activity:", activityError.message);
        }
         res.status(200).json({
        success: true,
        message: "Event updated successfully",
        data: updatedEvent,
         });
    }
    
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

// Update event stage
export const updateEventStage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    if (!stage || stage < 1 || stage > 5) {
      res.status(400).json({
        success: false,
        message: "Invalid stage number. Stage must be between 1 and 5",
      });
      return;
    }

    const updatedEvent = await eventService.updateEventStage(id as string, stage, req.body);

    res.status(200).json({
      success: true,
      message: `Event updated successfully (Stage ${stage})`,
      data: updatedEvent,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete event
export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await eventService.deleteEvent(id as string);

    res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Publish event
export const publishEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const publishedEvent = await eventService.publishEvent(id as string);

    res.status(200).json({
      success: true,
      message: "Event published successfully",
      data: publishedEvent,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Unpublish event
export const unpublishEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const unpublishedEvent = await eventService.unpublishEvent(id as string);

    res.status(200).json({
      success: true,
      message: "Event unpublished successfully",
      data: unpublishedEvent,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get published events
export const getPublishedEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await eventService.getPublishedEvents(page, limit);

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Search events
export const searchEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;

    if (!q) {
      res.status(400).json({
        success: false,
        message: "Search query is required",
      });
      return;
    }

    const events = await eventService.searchEvents(q as string);

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get upcoming events
export const getUpcomingEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await eventService.getUpcomingEvents(page, limit);

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get past events
export const getPastEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await eventService.getPastEvents(page, limit);

    res.status(200).json({
      success: true,
      data: result.events,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get event statistics
export const getEventStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await eventService.getEventStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Send a feedback-request email (with a Google Form link) to everyone
// who completed a ticket purchase for this event
export const sendEventFeedbackRequest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { formLink, subject, message } = req.body;

    const event = await eventService.getEventById(id as string);
    if (!event) {
      res.status(404).json({
        success: false,
        message: "Event not found",
      });
      return;
    }

    const buyers = await transactionService.getCompletedBuyerEmailsForEvent(id as string);

    if (buyers.length === 0) {
      res.status(400).json({
        success: false,
        message: "No completed ticket buyers found for this event",
      });
      return;
    }

    const eventTitle = event.eventDetails.eventTitle;
    const htmlBody = eventFeedbackTemplate(
      `https://decave-demo-server.vercel.app/decave-logo.png`,
      eventTitle,
      formLink,
      message
    );

    const result = await sendBulkEmail(
      buyers.map((b) => b.email),
      subject || `How was ${eventTitle}? We'd love your feedback`,
      htmlBody
    );

    // Activity logging is a side effect, not the primary action — the
    // emails have already gone out by this point. A logging failure
    // (bad enum value, DB hiccup, etc.) must never turn a successful
    // send into an error response to the client.
    try {
      await activityService.createActivity(
        `Feedback request sent to ${result.sentCount} attendee(s) of "${eventTitle}"`,
        "feedback_request_sent"
      );
    } catch (activityError: any) {
      console.error("Failed to log feedback-request activity:", activityError.message);
    }

    res.status(200).json({
      success: true,
      message: "Feedback request emails sent",
      totalRecipients: result.totalRecipients,
      sentCount: result.sentCount,
      failedBatches: result.failedBatches.length > 0 ? result.failedBatches : undefined,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};