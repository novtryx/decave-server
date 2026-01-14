import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import adminRoute from './routes/admin.route';
import { authRateLimiter } from './middleware/rateLimit.middleware';


const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes placeholder (will add limiter later)
app.use('/api/auth', authRateLimiter, adminRoute);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy' });
});

export default app;
