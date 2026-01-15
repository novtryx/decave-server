import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import adminRoute from './routes/admin.route';
import { authRateLimiter } from './middleware/rateLimit.middleware';
import { ensureDbConnection } from './middleware/dbConnection.middleware';
import uploadRoutes from "./routes/upload.route";
import eventRoutes from "./routes/event.route";
import partnerRoutes from "./routes/partner.route"



const app: Application = express();

// Middleware
app.use(helmet());
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, mobile apps, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`CORS blocked: ${origin} is not allowed`),
      false
    );
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes placeholder (will add limiter later)
app.use("/api", ensureDbConnection);

app.use('/api/auth', authRateLimiter, adminRoute);
app.use("/api/upload", uploadRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/partners", partnerRoutes);



 
// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy' });
});
 
export default app;
