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
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // Background
      doc.rect(0, 0, 612, 792).fill(DARK);

      // Header band
      doc.rect(50, 50, 512, 80).fill(GOLD);
      doc.image(logoBuffer, 56, 55, { width: 60, height: 40 });
      doc.fillColor(TEXT).fontSize(20).font("Helvetica-Bold").text("Cocktail Order", 130, 65);
      doc.fillColor(DARK).fontSize(12).font("Helvetica").text(data.eventTitle, 130, 92);

      // Buyer info
      doc.fillColor(TEXT).fontSize(14).font("Helvetica-Bold").text(data.buyerName, 50, 155);
      doc.fillColor(MUTED).fontSize(10).font("Helvetica").text(data.buyerEmail, 50, 175);
      doc.fillColor(MUTED).fontSize(10).text(formatDate(data.eventDate), 50, 190);
      doc.fillColor(MUTED).fontSize(9).text(`Order Ref: ${data.txnId}`, 50, 205);

      // QR code — scanned at the bar to redeem
      doc.image(data.qrCode, 206, 235, { width: 200, height: 200 });
      doc
        .fillColor(MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text("Present this QR at the bar to redeem your drinks", 50, 445, {
          width: 512,
          align: "center",
        });

      // Order breakdown
      let yPos = 480;
      doc.fillColor(TEXT).fontSize(12).font("Helvetica-Bold").text("Your Order", 50, yPos);
      yPos += 25;

      data.items.forEach((item) => {
        doc
          .fillColor(TEXT)
          .fontSize(11)
          .font("Helvetica")
          .text(`${item.name} × ${item.quantity}`, 50, yPos);
        doc
          .fillColor(MUTED)
          .fontSize(10)
          .text(
            `₦${(item.discountedUnitPrice * item.quantity).toLocaleString()}  ·  ${item.redeemedQuantity}/${item.quantity} redeemed`,
            300,
            yPos,
            { width: 250, align: "right" }
          );
        yPos += 22;
      });

      yPos += 10;
      doc
        .moveTo(50, yPos)
        .lineTo(562, yPos)
        .strokeColor("#333333")
        .stroke();
      yPos += 15;

      doc
        .fillColor(GOLD)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text(`Total Paid: ₦${data.totalAmount.toLocaleString()}`, 50, yPos);

      doc
        .fillColor("#666666")
        .fontSize(9)
        .font("Helvetica")
        .text(
          "This QR can be scanned multiple times if you're collecting your drinks in rounds — it tracks how much you have left.",
          50,
          740,
          { width: 512, align: "center" }
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
        <td style="padding:8px 0;color:#F9F7F4;">${item.name} × ${item.quantity}</td>
        <td style="padding:8px 0;color:#b3b3b3;text-align:right;">₦${(item.discountedUnitPrice * item.quantity).toLocaleString()}</td>
      </tr>`
    )
    .join("");

  return `
  <div style="background:#0A0A0A;padding:40px 20px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#111111;border-radius:12px;overflow:hidden;">
      <div style="background:#BA8703;padding:24px;">
        <h1 style="color:#F9F7F4;font-size:20px;margin:0;">🍸 Your Cocktail Order</h1>
        <p style="color:#0A0A0A;margin:4px 0 0;">${data.eventTitle}</p>
      </div>
      <div style="padding:24px;">
        <p style="color:#F9F7F4;">Hi ${data.buyerName},</p>
        <p style="color:#b3b3b3;font-size:14px;">
          Thanks for adding drinks to your order! Your cocktail QR code is attached as a PDF —
          show it at the bar to redeem. You can redeem in multiple rounds if you don't want
          all your drinks at once.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          ${rows}
        </table>
        <div style="border-top:1px solid #2a2a2a;margin-top:12px;padding-top:12px;">
          <p style="color:#BA8703;font-weight:bold;font-size:16px;">
            Total: ₦${data.totalAmount.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  </div>`;
};