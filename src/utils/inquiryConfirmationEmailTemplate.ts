export const inquiryConfirmationEmailTemplate = (logoUrl: string, fullName: string, inquiryType: string) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>We've received your message</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
        We've received your ${inquiryType.toLowerCase()} inquiry — deCave
      </div>

      <div style="padding:40px 20px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

          <div style="background:#111827; padding:30px; text-align:center;">
            <img src="${logoUrl}" alt="deCave Logo" style="height:45px;" />
          </div>

          <div style="padding:40px 30px; color:#374151; font-size:15px; line-height:1.8;">
            <h2 style="margin:0 0 16px 0; color:#111827; font-size:20px;">We've got your message ✅</h2>
            <p style="margin:0 0 12px 0;">Hi ${fullName},</p>
            <p style="margin:0 0 20px 0;">
              Thanks for reaching out to deCave. We've received your ${inquiryType.toLowerCase()} inquiry
              and our team will get back to you within 24–48 hours.
            </p>
            <p style="margin:0; font-size:13px; color:#6b7280;">
              If your inquiry is time-sensitive, feel free to reply directly to this email.
            </p>
          </div>

          <hr style="border:none; border-top:1px solid #e5e7eb; margin:0 30px;" />

          <div style="padding:25px 30px; text-align:center; font-size:12px; color:#9ca3af; line-height:1.6;">
            <p style="margin:0;">
              deCave Mgt © ${new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>

        <div style="text-align:center; margin-top:20px; font-size:11px; color:#9ca3af;">
          Where culture meets experience.
        </div>
      </div>
    </body>
  </html>
`;