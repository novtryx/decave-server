export const eventFeedbackTemplate = (
  logoUrl: string,
  eventTitle: string,
  formLink: string,
  customMessage?: string
) => {
  const intro = customMessage
    ? customMessage
    : `Thank you for being part of <strong>${eventTitle}</strong>! We'd love to hear about your experience — it only takes a couple of minutes and helps us make the next one even better.`;

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>We'd love your feedback</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">

      <!-- Preheader (hidden preview text in inbox) -->
      <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
        Tell us about your experience at ${eventTitle} — it only takes a minute.
      </div>

      <div style="padding:40px 20px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

          <!-- Header -->
          <div style="background:#111827; padding:30px; text-align:center;">
            <img src="${logoUrl}" alt="deCave Logo" style="height:45px;" />
          </div>

          <!-- Content -->
          <div style="padding:40px 30px; color:#374151; font-size:15px; line-height:1.8;">
            <p style="margin:0 0 20px 0;">${intro}</p>

            <div style="text-align:center; margin:30px 0;">
              <a
                href="${formLink}"
                style="display:inline-block; background:#CCA33A; color:#111827; text-decoration:none; font-weight:bold; padding:14px 32px; border-radius:6px; font-size:15px;"
              >
                Share Your Feedback
              </a>
            </div>

            <p style="margin:20px 0 0 0; font-size:13px; color:#6b7280;">
              If the button above doesn't work, copy and paste this link into your browser:
              <br />
              <a href="${formLink}" style="color:#CCA33A; word-break:break-all;">${formLink}</a>
            </p>
          </div>

          <!-- Divider -->
          <hr style="border:none; border-top:1px solid #e5e7eb; margin:0 30px;" />

          <!-- Footer -->
          <div style="padding:25px 30px; text-align:center; font-size:12px; color:#9ca3af; line-height:1.6;">
            <p style="margin:0;">
              deCave Mgt © ${new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>

        <!-- Bottom spacing -->
        <div style="text-align:center; margin-top:20px; font-size:11px; color:#9ca3af;">
          Where culture meets experience.
        </div>

      </div>

    </body>
  </html>
  `;
};