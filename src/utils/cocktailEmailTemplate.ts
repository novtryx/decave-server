import PDFDocument from "pdfkit";

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const logo2 = async (): Promise<Buffer> => {
  const response = await fetch("https://api.decavemgt.com/decave-logo.png");
  if (!response.ok) {
    throw new Error("Failed to fetch logo");
  }
  return Buffer.from(await response.arrayBuffer());
};

interface CocktailOrderItem {
  name: string;
  quantity: number;
  redeemedQuantity: number;
  discountedUnitPrice: number;
}

interface CocktailPDFData {
  buyerName: string;
  buyerEmail: string;
  eventTitle: string;
  eventDate: string;
  txnId: string;
  qrCode: string; // data URL
  items: CocktailOrderItem[];
  totalAmount: number;
}

const DARK = "#0A0A0A";
const GOLD = "#BA8703";
const TEXT = "#F9F7F4";
const MUTED = "#b3b3b3";

/**
 * A single-page PDF summarizing a buyer's cocktail add-on order —
 * separate from their ticket PDF. Shows what was ordered and a QR
 * code bar staff scan to redeem drinks (supports partial redemption,
 * so this same QR gets scanned again for subsequent rounds).
 */
export const generateCocktailPDF = async (data: CocktailPDFData): Promise<Buffer> => {
  const logoBuffer = await logo2();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 0 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const PAGE_W = 612;
      const PAGE_H = 792;
      const PANEL = "#141414";

      // Background
      doc.rect(0, 0, PAGE_W, PAGE_H).fill(DARK);

      // Outer frame — matches ticket set for a cohesive look
      doc.rect(24, 24, PAGE_W - 48, PAGE_H - 48).lineWidth(1).strokeColor(GOLD).stroke();
      doc.rect(30, 30, PAGE_W - 60, PAGE_H - 60).lineWidth(0.5).strokeColor("#4A3B10").stroke();

      // Header
      doc.image(logoBuffer, PAGE_W / 2 - 26, 52, { width: 52, height: 36 });

      doc.fillColor(MUTED)
        .fontSize(10)
        .font("Helvetica")
        .text(data.eventTitle.toUpperCase(), 60, 100, {
          align: "center",
          width: PAGE_W - 120,
          characterSpacing: 1.5,
        });

      doc.fillColor(GOLD)
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("Cocktail Order", 60, 118, {
          align: "center",
          width: PAGE_W - 120,
        });

      doc.moveTo(PAGE_W / 2 - 50, 156).lineTo(PAGE_W / 2 + 50, 156)
        .lineWidth(1).strokeColor(GOLD).stroke();

      // Buyer info
      doc.fillColor(TEXT)
        .fontSize(11)
        .font("Helvetica")
        .text(`${data.buyerName}  ·  ${formatDate(data.eventDate)}`, 60, 168, {
          align: "center",
          width: PAGE_W - 120,
        });
      doc.fillColor(MUTED)
        .fontSize(9)
        .text(`Order Ref. ${data.txnId}`, 60, 184, {
          align: "center",
          width: PAGE_W - 120,
        });

      // QR code panel — scanned at the bar to redeem
      const qrY = 205;
      doc.roundedRect(PAGE_W / 2 - 105, qrY, 210, 210, 6).fill(PANEL);
      doc.roundedRect(PAGE_W / 2 - 105, qrY, 210, 210, 6).lineWidth(0.75).strokeColor(GOLD).stroke();
      doc.image(data.qrCode, PAGE_W / 2 - 90, qrY + 15, { width: 180, height: 180 });

      doc.fillColor(MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text("Present this QR at the bar to redeem your drinks", 60, qrY + 224, {
          width: PAGE_W - 120,
          align: "center",
        });

      // Perforation-style divider
      const dividerY = qrY + 250;
      doc.save();
      doc.dash(3, { space: 4 });
      doc.moveTo(50, dividerY).lineTo(PAGE_W - 50, dividerY).lineWidth(1).strokeColor("#3A3A3A").stroke();
      doc.undash();
      doc.restore();

      // Order breakdown card
      const cardY = dividerY + 20;
      const rowH = 24;
      const cardH = 46 + data.items.length * rowH;
      doc.roundedRect(50, cardY, PAGE_W - 100, cardH, 6).fill(PANEL);
      doc.roundedRect(50, cardY, PAGE_W - 100, cardH, 6).lineWidth(0.5).strokeColor("#2A2A2A").stroke();

      doc.fillColor(GOLD)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("YOUR ORDER", 70, cardY + 18, { characterSpacing: 1 });

      let yPos = cardY + 40;
      data.items.forEach((item) => {
        doc
          .fillColor(TEXT)
          .fontSize(11)
          .font("Helvetica")
          .text(`${item.name} × ${item.quantity}`, 70, yPos, { width: 260 });
        doc
          .fillColor(MUTED)
          .fontSize(9.5)
          .text(
            `₦${(item.discountedUnitPrice * item.quantity).toLocaleString()}  ·  ${item.redeemedQuantity}/${item.quantity} redeemed`,
            320,
            yPos,
            { width: 222, align: "right" }
          );
        yPos += rowH;
      });

      // Total
      const totalY = cardY + cardH + 20;
      doc.moveTo(50, totalY).lineTo(PAGE_W - 50, totalY).lineWidth(0.5).strokeColor("#2A2A2A").stroke();
      doc
        .fillColor(GOLD)
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(`Total Paid: ₦${data.totalAmount.toLocaleString()}`, 50, totalY + 14, {
          width: PAGE_W - 100,
          align: "center",
        });

      doc
        .fillColor(MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text(
          "This QR may be scanned in multiple rounds — it tracks how many drinks you have left to redeem.",
          60,
          totalY + 44,
          { width: PAGE_W - 120, align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export const cocktailEmailTemplate = (data: {
  buyerName: string;
  eventTitle: string;
  items: CocktailOrderItem[];
  totalAmount: number;
}): string => {
  const rows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #2A2A2A;color:#F9F7F4;font-size:13px;">${item.name} × ${item.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #2A2A2A;color:#b3b3b3;font-size:13px;text-align:right;">₦${(item.discountedUnitPrice * item.quantity).toLocaleString()}</td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; background:#0A0A0A; padding:48px 20px;">
    <div style="max-width:520px; margin:auto; background:#141414; border:1px solid #2A2A2A; border-radius:4px; overflow:hidden;">

      <div style="height:3px; background:#BA8703;"></div>

      <div style="padding:36px 40px 32px;">

        <div style="text-align:center; margin-bottom:24px;">
          <p style="margin:0 0 6px; color:#7A7A7A; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; font-family:Arial,sans-serif;">${data.eventTitle}</p>
          <h1 style="margin:0; font-size:22px; font-weight:400; letter-spacing:1px; color:#F9F7F4; text-transform:uppercase;">Cocktail Order</h1>
        </div>

        <div style="width:40px; height:1px; background:#BA8703; margin:0 auto 24px;"></div>

        <p style="margin:0 0 14px; color:#F9F7F4; font-size:15px; font-family:Arial,sans-serif;">Dear ${data.buyerName},</p>
        <p style="margin:0 0 24px; color:#b3b3b3; font-size:14px; line-height:1.7; font-family:Arial,sans-serif;">
          Thank you for adding drinks to your order. Your redemption code is enclosed as a PDF — present it at the bar. It may be scanned across multiple rounds if you'd rather not collect everything at once.
        </p>

        <table style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif; margin-bottom:8px;">
          ${rows}
        </table>

        <div style="text-align:center; padding-top:16px;">
          <p style="margin:0; color:#BA8703; font-size:17px; font-weight:600; font-family:Arial,sans-serif;">
            Total Paid: ₦${data.totalAmount.toLocaleString()}
          </p>
        </div>

        <div style="text-align:center; padding-top:28px; margin-top:24px; border-top:1px solid #2A2A2A;">
          <p style="margin:0; color:#555; font-size:11px; font-family:Arial,sans-serif; letter-spacing:0.5px;">&copy; ${new Date().getFullYear()} DECAVE — All Rights Reserved</p>
        </div>

      </div>

      <div style="height:3px; background:#BA8703;"></div>
    </div>
  </div>`;
};