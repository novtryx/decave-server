export const newsletterTemplate = (
  logoUrl: string,
  body: string
) => {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>Newsletter</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">

      <!-- Preheader (hidden preview text in inbox) -->
      <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
        Latest updates and important announcements from deCave Management.
      </div>

      <div style="padding:40px 20px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

          <!-- Header -->
          <div style="background:#111827; padding:30px; text-align:center;">
            <img src="${logoUrl}" alt="deCave Logo" style="height:45px;" />
          </div>

          <!-- Content -->
          <div style="padding:40px 30px; color:#374151; font-size:15px; line-height:1.8;">
            ${body}
          </div>

          <!-- Divider -->
          <hr style="border:none; border-top:1px solid #e5e7eb; margin:0 30px;" />

          <!-- Footer -->
          <div style="padding:25px 30px; text-align:center; font-size:12px; color:#9ca3af; line-height:1.6;">
            <p style="margin:0 0 10px 0;">
              You’re receiving this email because you subscribed to updates from deCave Management.
            </p>

            <p style="margin:0;">
              deCave Mgt © ${new Date().getFullYear()} All rights reserved.
            </p>

          
          <p style="margin-top:10px;">
              <a href="https://decavemgt.com/unsubscribe" style="color:#6b7280; text-decoration:underline;">Unsubscribe</a>
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


