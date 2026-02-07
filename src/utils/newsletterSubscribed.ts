export const newsletterSubscribedEmail = (logoUrl: string) => {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; background:#f9fafb; padding:40px;">
      <div style="max-width:600px; margin:auto; background:#ffffff; padding:30px; border-radius:8px;">
        
        <div style="text-align:center; margin-bottom:20px;">
          <img src="${logoUrl}" alt="Logo" style="height:50px;" />
        </div>

        <h2 style="color:#111827;">You’re subscribed 🎉</h2>

        <p style="color:#374151; font-size:15px;">
          Thank you for subscribing to our newsletter.
        </p>

        <p style="color:#374151; font-size:15px;">
          You’ll now receive updates, announcements, and important news directly in your inbox.
        </p>

        <p style="color:#6b7280; font-size:13px; margin-top:30px;">
          If you did not subscribe, you can safely ignore this email.
        </p>

        <hr style="margin:30px 0;" />

        <p style="color:#9ca3af; font-size:12px; text-align:center;">
          © ${new Date().getFullYear()} All rights reserved.
        </p>
      </div>
    </div>
  `;
};
