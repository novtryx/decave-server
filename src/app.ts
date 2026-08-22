// import express, { Application, Request, Response } from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import adminRoute from './routes/admin.route';
// import { authRateLimiter } from './middleware/rateLimit.middleware';
// import { ensureDbConnection } from './middleware/dbConnection.middleware';
// import uploadRoutes from "./routes/upload.route";
// import eventRoutes from "./routes/event.route";
// import partnerRoutes from "./routes/partner.route"
// import paymentRoutes from "./routes/payment.route"
// import transactionRoute from "./routes/transaction.route"
// import dashboardRoute from "./routes/dashboard.route"
// import analyticsRoute from "./routes/analytics.route"



// const app: Application = express();

// // Middleware
// app.use(helmet());
// const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

// const corsOptions: cors.CorsOptions = {
//   origin: (origin, callback) => {
//     // Allow requests with no origin (Postman, mobile apps, server-to-server)
//     if (!origin) return callback(null, true);

//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     }

//     return callback(
//       new Error(`CORS blocked: ${origin} is not allowed`),
//       false
//     );
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// };

// app.set('trust proxy', 1);
// app.use(cors(corsOptions));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Routes placeholder (will add limiter later)
// app.use("/api", ensureDbConnection);

// app.use('/api/auth', authRateLimiter, adminRoute);
// app.use("/api/upload", uploadRoutes);
// app.use("/api/events", eventRoutes);
// app.use("/api/partners", partnerRoutes);
// app.use("/api/payment", paymentRoutes);
// app.use("/api/transaction", transactionRoute);
// app.use("/api/dashboard", dashboardRoute);
// app.use("/api/analytics", analyticsRoute);




 
// // Health check
// app.get('/api/health', (req: Request, res: Response) => {
//   res.json({ status: 'healthy' });
// });
 
// export default app;


import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";

// Routes
import adminRoute from "./routes/admin.route";
import uploadRoutes from "./routes/upload.route";
import eventRoutes from "./routes/event.route";
import partnerRoutes from "./routes/partner.route";
import paymentRoutes from "./routes/payment.route";
import transactionRoute from "./routes/transaction.route";
import dashboardRoute from "./routes/dashboard.route";
import analyticsRoute from "./routes/analytics.route";
import newsletterRoute from "./routes/newsletter.route"
import galleryRoute from "./routes/gallery.route"
import resendRoute from "./routes/resend.route"
import crmRoute from "./routes/crm.route"
import financeRoute from "./routes/finance.route"
import checkinRoute from "./routes/checkin.route"
import cocktailRedemptionRoute from "./routes/cocktailRedemption.route"
import openCallRoute from "./routes/openCall.route"
import openCallAdminRoute from "./routes/openCallAdmin.route"

// Middleware
import { authRateLimiter } from "./middleware/rateLimit.middleware";
import { ensureDbConnection } from "./middleware/dbConnection.middleware";

const app: Application = express();

// -----------------------------
// Middleware
// -----------------------------
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin} is not allowed`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// -----------------------------
// Ensure DB & Redis Connection
// -----------------------------
app.use("/api", ensureDbConnection);
app.use(express.static("public"));

// -----------------------------
// Routes
// -----------------------------
app.use("/api/auth", authRateLimiter, adminRoute);
app.use("/api/upload", uploadRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/partners", partnerRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/transaction", transactionRoute);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/analytics", analyticsRoute);
app.use("/api/newsletter", newsletterRoute);
app.use("/api/gallery", galleryRoute) 
app.use("/api/resend", resendRoute)
app.use("/api/crm", crmRoute)
app.use("/api/finance", financeRoute)
app.use("/api/checkin", checkinRoute)
app.use("/api/cocktails", cocktailRedemptionRoute)
// Applicant-facing (public, no auth — identity is the resume token)
app.use("/api/apply", openCallRoute)
// Afrospook team review dashboard (authenticated)
app.use("/api/admin/open-call", openCallAdminRoute)



// -----------------------------
// Health / Ping endpoints
// -----------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "healthy" });
});

app.get("/api/ping", (_req: Request, res: Response) => {
  res.send("pong");
});

export default app;