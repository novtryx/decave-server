import {  Request, Response } from "express";
import eventService from "../services/event.service";
import uploadService from "../services/upload.service";
import { AuthRequest } from "../middleware/auth.middleware";
import activityService  from "../services/notification.service";

// Create event (Stage 1)
export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const eventData = req.body;

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
export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedEvent = await eventService.updateEvent(id as string, updateData);

    if (!updatedEvent) {
      res.status(404).json({
        success: false,
        message: "Event not found",
      });
      return;
    }

    if(updatedEvent.published){
        await  activityService.createActivity( `"${updatedEvent.eventDetails.eventTitle}" is published live`, "event_published")
        res.status(200).json({
        success: true,
        message: "Event updated successfully",
        data: updatedEvent,
    });
    } else {
        await  activityService.createActivity( `"${updatedEvent.eventDetails.eventTitle}" was updated`, "event_published")
         res.status(200).json({
        success: true,
        message: "Event updated successfully",
        data: updatedEvent,
         });
    }
    
  } catch (error: any) {
    res.status(500).json({
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
    res.status(500).json({
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