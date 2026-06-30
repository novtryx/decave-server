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

const logo2 = async (): Promise<Buffer> => {
  const response = await fetch(
    "https://api.decavemgt.com/decave-logo.png"
  );

  if (!response.ok) {
    throw new Error("Failed to fetch logo");
  }

  return Buffer.from(await response.arrayBuffer());
};

// ---------------------------------------------------------------------------
// Public entry point — picks the right layout based on the ticket name.
// Any ticket whose name contains "group" (case-insensitive) gets the
// bolder, group-styled layout. Everything else uses the original layout.
// ---------------------------------------------------------------------------
export const generateTicketPDF = async (data: any): Promise<Buffer> => {
  const isGroupTicket = (data?.ticket?.ticketName || "")
    .toString()
    .toLowerCase()
    .includes("group");

  return isGroupTicket ? generateGroupTicketPDF(data) : generateStandardTicketPDF(data);
};

// ---------------------------------------------------------------------------
// STANDARD TICKET (original layout, unchanged)
// ---------------------------------------------------------------------------
const generateStandardTicketPDF = async ({
  buyer,
  event,
  ticket,
  transaction,
}: any): Promise<Buffer> => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // === Load logo FIRST ===
      const logoBuffer = await logo2();

      // === Background ===
      doc.rect(0, 0, 612, 792).fill("#0A0A0A");

      // === Header ===
      doc.rect(50, 50, 512, 80).fill("#BA8703");
      doc.image(logoBuffer, 56, 55, { width: 60, height: 40 });

      // === Event Title & Theme ===
      doc.fillColor("#F9F7F4")
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(event.eventTitle, 200, 55, { width: 360 });

      doc.fontSize(20)
        .fillColor("#CCA33A")
        .text(event.eventTheme, 200, 75, { width: 360 });

      // === Ticket Type ===
      doc.fontSize(12)
        .fillColor("#F9F7F4")
        .font("Helvetica")
        .text(`${ticket.ticketName} Ticket`, 200, 105);

      // === QR Code ===
      doc.image(buyer.qrCode, 206, 150, { width: 200, height: 200 });

      // === Ticket ID & Transaction ===
      doc.fillColor("#F9F7F4")
        .fontSize(16)
        .text(`Ticket ID: ${buyer.ticketId}`, 0, 370, {
          align: "center",
          width: 612,
        });

      doc.fillColor("#b3b3b3")
        .fontSize(10)
        .text(`Transaction: ${transaction.txnId}`, 0, 390, {
          align: "center",
          width: 612,
        });

      // === Buyer & Event Details ===
      let yPos = 420;
      const details = [
        { label: "Ticket Holder", value: buyer.fullName },
        { label: "Email", value: buyer.email },
        {
          label: "Event Date & Time",
          value: `${formatDate(event.startDate)}\n${formatTime(
            event.startDate
          )} - ${formatTime(event.endDate)}`,
        },
        { label: "Venue", value: `${event.venue}\n${event.address}` },
        { label: "Phone Number", value: buyer.phoneNumber },
      ];

      details.forEach((detail) => {
        doc.fillColor("#b3b3b3").fontSize(10).text(detail.label, 70, yPos);
        doc
          .fillColor("#F9F7F4")
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(detail.value, 70, yPos + 15);
        yPos += 50;
      });

      // === Footer ===
      doc.fillColor("#999999")
        .fontSize(9)
        .text(
          "Present this ticket at the entrance. Each QR code can only be used once.",
          50,
          yPos + 20,
          { width: 512, align: "center" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// ---------------------------------------------------------------------------
// GROUP TICKET — bolder, more visually distinct layout.
// The ticket holder's name is the visual anchor (large, centered, near top),
// with a gold "GROUP" ribbon/badge, a side accent rail, and a cleaner
// two-column detail grid below the QR code.
// ---------------------------------------------------------------------------
const generateGroupTicketPDF = async ({
  buyer,
  event,
  ticket,
  transaction,
}: any): Promise<Buffer> => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 0 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const logoBuffer = await logo2();

      const PAGE_W = 612;
      const PAGE_H = 792;
      const GOLD = "#CCA33A";
      const GOLD_DEEP = "#BA8703";
      const DARK = "#0A0A0A";
      const PANEL = "#141414";
      const TEXT = "#F9F7F4";
      const MUTED = "#9A9A9A";

      // === Full background ===
      doc.rect(0, 0, PAGE_W, PAGE_H).fill(DARK);

      // === Left accent rail ===
      doc.rect(0, 0, 14, PAGE_H).fill(GOLD);

      // === Top bar with logo + small event title ===
      doc.rect(14, 0, PAGE_W - 14, 70).fill(PANEL);
      doc.image(logoBuffer, 38, 15, { width: 50, height: 40 });
      doc.fillColor(MUTED)
        .fontSize(10)
        .font("Helvetica")
        .text(event.eventTitle, 110, 22, { width: 440 });
      doc.fillColor(GOLD)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(event.eventTheme, 110, 36, { width: 440 });

      // === GROUP badge (top right ribbon) ===
      doc.roundedRect(460, 18, 100, 24, 4).fill(GOLD_DEEP);
      doc.fillColor(DARK)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("GROUP PASS", 460, 25, { width: 100, align: "center" });

      // === Hero block: ticket holder name, large and centered ===
      doc.fillColor(MUTED)
        .fontSize(11)
        .font("Helvetica")
        .text("TICKET HOLDER", 0, 100, { align: "center", width: PAGE_W });

      doc.fillColor(TEXT)
        .fontSize(34)
        .font("Helvetica-Bold")
        .text(buyer.fullName, 40, 120, {
          align: "center",
          width: PAGE_W - 80,
        });

      // Thin gold rule under the name
      const nameHeight = doc.heightOfString(buyer.fullName, {
        width: PAGE_W - 80,
        align: "center",
      });
      const ruleY = 120 + nameHeight + 14;
      doc.moveTo(PAGE_W / 2 - 60, ruleY)
        .lineTo(PAGE_W / 2 + 60, ruleY)
        .lineWidth(2)
        .strokeColor(GOLD)
        .stroke();

      // === Ticket type pill, just below the rule ===
      const pillY = ruleY + 16;
      doc.fillColor(GOLD)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text(`${ticket.ticketName} Ticket`, 0, pillY, {
          align: "center",
          width: PAGE_W,
        });

      // === QR Code, centered in its own panel ===
      const qrPanelY = pillY + 36;
      doc.roundedRect(PAGE_W / 2 - 110, qrPanelY, 220, 220, 8).fill(PANEL);
      doc.image(buyer.qrCode, PAGE_W / 2 - 90, qrPanelY + 20, {
        width: 180,
        height: 180,
      });

      // === Ticket ID & Transaction ===
      const idY = qrPanelY + 236;
      doc.fillColor(TEXT)
        .fontSize(15)
        .font("Helvetica-Bold")
        .text(`Ticket ID: ${buyer.ticketId}`, 0, idY, {
          align: "center",
          width: PAGE_W,
        });

      doc.fillColor(MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text(`Transaction: ${transaction.txnId}`, 0, idY + 18, {
          align: "center",
          width: PAGE_W,
        });

      // === Detail grid (two columns) in a card ===
      const cardY = idY + 50;
      const cardH = 150;
      doc.roundedRect(40, cardY, PAGE_W - 80, cardH, 8).fill(PANEL);

      const colLeftX = 64;
      const colRightX = PAGE_W / 2 + 20;
      const rowGap = 50;

      const leftDetails = [
        { label: "Email", value: buyer.email },
        { label: "Phone Number", value: buyer.phoneNumber },
        { label: "Venue", value: `${event.venue}\n${event.address}` },
      ];
      const rightDetails = [
        {
          label: "Event Date",
          value: formatDate(event.startDate),
        },
        {
          label: "Event Time",
          value: `${formatTime(event.startDate)} - ${formatTime(event.endDate)}`,
        },
      ];

      let ly = cardY + 24;
      leftDetails.forEach((d) => {
        doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(d.label, colLeftX, ly);
        doc.fillColor(TEXT).fontSize(11).font("Helvetica-Bold").text(d.value, colLeftX, ly + 13, { width: 220 });
        ly += rowGap;
      });

      let ry = cardY + 24;
      rightDetails.forEach((d) => {
        doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(d.label, colRightX, ry);
        doc.fillColor(TEXT).fontSize(11).font("Helvetica-Bold").text(d.value, colRightX, ry + 13, { width: 200 });
        ry += rowGap;
      });

      // === Footer banner ===
      const footerY = cardY + cardH + 24;
      doc.rect(14, footerY, PAGE_W - 14, 46).fill(GOLD_DEEP);
      doc.fillColor(DARK)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(
          "GROUP ENTRY · Present this ticket at the entrance. Each QR code can only be used once.",
          40,
          footerY + 17,
          { width: PAGE_W - 94, align: "center" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// ---------------------------------------------------------------------------
// Email template (unchanged, with a small "GROUP" badge added automatically
// when the ticket is a group ticket)
// ---------------------------------------------------------------------------
export const ticketEmailTemplate = ({
  buyer,
  event,
  ticket,
  transaction,
  logoUrl = `${process.env.APP_URL}/decave-logo.png`
}: any) => {
  const isGroupTicket = (ticket?.ticketName || "").toString().toLowerCase().includes("group");

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
        ${isGroupTicket ? `<p style="margin:6px 0 0; display:inline-block; background:#BA8703; color:#0A0A0A; font-size:11px; font-weight:700; padding:4px 10px; border-radius:4px; letter-spacing:0.5px;">GROUP PASS</p>` : ""}
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