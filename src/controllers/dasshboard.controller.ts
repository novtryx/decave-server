import { Request, Response } from "express";
import transactionService from "../services/transaction.service";
import eventService from "../services/event.service";
import notificationService from "../services/notification.service";


export const dashboardData = async(req:Request, res:Response) =>{
    try {
        
        const transactionStat = await transactionService.getDashboardStats()
        const ticketStat = await eventService.getEventDashboardStats()
        const upcoming = await eventService.getUpcomingEvents();
        const notification = await notificationService.getAllActivities() 
        


        res.status(200).json({
            success: true,
            upcomingEvents: upcoming,
            ticketSale: transactionStat.ticketsSold,
            revnue: transactionStat.revenue,
            activeEvents: ticketStat.activeEvents,
            recentActivities: notification,
            avgTicketPrice: ticketStat.averageTicketPrice
        })
    } catch (error: any) {
        console.log(error)
    }    


}