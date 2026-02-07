import app from "../app";
import { VercelRequest, VercelResponse } from "@vercel/node"; 


export default async function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any); // casting works because Express types differ slightly
}
