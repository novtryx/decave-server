import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';


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
//   const logo = "https://decave-demo.vercel.app/logo.svg"
export const generateTicketPDF = async ({
  buyer,
  event,
  ticket,
  transaction
}: any): Promise<Buffer> => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Background
      doc.rect(0, 0, 612, 792).fill('#0A0A0A');

      // Golden gradient header (simulated with rectangles)
      doc.rect(50, 50, 512, 120).fill('#BA8703');
      
    // doc.image(logo, 56, 50, { width: 500, height: 50 });

      // Event info on gradient
      doc.fillColor('#000000')
         .fontSize(12)
         .text(event.eventTitle, 70, 70)
         .fontSize(24)
         .font('Helvetica-Bold')
         .text(event.eventTheme, 70, 90)
         .fontSize(12)
         .font('Helvetica')
         .text(`${ticket.ticketName} Ticket`, 70, 125);

      doc.image(buyer.qrCode, 206, 200, { width: 200, height: 200 });
      
      // Ticket ID below QR
      doc.fillColor('#ffffff')
         .fontSize(20)
         .text(`Ticket ID: ${buyer.ticketId}`, 0, 410, { align: 'center', width: 612 })
         .fontSize(9)
         .fillColor('#999999')
         .text(`Transaction: ${transaction.txnId}`, 0, 435, { align: 'center', width: 612 });

      // Ticket details section
      let yPos = 470;
      const details = [
        { label: 'Ticket Holder', value: buyer.fullName },
        { label: 'Email', value: buyer.email },
        { label: 'Event Date & Time', value: `${formatDate(event.startDate)}\n${formatTime(event.startDate)} - ${formatTime(event.endDate)}` },
        { label: 'Venue', value: `${event.venue}\n${event.address}` },
        { label: 'Phone Number', value: buyer.phoneNumber }
      ];

      details.forEach((detail) => {
        doc.fillColor('#b3b3b3')
           .fontSize(10)
           .text(detail.label, 70, yPos)
           .fillColor('#F9F7F4')
           .fontSize(12)
           .text(detail.value, 70, yPos + 15);
        yPos += 50;
      });

      // Important Information box
    //   doc.rect(50, yPos + 20, 512, 100)
    //      .lineWidth(2)
    //      .strokeColor('#F59E0B')
    //      .fillAndStroke('#2A1F0F', '#F59E0B');

    //   doc.fillColor('#F59E0B')
    //      .fontSize(14)
    //      .font('Helvetica-Bold')
    //      .text('Important Information', 70, yPos + 35);

    //   doc.fillColor('#b3b3b3')
    //      .fontSize(9)
    //      .font('Helvetica')
    //      .text('• Present this QR code at the venue entrance', 70, yPos + 55)
    //      .text('• Valid ID required - name must match ticket holder', 70, yPos + 70)
    //      .text('• Contact: support@dcave.com | +234 800 000 0000', 70, yPos + 85);

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
  transaction
}: any) => {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:40px 20px">
      
      <!-- Success Icon -->
      <div style="text-align:center;margin-bottom:30px">
        <div style="display:inline-block;width:64px;height:64px;border:2px solid #22C55E;border-radius:50%;margin-bottom:20px;line-height:64px">
          <span style="color:#00C950;font-size:32px">✓</span>
        </div>
        <h1 style="margin:0;font-size:36px;font-weight:600;color:#F9F7F4">Payment Successful!</h1>
      </div>

      <!-- Main content -->
      <div style="background:#151515;border:2px solid #27272A;border-radius:12px;padding:32px;margin-bottom:24px">
        <p style="margin:0 0 16px;color:#F9F7F4;font-size:16px">Hi ${buyer.fullName},</p>
        
        <p style="margin:0 0 16px;color:#b3b3b3;font-size:14px;line-height:1.6">
          Your ticket for <strong style="color:#CCA33A">${event.eventTheme}</strong> has been confirmed! 
        </p>

        <div style="background:#0A0A0A;border-left:3px solid #CCA33A;padding:16px;margin:20px 0;border-radius:4px">
          <p style="margin:0 0 8px;color:#CCA33A;font-size:12px;font-weight:600">EVENT DETAILS</p>
          <p style="margin:0 0 4px;color:#F9F7F4;font-size:16px;font-weight:500">${event.eventTitle}</p>
          <p style="margin:0 0 4px;color:#b3b3b3;font-size:14px">📍 ${event.venue}</p>
          <p style="margin:0;color:#b3b3b3;font-size:14px">🗓 ${formatDate(event.startDate)}</p>
        </div>

        <p style="margin:20px 0 0;color:#b3b3b3;font-size:14px;line-height:1.6">
          Your ticket is attached to this email as a PDF. Please save it to your phone or print it out to present at the venue entrance.
        </p>
      </div>

      <!-- Important reminder -->
      <div style="background:#2A1F0F;border:2px solid #F59E0B;border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 12px;color:#F59E0B;font-size:14px;font-weight:600">📌 Quick Reminders:</p>
        <p style="margin:0;color:#b3b3b3;font-size:13px;line-height:1.6">
          • Each QR code can only be scanned once<br/>
          • Arrive early to avoid queues
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:20px 0;border-top:1px solid #27272A">
        <p style="margin:0 0 8px;color:#666;font-size:12px">
          Questions? Contact <a href="mailto:support@decavemgt.com" style="color:#CCA33A;text-decoration:none">support@decavemgt.com</a>
        </p>
        <p style="margin:0;color:#666;font-size:11px">© 2026 DeCave. All rights reserved.</p>
      </div>

    </div>
  </body>
  </html>
  `;
};