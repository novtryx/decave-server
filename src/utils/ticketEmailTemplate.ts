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

      // === Background ===
      doc.rect(0, 0, PAGE_W, PAGE_H).fill(DARK);

      // === Outer frame — classic engraved-card border ===
      doc.rect(24, 24, PAGE_W - 48, PAGE_H - 48).lineWidth(1).strokeColor(GOLD).stroke();
      doc.rect(30, 30, PAGE_W - 60, PAGE_H - 60).lineWidth(0.5).strokeColor("#4A3B10").stroke();

      // === Header ===
      doc.image(logoBuffer, PAGE_W / 2 - 26, 52, { width: 52, height: 36 });

      doc.fillColor(MUTED)
        .fontSize(10)
        .font("Helvetica")
        .text(event.eventTitle.toUpperCase(), 60, 100, {
          align: "center",
          width: PAGE_W - 120,
          characterSpacing: 1.5,
        });

      doc.fillColor(GOLD)
        .fontSize(26)
        .font("Helvetica-Bold")
        .text(event.eventTheme, 60, 118, {
          align: "center",
          width: PAGE_W - 120,
        });

      // Thin rule under title
      doc.moveTo(PAGE_W / 2 - 50, 160).lineTo(PAGE_W / 2 + 50, 160)
        .lineWidth(1).strokeColor(GOLD).stroke();

      doc.fillColor(TEXT)
        .fontSize(11)
        .font("Helvetica")
        .text(`${ticket.ticketName} Admission`, 60, 172, {
          align: "center",
          width: PAGE_W - 120,
          characterSpacing: 0.5,
        });

      // === QR Code panel ===
      const qrY = 205;
      doc.roundedRect(PAGE_W / 2 - 105, qrY, 210, 210, 6).fill(PANEL);
      doc.roundedRect(PAGE_W / 2 - 105, qrY, 210, 210, 6).lineWidth(0.75).strokeColor(GOLD_DEEP).stroke();
      doc.image(buyer.qrCode, PAGE_W / 2 - 90, qrY + 15, { width: 180, height: 180 });

      // === Ticket ID & Transaction ===
      const idY = qrY + 230;
      doc.fillColor(TEXT)
        .fontSize(15)
        .font("Helvetica-Bold")
        .text(`Ticket No. ${buyer.ticketId}`, 0, idY, {
          align: "center",
          width: PAGE_W,
        });

      doc.fillColor(MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text(`Transaction Ref. ${transaction.txnId}`, 0, idY + 18, {
          align: "center",
          width: PAGE_W,
        });

      // === Perforation-style divider ===
      const dividerY = idY + 48;
      doc.save();
      doc.dash(3, { space: 4 });
      doc.moveTo(50, dividerY).lineTo(PAGE_W - 50, dividerY).lineWidth(1).strokeColor("#3A3A3A").stroke();
      doc.undash();
      doc.restore();

      // === Buyer & Event Details — two-column card ===
      const cardY = dividerY + 24;
      const cardH = 190;
      doc.roundedRect(50, cardY, PAGE_W - 100, cardH, 6).fill(PANEL);
      doc.roundedRect(50, cardY, PAGE_W - 100, cardH, 6).lineWidth(0.5).strokeColor("#2A2A2A").stroke();

      const colLeftX = 74;
      const colRightX = PAGE_W / 2 + 20;

      const leftDetails = [
        { label: "Ticket Holder", value: buyer.fullName },
        { label: "Email", value: buyer.email },
        { label: "Phone Number", value: buyer.phoneNumber },
      ];
      const rightDetails = [
        {
          label: "Date & Time",
          value: `${formatDate(event.startDate)}\n${formatTime(event.startDate)} – ${formatTime(event.endDate)}`,
        },
        { label: "Venue", value: `${event.venue}\n${event.address}` },
      ];

      let ly = cardY + 26;
      leftDetails.forEach((d) => {
        doc.fillColor(MUTED).fontSize(8.5).font("Helvetica").text(d.label.toUpperCase(), colLeftX, ly, { characterSpacing: 0.5 });
        doc.fillColor(TEXT).fontSize(11).font("Helvetica-Bold").text(d.value, colLeftX, ly + 13, { width: 220 });
        ly += 46;
      });

      let ry = cardY + 26;
      rightDetails.forEach((d) => {
        doc.fillColor(MUTED).fontSize(8.5).font("Helvetica").text(d.label.toUpperCase(), colRightX, ry, { characterSpacing: 0.5 });
        doc.fillColor(TEXT).fontSize(11).font("Helvetica-Bold").text(d.value, colRightX, ry + 13, { width: 210 });
        ry += 62;
      });

      // === Footer ===
      doc.fillColor(MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text(
          "Present this ticket at the entrance. Each QR code is valid for a single admission.",
          60,
          cardY + cardH + 22,
          { width: PAGE_W - 120, align: "center" }
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

      // === Outer frame — matches standard ticket for a cohesive set ===
      doc.rect(24, 24, PAGE_W - 48, PAGE_H - 48).lineWidth(1).strokeColor(GOLD).stroke();
      doc.rect(30, 30, PAGE_W - 60, PAGE_H - 60).lineWidth(0.5).strokeColor("#4A3B10").stroke();

      // === Left accent rail ===
      doc.rect(24, 24, 10, PAGE_H - 48).fill(GOLD);

      // === Top bar with logo + small event title ===
      doc.rect(34, 24, PAGE_W - 58, 70).fill(PANEL);
      doc.image(logoBuffer, 50, 39, { width: 50, height: 40 });
      doc.fillColor(MUTED)
        .fontSize(10)
        .font("Helvetica")
        .text(event.eventTitle, 118, 46, { width: 420, characterSpacing: 0.5 });
      doc.fillColor(GOLD)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(event.eventTheme, 118, 60, { width: 420 });

      // === GROUP badge (top right ribbon) ===
      doc.roundedRect(452, 42, 100, 24, 3).fill(GOLD_DEEP);
      doc.fillColor(DARK)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("GROUP PASS", 452, 49, { width: 100, align: "center", characterSpacing: 0.5 });

      // === Hero block: ticket holder name, large and centered ===
      doc.fillColor(MUTED)
        .fontSize(10)
        .font("Helvetica")
        .text("TICKET HOLDER", 0, 128, { align: "center", width: PAGE_W, characterSpacing: 1.5 });

      doc.fillColor(TEXT)
        .fontSize(32)
        .font("Helvetica-Bold")
        .text(buyer.fullName, 40, 148, {
          align: "center",
          width: PAGE_W - 80,
        });

      // Thin gold rule under the name
      const nameHeight = doc.heightOfString(buyer.fullName, {
        width: PAGE_W - 80,
        align: "center",
      });
      const ruleY = 148 + nameHeight + 14;
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
      doc.rect(34, footerY, PAGE_W - 68, 40).fill(GOLD_DEEP);
      doc.fillColor(DARK)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(
          "GROUP ENTRY  ·  Present this ticket at the entrance. Each QR code is valid for a single admission.",
          50,
          footerY + 14,
          { width: PAGE_W - 100, align: "center", characterSpacing: 0.25 }
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
  <div style="font-family: Georgia, 'Times New Roman', serif; background:#0A0A0A; padding:48px 20px;">
    <div style="max-width:560px; margin:auto; background:#141414; border:1px solid #2A2A2A; border-radius:4px; overflow:hidden;">

      <!-- Top gold rule -->
      <div style="height:3px; background:#CCA33A;"></div>

      <div style="padding:40px 40px 32px;">

        <!-- Logo -->
        <div style="text-align:center; margin-bottom:28px;">
          <img src="${logoUrl}" alt="Logo" style="height:46px;" />
        </div>

        <!-- Confirmation mark -->
        <div style="text-align:center; margin-bottom:28px;">
          <div style="display:inline-block;width:56px;height:56px;border:1px solid #CCA33A;border-radius:50%;line-height:56px">
            <span style="color:#CCA33A;font-size:24px;font-family:Georgia,serif;">&#10003;</span>
          </div>
          <h1 style="margin:16px 0 0; font-size:22px; font-weight:400; letter-spacing:1px; color:#F9F7F4; text-transform:uppercase;">Booking Confirmed</h1>
          ${isGroupTicket ? `<p style="margin:10px 0 0; display:inline-block; border:1px solid #CCA33A; color:#CCA33A; font-size:10px; font-weight:600; padding:5px 14px; border-radius:2px; letter-spacing:1.5px; font-family:Arial,sans-serif;">GROUP PASS</p>` : ""}
        </div>

        <!-- Divider -->
        <div style="width:40px; height:1px; background:#CCA33A; margin:0 auto 28px;"></div>

        <!-- Greeting -->
        <p style="margin:0 0 14px; color:#F9F7F4; font-size:15px; font-family:Arial,sans-serif;">Dear ${buyer.fullName},</p>
        <p style="margin:0 0 24px; color:#b3b3b3; font-size:14px; line-height:1.7; font-family:Arial,sans-serif;">
          We are pleased to confirm your place at <span style="color:#CCA33A;">${event.eventTheme}</span>. A summary of your booking is set out below.
        </p>

        <!-- Event Info Box -->
        <table style="width:100%; border-collapse:collapse; border:1px solid #2A2A2A; margin-bottom:24px; font-family:Arial,sans-serif;">
          <tr>
            <td style="padding:18px 20px; border-bottom:1px solid #2A2A2A;">
              <p style="margin:0 0 3px; color:#7A7A7A; font-size:10px; letter-spacing:1px; text-transform:uppercase;">Event</p>
              <p style="margin:0; color:#F9F7F4; font-size:15px;">${event.eventTitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 20px; border-bottom:1px solid #2A2A2A;">
              <p style="margin:0 0 3px; color:#7A7A7A; font-size:10px; letter-spacing:1px; text-transform:uppercase;">Venue</p>
              <p style="margin:0; color:#F9F7F4; font-size:14px;">${event.venue}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 20px; border-bottom:1px solid #2A2A2A;">
              <p style="margin:0 0 3px; color:#7A7A7A; font-size:10px; letter-spacing:1px; text-transform:uppercase;">Date &amp; Time</p>
              <p style="margin:0; color:#F9F7F4; font-size:14px;">${formatDate(event.startDate)} &nbsp;·&nbsp; ${formatTime(event.startDate)} – ${formatTime(event.endDate)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0 0 3px; color:#7A7A7A; font-size:10px; letter-spacing:1px; text-transform:uppercase;">Admission</p>
              <p style="margin:0; color:#F9F7F4; font-size:14px;">${ticket.ticketName} &nbsp;·&nbsp; Ticket ID ${buyer.ticketId}</p>
            </td>
          </tr>
        </table>

        <!-- PDF Reminder -->
        <p style="margin:0 0 24px; color:#b3b3b3; font-size:13px; line-height:1.7; font-family:Arial,sans-serif;">
          Your ticket is enclosed as a PDF. Please keep it accessible on your phone, or printed, to present at the entrance.
        </p>

        <!-- Quick Reminders -->
        <div style="border:1px solid #3A2E10; background:#1A1509; padding:20px 22px; margin-bottom:28px; font-family:Arial,sans-serif;">
          <p style="margin:0 0 10px; color:#CCA33A; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Please Note</p>
          <ul style="margin:0; padding-left:18px; color:#b3b3b3; font-size:13px; line-height:1.8;">
            <li>Each QR code is valid for a single entry</li>
            <li>Please arrive early to avoid queues at the door</li>
            <li>Bring valid ID matching the name on the ticket</li>
          </ul>
        </div>

        <!-- Footer -->
        <div style="text-align:center; padding-top:24px; border-top:1px solid #2A2A2A; font-family:Arial,sans-serif;">
          <p style="margin:0 0 8px; color:#7A7A7A; font-size:12px;">
            Questions? Write to <a href="mailto:support@decavemgt.com" style="color:#CCA33A; text-decoration:none;">support@decavemgt.com</a>
          </p>
          <p style="margin:0; color:#555; font-size:11px; letter-spacing:0.5px;">&copy; ${new Date().getFullYear()} DECAVE — All Rights Reserved</p>
        </div>

      </div>

      <!-- Bottom gold rule -->
      <div style="height:3px; background:#CCA33A;"></div>
    </div>
  </div>
  `;
};