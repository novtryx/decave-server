import { zeptoClient } from "../config/mailer";

const BATCH_SIZE = 50;

export interface BulkSendResult {
  sentCount: number;
  failedBatches: number[];
  totalRecipients: number;
}

/**
 * Sends a single HTML email to many recipients via BCC, batched in
 * groups of 50 to stay within ZeptoMail's per-request recipient
 * limits. Batches are dispatched concurrently (not sequentially) —
 * this is the same approach the newsletter feature already used in
 * production, just extracted so it isn't duplicated per feature.
 */
export const sendBulkEmail = async (
  recipientEmails: string[],
  subject: string,
  htmlBody: string
): Promise<BulkSendResult> => {
  const batches: string[][] = [];
  for (let i = 0; i < recipientEmails.length; i += BATCH_SIZE) {
    batches.push(recipientEmails.slice(i, i + BATCH_SIZE));
  }

  let sentCount = 0;
  const failedBatches: number[] = [];

  const results = await Promise.allSettled(
    batches.map((batch) =>
      zeptoClient.post("/email", {
        from: {
          address: "info@decavemgt.com",
          name: "DeCave Management",
        },
        to: [
          {
            email_address: {
              address: "info@decavemgt.com",
              name: "DeCave Management",
            },
          },
        ],
        bcc: batch.map((email) => ({
          email_address: {
            address: email,
            name: email.split("@")[0],
          },
        })),
        subject,
        htmlbody: htmlBody,
      })
    )
  );

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      sentCount += batches[index].length;
      console.log(`✅ Bulk email batch ${index + 1}/${batches.length} sent`);
    } else {
      const reason =
        (result.reason as any)?.response?.data || (result.reason as any)?.message;
      console.error(`❌ Bulk email batch ${index + 1} failed:`, reason);
      failedBatches.push(index + 1);
    }
  });

  return { sentCount, failedBatches, totalRecipients: recipientEmails.length };
};