export const newsletterTemplate = (
  logoUrl: string,
  body: string
) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>deCave Newsletter</title>

  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      background-color: #f3f4f6;
    }

    table {
      border-spacing: 0;
      border-collapse: collapse;
    }

    img {
      border: 0;
      display: block;
      max-width: 100%;
    }

    a {
      color: inherit;
    }

    @media only screen and (max-width: 620px) {
      .email-wrapper {
        padding: 20px 10px !important;
      }

      .email-container {
        width: 100% !important;
        border-radius: 8px !important;
      }

      .email-header {
        padding: 24px 20px !important;
      }

      .email-footer {
        padding: 24px 20px !important;
      }

      .email-content {
        padding: 0 !important;
      }
    }
  </style>
</head>

<body>

  <!-- Preheader -->
  <div
    style="
      display:none;
      max-height:0;
      overflow:hidden;
      opacity:0;
      color:transparent;
      visibility:hidden;
    "
  >
    Latest updates and important announcements from deCave Management.
  </div>

  <!-- Outer wrapper -->
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="width:100%; background-color:#f3f4f6;"
  >
    <tr>
      <td
        align="center"
        class="email-wrapper"
        style="padding:40px 20px;"
      >

        <!-- Email container -->
        <table
          role="presentation"
          width="600"
          cellpadding="0"
          cellspacing="0"
          border="0"
          class="email-container"
          style="
            width:600px;
            max-width:600px;
            background-color:#ffffff;
            border-radius:10px;
            overflow:hidden;
            box-shadow:0 4px 12px rgba(0,0,0,0.05);
          "
        >

          <!-- Header -->
          <tr>
            <td
              align="center"
              class="email-header"
              style="
                background-color:#111827;
                padding:30px;
              "
            >
              <img
                src="${logoUrl}"
                alt="deCave Management"
                style="
                  height:45px;
                  width:auto;
                  margin:0 auto;
                "
              />
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td
              class="email-content"
              style="padding:0;"
            >
              ${body}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 30px;">
              <div
                style="
                  border-top:1px solid #e5e7eb;
                  height:1px;
                  line-height:1px;
                  font-size:1px;
                "
              >
                &nbsp;
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td
              align="center"
              class="email-footer"
              style="
                padding:25px 30px;
                font-family:Arial, Helvetica, sans-serif;
                font-size:12px;
                line-height:1.6;
                color:#9ca3af;
              "
            >

              <p style="margin:0 0 10px 0;">
                You’re receiving this email because you subscribed to
                updates from deCave Management.
              </p>

              <p style="margin:0;">
                deCave Mgt © ${new Date().getFullYear()}
                All rights reserved.
              </p>

              <p style="margin:10px 0 0 0;">
                <a
                  href="https://decavemgt.com/unsubscribe"
                  style="
                    color:#6b7280;
                    text-decoration:underline;
                  "
                >
                  Unsubscribe
                </a>
              </p>

            </td>
          </tr>

        </table>

        <!-- Bottom tagline -->
        <div
          style="
            text-align:center;
            margin-top:20px;
            font-family:Arial, Helvetica, sans-serif;
            font-size:11px;
            color:#9ca3af;
          "
        >
          Where culture meets experience.
        </div>

      </td>
    </tr>
  </table>

</body>
</html>
`;
};