export const newApplicationAdminEmailTemplate = (
  logoUrl: string,
  applicantName: string,
  applicantEmail: string,
  categoryName: string,
  reviewUrl: string
) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>New Open Call Application</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: Arial, Helvetica, sans-serif;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
        New ${categoryName} application from ${applicantName}
      </div>

      <div style="padding:40px 20px;">
        <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

          <div style="background:#111827; padding:30px; text-align:center;">
            <img src="${logoUrl}" alt="deCave Logo" style="height:45px;" />
          </div>

          <div style="padding:40px 30px; color:#374151; font-size:15px; line-height:1.8;">
            <h2 style="margin:0 0 16px 0; color:#111827; font-size:20px;">New Open Call Application</h2>
            <p style="margin:0 0 20px 0;">A new application has just been submitted for Afrospook 2026.</p>

            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
              <tr>
                <td style="padding:8px 0; color:#6b7280; font-size:13px;">Applicant</td>
                <td style="padding:8px 0; color:#111827; font-size:14px; text-align:right;">${applicantName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; color:#6b7280; font-size:13px; border-top:1px solid #e5e7eb;">Email</td>
                <td style="padding:8px 0; color:#111827; font-size:14px; text-align:right; border-top:1px solid #e5e7eb;">${applicantEmail}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; color:#6b7280; font-size:13px; border-top:1px solid #e5e7eb;">Category</td>
                <td style="padding:8px 0; color:#111827; font-size:14px; text-align:right; border-top:1px solid #e5e7eb;">${categoryName}</td>
              </tr>
            </table>

            <div style="text-align:center; margin:30px 0;">
              <a
                href="${reviewUrl}"
                style="display:inline-block; background:#CCA33A; color:#111827; text-decoration:none; font-weight:bold; padding:14px 32px; border-radius:6px; font-size:15px;"
              >
                Login into the Admin to Review
              </a>
            </div>
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