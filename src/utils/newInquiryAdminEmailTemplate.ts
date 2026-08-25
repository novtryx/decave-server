export const newInquiryAdminEmailTemplate = (
  logoUrl: string,
  fullName: string,
  email: string,
  phoneNumber: string,
  inquiryType: string,
  message: string
) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>New Contact Inquiry</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
        New ${inquiryType} inquiry from ${fullName}
      </div>

      <div style="padding:40px 20px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

          <div style="background:#111827; padding:30px; text-align:center;">
            <img src="${logoUrl}" alt="deCave Logo" style="height:45px;" />
          </div>

          <div style="padding:40px 30px; color:#374151; font-size:15px; line-height:1.8;">
            <h2 style="margin:0 0 16px 0; color:#111827; font-size:20px;">New Contact Inquiry</h2>
            <p style="margin:0 0 20px 0;">Someone just reached out through the deCave contact form.</p>

            <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
              <tr>
                <td style="padding:8px 0; color:#6b7280; font-size:13px;">Name</td>
                <td style="padding:8px 0; color:#111827; font-size:14px; text-align:right;">${fullName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; color:#6b7280; font-size:13px; border-top:1px solid #e5e7eb;">Email</td>
                <td style="padding:8px 0; color:#111827; font-size:14px; text-align:right; border-top:1px solid #e5e7eb;">${email}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; color:#6b7280; font-size:13px; border-top:1px solid #e5e7eb;">Phone</td>
                <td style="padding:8px 0; color:#111827; font-size:14px; text-align:right; border-top:1px solid #e5e7eb;">${phoneNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; color:#6b7280; font-size:13px; border-top:1px solid #e5e7eb;">Inquiry Type</td>
                <td style="padding:8px 0; color:#111827; font-size:14px; text-align:right; border-top:1px solid #e5e7eb;">${inquiryType}</td>
              </tr>
            </table>

            <div style="background:#f9fafb; border-radius:8px; padding:16px 18px; margin-bottom:8px;">
              <p style="margin:0 0 6px 0; color:#6b7280; font-size:12px; text-transform:uppercase; letter-spacing:0.05em;">Message</p>
              <p style="margin:0; color:#111827; font-size:14px; white-space:pre-wrap;">${message}</p>
            </div>

            <p style="margin:20px 0 0 0; font-size:13px; color:#6b7280;">
              Reply directly to this person at
              <a href="mailto:${email}" style="color:#CCA33A; text-decoration:none;">${email}</a>.
            </p>
          </div>

          <hr style="border:none; border-top:1px solid #e5e7eb; margin:0 30px;" />

          <div style="padding:25px 30px; text-align:center; font-size:12px; color:#9ca3af; line-height:1.6;">
            <p style="margin:0;">
              deCave Mgt © ${new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </body>
  </html>
`;