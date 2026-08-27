import axios from "axios";

// Sandbox vs live is purely this one env var — same code path either
// way, matching what Paystack does with its secret key. Defaults to
// sandbox so an unset env var never accidentally hits live.
const MONNIFY_BASE_URL = process.env.MONNIFY_BASE_URL || "https://sandbox.monnify.com";
const MONNIFY_API_KEY = process.env.MONNIFY_API_KEY!;
const MONNIFY_SECRET_KEY = process.env.MONNIFY_SECRET_KEY!;
export const MONNIFY_CONTRACT_CODE = process.env.MONNIFY_CONTRACT_CODE!;

const client = axios.create({ baseURL: MONNIFY_BASE_URL });

// Monnify access tokens are valid for 1 hour. Cached in memory rather
// than re-authenticating on every single checkout — refreshed 60s
// before actual expiry as a safety margin against clock drift/latency.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${MONNIFY_API_KEY}:${MONNIFY_SECRET_KEY}`).toString("base64");
  const res = await client.post(
    "/api/v1/auth/login",
    {},
    { headers: { Authorization: `Basic ${basic}` } }
  );

  const accessToken = res.data?.responseBody?.accessToken;
  if (!accessToken) {
    throw new Error("Monnify login did not return an access token");
  }

  cachedToken = {
    value: accessToken,
    // Monnify doesn't return an expiresIn in this response, so we
    // conservatively cache for 55 minutes (docs state 1hr validity).
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
  return accessToken;
}

export interface MonnifyInitParams {
  amount: number;
  customerName: string;
  customerEmail: string;
  paymentReference: string;
  paymentDescription: string;
  redirectUrl: string;
  metadata?: Record<string, any>;
}

export interface MonnifyInitResult {
  checkoutUrl: string;
  transactionReference: string;
}

async function initializeTransaction(params: MonnifyInitParams): Promise<MonnifyInitResult> {
  const token = await getAccessToken();

  const res = await client.post(
    "/api/v1/merchant/transactions/init-transaction",
    {
      amount: params.amount,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      paymentReference: params.paymentReference,
      paymentDescription: params.paymentDescription,
      currencyCode: "NGN",
      contractCode: MONNIFY_CONTRACT_CODE,
      redirectUrl: params.redirectUrl,
      paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
      ...(params.metadata && { metaData: params.metadata }),
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const body = res.data?.responseBody;
  if (!res.data?.requestSuccessful || !body?.checkoutUrl) {
    throw new Error(res.data?.responseMessage || "Monnify transaction initialization failed");
  }

  return {
    checkoutUrl: body.checkoutUrl,
    transactionReference: body.transactionReference,
  };
}

export default { initializeTransaction };