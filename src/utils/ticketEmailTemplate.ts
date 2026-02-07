import PDFDocument from 'pdfkit';


const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
 const logo = `${process.env.APP_URL}/decave-logo.png`;

export const generateTicketPDF = async ({
  buyer,
  event,
  ticket,
  transaction,
}: any): Promise<Buffer> => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // === Background === 
      doc.rect(0, 0, 612, 792).fill('#0A0A0A');

      // === Header (Gold bar + Logo) ===
      doc.rect(50, 50, 512, 80).fill('#BA8703');
      doc.image(logo, 56, 55, { width: 120, height: 40 });

      // === Event Title & Theme ===
      doc.fillColor('#F9F7F4')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(event.eventTitle, 200, 55, { width: 360 });
      doc.fontSize(20)
        .fillColor('#CCA33A')
        .text(event.eventTheme, 200, 75, { width: 360 });

      // === Ticket Type ===
      doc.fontSize(12)
        .fillColor('#F9F7F4')
        .font('Helvetica')
        .text(`${ticket.ticketName} Ticket`, 200, 105);

      // === QR Code ===
      doc.image(buyer.qrCode, 206, 150, { width: 200, height: 200 });

      // === Ticket ID & Transaction ===
      doc.fillColor('#F9F7F4')
        .fontSize(16)
        .text(`Ticket ID: ${buyer.ticketId}`, 0, 370, { align: 'center', width: 612 });
      doc.fillColor('#b3b3b3')
        .fontSize(10)
        .text(`Transaction: ${transaction.txnId}`, 0, 390, { align: 'center', width: 612 });

      // === Buyer & Event Details ===
      let yPos = 420;
      const details = [
        { label: 'Ticket Holder', value: buyer.fullName },
        { label: 'Email', value: buyer.email },
        {
          label: 'Event Date & Time',
          value: `${formatDate(event.startDate)}\n${formatTime(event.startDate)} - ${formatTime(event.endDate)}`,
        },
        { label: 'Venue', value: `${event.venue}\n${event.address}` },
        { label: 'Phone Number', value: buyer.phoneNumber },
      ];

      details.forEach((detail) => {
        // Label
        doc.fillColor('#b3b3b3')
          .fontSize(10)
          .text(detail.label, 70, yPos);
        // Value
        doc.fillColor('#F9F7F4')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(detail.value, 70, yPos + 15);
        yPos += 50;
      });

      // === Footer ===
      doc.fillColor('#999999')
        .fontSize(9)
        .text('Present this ticket at the entrance. Each QR code can only be used once.', 50, yPos + 20, { width: 512, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Simple email template with PDF attachment
export const ticketEmailTemplate = ({
  buyer,
  event,
  ticket,
  transaction,
  logoUrl = `${process.env.APP_URL}/decave-logo.png`
}: any) => {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background:#0A0A0A; padding:40px;">
    <div style="max-width:600px; margin:auto; background:#151515; padding:30px; border-radius:12px;">

      <!-- Logo -->
      <div style="text-align:center; margin-bottom:20px;">
        <img src="${logoUrl}" alt="Logo" style="height:50px;" />
      </div>

      <!-- Success Header -->
      <div style="text-align:center; margin-bottom:30px;">
        <div style="display:inline-block;width:64px;height:64px;border:2px solid #22C55E;border-radius:50%;line-height:64px">
          <span style="color:#00C950;font-size:32px">✓</span>
        </div>
        <h1 style="margin:10px 0 0; font-size:28px; font-weight:600; color:#F9F7F4;">Payment Successful!</h1>
      </div>

      <!-- Greeting -->
      <p style="margin:0 0 16px; color:#F9F7F4; font-size:16px;">Hi ${buyer.fullName},</p>
      <p style="margin:0 0 16px; color:#b3b3b3; font-size:14px; line-height:1.6;">
        Your ticket for <strong style="color:#CCA33A">${event.eventTheme}</strong> has been confirmed! 
      </p>

      <!-- Event Info Box -->
      <div style="background:#0A0A0A; border-left:4px solid #CCA33A; padding:20px; margin:20px 0; border-radius:6px;">
        <p style="margin:0 0 6px; color:#CCA33A; font-size:12px; font-weight:600;">EVENT DETAILS</p>
        <p style="margin:0 0 4px; color:#F9F7F4; font-size:16px; font-weight:500;">${event.eventTitle}</p>
        <p style="margin:0 0 4px; color:#b3b3b3; font-size:14px;">📍 ${event.venue}</p>
        <p style="margin:0 0 4px; color:#b3b3b3; font-size:14px;">🗓 ${formatDate(event.startDate)} | ${formatTime(event.startDate)} - ${formatTime(event.endDate)}</p>
        <p style="margin:0; color:#b3b3b3; font-size:14px;">🎫 ${ticket.ticketName} Ticket | Ticket ID: ${buyer.ticketId}</p>
      </div>

      <!-- PDF Reminder -->
      <p style="margin:0 0 16px; color:#b3b3b3; font-size:14px; line-height:1.6;">
        Your ticket is attached as a PDF. Please save it to your phone or print it to present at the venue entrance.
      </p>

      <!-- Quick Reminders -->
      <div style="background:#2A1F0F; border:2px solid #F59E0B; border-radius:8px; padding:20px; margin-bottom:24px;">
        <p style="margin:0 0 10px; color:#F59E0B; font-size:14px; font-weight:600;">📌 Quick Reminders:</p>
        <ul style="margin:0; padding-left:20px; color:#b3b3b3; font-size:13px; line-height:1.6;">
          <li>Each QR code can only be scanned once</li>
          <li>Arrive early to avoid queues</li>
          <li>Bring a valid ID matching the ticket holder name</li>
        </ul>
      </div>

      <!-- Footer -->
      <div style="text-align:center; padding-top:20px; border-top:1px solid #27272A;">
        <p style="margin:0 0 8px; color:#666; font-size:12px;">
          Questions? Contact <a href="mailto:support@decavemgt.com" style="color:#CCA33A; text-decoration:none;">support@decavemgt.com</a>
        </p>
        <p style="margin:0; color:#666; font-size:11px;">© ${new Date().getFullYear()} DeCave. All rights reserved.</p>
      </div>

    </div>
  </div>
  `;
};
