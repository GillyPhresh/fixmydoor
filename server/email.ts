import nodemailer from "nodemailer";
import { existsSync } from "fs";
import { resolve } from "path";
import type { Booking, BookingStatus } from "../shared/types";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

const DEFAULT_BUSINESS_EMAIL = "info.fixmydoor@gmail.com";
const DEFAULT_PUBLIC_SITE_URL = "https://fixmydoorservices.up.railway.app";
const LOGO_CID = "fixmydoor-logo";
const EMAIL_LOGO_CARD_STYLE = "background:#ffffff; background-color:#ffffff; border:1px solid #ead8bf; border-radius:22px; padding:14px 22px; margin:0 auto 14px; box-shadow:0 14px 32px rgba(0,0,0,0.16);";
const EMAIL_LOGO_IMG_STYLE = "display:block; width:220px; max-width:100%; height:auto; margin:0 auto;";

function normalizeEnvValue(value?: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return "";
  }

  const quote = trimmed[0];
  if ((quote === `"` || quote === `'`) && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function normalizeSmtpPassword(value: string, host: string) {
  return /gmail|googlemail/i.test(host) ? value.replace(/\s+/g, "") : value;
}

function getBusinessEmail() {
  return normalizeEnvValue(process.env.BUSINESS_EMAIL) || normalizeEnvValue(process.env.ADMIN_EMAIL) || DEFAULT_BUSINESS_EMAIL;
}

function normalizePublicUrl(value?: string) {
  const rawValue = normalizeEnvValue(value);
  if (!rawValue) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;

  try {
    const url = new URL(withProtocol);
    const hostname = url.hostname.toLowerCase();
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1";

    if (process.env.NODE_ENV === "production" && isLocalHost) {
      return "";
    }

    return url.origin.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function getRailwayPublicBaseUrl() {
  const railwayDomain = normalizeEnvValue(process.env.RAILWAY_PUBLIC_DOMAIN);
  return railwayDomain ? normalizePublicUrl(railwayDomain) : "";
}

function getPublicBaseUrl() {
  const adminRoot = normalizeEnvValue(process.env.ADMIN_URL).replace(/\/admin\/?$/, "");
  return (
    normalizePublicUrl(process.env.PUBLIC_SITE_URL) ||
    normalizePublicUrl(process.env.VITE_PUBLIC_SITE_URL) ||
    normalizePublicUrl(adminRoot) ||
    getRailwayPublicBaseUrl() ||
    (process.env.NODE_ENV === "production" ? DEFAULT_PUBLIC_SITE_URL : "http://localhost:3000")
  ).replace(/\/+$/, "");
}

function getAdminDashboardUrl() {
  const configuredAdminUrl = normalizePublicUrl(process.env.ADMIN_URL);

  if (configuredAdminUrl) {
    return `${configuredAdminUrl.replace(/\/admin\/?$/, "")}/admin`;
  }

  return `${getPublicBaseUrl()}/admin`;
}

function getBookingMapQuery(booking: Booking) {
  return [booking.address, booking.city, booking.country].filter(Boolean).join(", ");
}

function getGoogleMapsUrl(booking: Booking) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getBookingMapQuery(booking))}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanSubjectValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function displayValue(value?: string | null, fallback = "Not specified") {
  return value ? escapeHtml(value) : fallback;
}

function getLogoAttachment() {
  const candidates = [
    resolve(process.cwd(), "client/public/img5150-transparent.png"),
    resolve(process.cwd(), "client/public/fixmydoor-logo-transparent.png"),
    resolve(process.cwd(), "dist/public/img5150-transparent.png"),
    resolve(process.cwd(), "dist/public/fixmydoor-logo-transparent.png"),
  ];
  const logoPath = candidates.find((candidate) => existsSync(candidate));

  return logoPath
    ? {
        filename: "fixmydoor-logo.png",
        path: logoPath,
        cid: LOGO_CID,
      }
    : undefined;
}

function renderEmailLogo(logoAttachment: ReturnType<typeof getLogoAttachment>, options: { marginBottom?: string; textSize?: string } = {}) {
  const marginBottom = options.marginBottom ?? "14px";
  const textSize = options.textSize ?? "30px";
  const content = logoAttachment
    ? `<img src="cid:${LOGO_CID}" alt="FixMyDoor" width="220" style="${EMAIL_LOGO_IMG_STYLE} background:#ffffff; background-color:#ffffff;" />`
    : `<span style="display:block; color:#6B4423; font-size:${textSize}; font-weight:800; line-height:1.1;">FixMyDoor</span>`;

  return `
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="${EMAIL_LOGO_CARD_STYLE} margin-bottom:${marginBottom};">
      <tr>
        <td align="center" bgcolor="#ffffff" style="background:#ffffff; background-color:#ffffff; border-radius:22px;">
          ${content}
        </td>
      </tr>
    </table>
  `;
}

function formatSubmittedAt(value: string) {
  const submittedAt = new Date(value);
  return Number.isNaN(submittedAt.getTime()) ? escapeHtml(value) : submittedAt.toLocaleString();
}

function formatOptionalRow(label: string, value?: string | null) {
  return value ? `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>` : "";
}

async function sendMailWithRetry(transporter: any, options: Record<string, unknown>, label: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await transporter.sendMail(options);
      if (attempt > 1) {
        console.log(`${label} email sent after retry`);
      }
      return true;
    } catch (error) {
      lastError = error;
      console.error(`${label} email attempt ${attempt} failed:`, error);
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
  }

  console.error(`${label} email failed after retry:`, lastError);
  return false;
}

function getPhotoAttachments(booking: Booking) {
  return (booking.photos || [])
    .map((photo, index) => {
      const match = photo.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
      if (!match) {
        return null;
      }

      const extension = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg";
      return {
        filename: `booking-photo-${index + 1}.${extension}`,
        content: Buffer.from(match[2], "base64"),
        contentType: match[1],
      };
    })
    .filter(Boolean);
}

function statusMessage(status: BookingStatus) {
  switch (status) {
    case "CONFIRMED":
      return "Your request has been confirmed. We will follow the appointment details shared with you.";
    case "IN_PROGRESS":
      return "Your request is now in progress.";
    case "COMPLETED":
      return "Your request has been marked as completed. Thank you for trusting FixMyDoor.";
    case "CANCELLED":
      return "Your request has been cancelled. Contact us if you need to reopen it.";
    default:
      return "Your request is still pending. Our staff will contact you soon.";
  }
}

class EmailService {
  private transporter: any | null = null;
  private config: EmailConfig | null = null;

  initialize() {
    const host = normalizeEnvValue(process.env.SMTP_HOST);
    const port = parseInt(normalizeEnvValue(process.env.SMTP_PORT) || "587", 10);
    const user = normalizeEnvValue(process.env.SMTP_USER);
    const pass = normalizeSmtpPassword(normalizeEnvValue(process.env.SMTP_PASS), host);
    const from = normalizeEnvValue(process.env.FROM_EMAIL) || `FixMyDoor <${getBusinessEmail()}>`;

    if (!host || !user || !pass) {
      console.warn("Email service not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS to enable email notifications.");
      return false;
    }

    this.config = {
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      from,
    };

    this.transporter = nodemailer.createTransport(this.config);
    this.transporter.verify().then(
      () => console.log("Email service verified and ready."),
      (error: unknown) => console.error("Email service verification failed:", error),
    );
    return true;
  }

  async sendBookingConfirmation(booking: Booking) {
    if (!this.transporter || !this.config) {
      console.warn("Email service not initialized");
      return false;
    }

    const businessEmail = getBusinessEmail();
    const subject = "FixMyDoor - Booking Confirmation";
    const logoAttachment = getLogoAttachment();
    const trackingUrl = booking.customerToken ? `${getPublicBaseUrl()}/track/${booking.customerToken}` : "";
    const logoHtml = renderEmailLogo(logoAttachment);
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background:#fffaf2; border:1px solid #ead8bf; border-radius:22px; overflow:hidden;">
        <div style="background:#2f241c; padding:24px 24px 20px; text-align:center;">
          ${logoHtml}
          <p style="margin:0; color:#f7efe4; font-size:13px; letter-spacing:1.5px; text-transform:uppercase;">Door & Furniture Repair Services</p>
        </div>

        <div style="padding:28px;">
        <h1 style="color:#6B4423; margin:0 0 14px;">We received your request</h1>
        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Hi ${escapeHtml(booking.name)},</p>
        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Thanks for contacting FixMyDoor. Your request is now in our system, and our staff will contact you soon to confirm the details.</p>

        <div style="background:#F5F1E8; padding:20px; border-radius:16px; margin:22px 0; color:#3a281f;">
          <h3 style="margin-top:0; color:#6B4423;">Your request details</h3>
          <p><strong>Booking ID:</strong> ${escapeHtml(booking.id)}</p>
          <p><strong>Request:</strong> ${escapeHtml(booking.repairType)}</p>
          <p><strong>Address:</strong> ${escapeHtml(booking.address)}</p>
          ${formatOptionalRow("City / Province", booking.city)}
          ${formatOptionalRow("Country", booking.country)}
          ${formatOptionalRow("Time Zone", booking.timeZone)}
          ${formatOptionalRow("Preferred Contact", booking.preferredContactMethod)}
          ${formatOptionalRow("Urgency", booking.urgency)}
          ${formatOptionalRow("Request Type", booking.requestScope)}
          ${formatOptionalRow("Currency", booking.currency)}
          <p><strong>Phone:</strong> ${escapeHtml(booking.phone)}</p>
          <p><strong>Preferred Date:</strong> ${displayValue(booking.preferredDate, "To be scheduled")}</p>
          ${formatOptionalRow("Size / Measurements", booking.dimensions)}
          ${formatOptionalRow("Quantity", booking.quantity)}
          ${formatOptionalRow("Material", booking.material)}
          ${formatOptionalRow("Color / Finish", booking.color)}
          ${formatOptionalRow("Swing Direction", booking.swingDirection)}
          ${formatOptionalRow("Delivery Needed", booking.deliveryNeeded)}
          ${formatOptionalRow("Installation Needed", booking.installationNeeded)}
          ${formatOptionalRow("Budget", booking.budget)}
          ${booking.message ? `<p><strong>Message:</strong> ${escapeHtml(booking.message)}</p>` : ""}
          ${booking.photos?.length ? `<p><strong>Photos:</strong> ${booking.photos.length} image(s) received</p>` : ""}
          <p><strong>Status:</strong> ${booking.status}</p>
        </div>

        ${trackingUrl ? `<p style="font-size:16px; line-height:1.6; color:#3a281f;">You can check your request status here:</p>
        <p><a href="${escapeHtml(trackingUrl)}" style="display:inline-block; background:#b46532; color:#ffffff; padding:12px 18px; border-radius:12px; text-decoration:none; font-weight:700;">Track Your Request</a></p>` : ""}

        <p style="font-size:16px; line-height:1.6; color:#3a281f;">You can reach us here if you need to add anything:</p>
        <p style="font-size:15px; color:#3a281f;"><strong>Phone:</strong> +1 (438) 347-1823</p>
        <p style="font-size:15px; color:#3a281f;"><strong>Email:</strong> <a href="mailto:${escapeHtml(businessEmail)}" style="color:#b46532;">${escapeHtml(businessEmail)}</a></p>

        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Thank you for trusting FixMyDoor with your repair needs.</p>
        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Best regards,<br><strong>FixMyDoor Services</strong></p>
        </div>
      </div>
    `;

    try {
      const text = [
        `Hi ${booking.name},`,
        "",
        "Thanks for contacting FixMyDoor. Your request is now in our system, and our staff will contact you soon to confirm the details.",
        "",
        `Booking ID: ${booking.id}`,
        `Request: ${booking.repairType}`,
        `Address: ${booking.address}`,
        `City / Province: ${booking.city || "Not specified"}`,
        `Country: ${booking.country || "Not specified"}`,
        `Phone: ${booking.phone}`,
        `Preferred Date: ${booking.preferredDate || "To be scheduled"}`,
        `Message: ${booking.message || "None"}`,
        trackingUrl ? `Track your request: ${trackingUrl}` : "",
        "",
        "Phone: +1 (438) 347-1823",
        `Email: ${businessEmail}`,
        "",
        "Best regards,",
        "FixMyDoor Services",
      ].filter(Boolean).join("\n");

      const sent = await sendMailWithRetry(this.transporter, {
        from: this.config.from,
        to: booking.email,
        replyTo: businessEmail,
        subject,
        text,
        html,
        attachments: logoAttachment ? [logoAttachment] : undefined,
      }, "Customer booking confirmation");
      if (!sent) {
        return false;
      }
      console.log(`Booking confirmation email sent to ${booking.email}`);
      return true;
    } catch (error) {
      console.error("Failed to send booking confirmation email:", error);
      return false;
    }
  }

  async sendAdminNotification(booking: Booking) {
    if (!this.transporter || !this.config) {
      console.warn("Email service not initialized");
      return false;
    }

    const businessEmail = getBusinessEmail();
    const adminEmail = normalizeEnvValue(process.env.ADMIN_EMAIL) || businessEmail || this.config.auth.user;
    const adminUrl = getAdminDashboardUrl();
    const mapQuery = getBookingMapQuery(booking);
    const mapsUrl = getGoogleMapsUrl(booking);
    const photoAttachments = getPhotoAttachments(booking);
    const logoAttachment = getLogoAttachment();
    const logoHtml = `<div style="text-align:center; background:#2f241c; padding:24px; border-radius:18px 18px 0 0;">${renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px" })}</div>`;
    const subject = `New FixMyDoor Booking: ${cleanSubjectValue(booking.name)} - ${cleanSubjectValue(booking.repairType)}`;
    const text = [
      "New FixMyDoor booking received",
      "",
      `Booking ID: ${booking.id}`,
      `Name: ${booking.name}`,
      `Phone: ${booking.phone}`,
      `Email: ${booking.email}`,
      `Address: ${booking.address}`,
      `City / Province: ${booking.city || "Not specified"}`,
      `Country: ${booking.country || "Not specified"}`,
      `Time Zone: ${booking.timeZone || "Not specified"}`,
      `Preferred Contact: ${booking.preferredContactMethod || "Not specified"}`,
      `Urgency: ${booking.urgency || "Not specified"}`,
      `Request Type: ${booking.requestScope || "Not specified"}`,
      `Currency: ${booking.currency || "Not specified"}`,
      `Map Search: ${mapQuery}`,
      `Google Maps: ${mapsUrl}`,
      `Service: ${booking.repairType}`,
      `Preferred Date: ${booking.preferredDate || "Not specified"}`,
      `Size / Measurements: ${booking.dimensions || "Not specified"}`,
      `Quantity: ${booking.quantity || "Not specified"}`,
      `Material: ${booking.material || "Not specified"}`,
      `Color / Finish: ${booking.color || "Not specified"}`,
      `Swing Direction: ${booking.swingDirection || "Not specified"}`,
      `Delivery Needed: ${booking.deliveryNeeded || "Not specified"}`,
      `Installation Needed: ${booking.installationNeeded || "Not specified"}`,
      `Budget: ${booking.budget || "Not specified"}`,
      `Photos: ${booking.photos?.length || 0}`,
      `Message: ${booking.message || "None"}`,
      `Status: ${booking.status}`,
      `Submitted: ${formatSubmittedAt(booking.createdAt)}`,
      "",
      `Admin Dashboard: ${adminUrl}`,
    ].join("\n");
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background:#fffaf2; border:1px solid #ead8bf; border-radius:18px; overflow:hidden;">
        ${logoHtml}
        <div style="padding:24px;">
        <h1 style="color: #6B4423; margin-top:0;">New Booking Alert</h1>
        <p>A new booking has been received. Review the details below and follow up with the customer.</p>

        <div style="background: #F5F1E8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Customer Details:</h3>
          <p><strong>Booking ID:</strong> ${escapeHtml(booking.id)}</p>
          <p><strong>Name:</strong> ${escapeHtml(booking.name)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(booking.phone)}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(booking.email)}">${escapeHtml(booking.email)}</a></p>
          <p><strong>Address:</strong> ${escapeHtml(booking.address)}</p>
          ${formatOptionalRow("City / Province", booking.city)}
          ${formatOptionalRow("Country", booking.country)}
          ${formatOptionalRow("Time Zone", booking.timeZone)}
          ${formatOptionalRow("Preferred Contact", booking.preferredContactMethod)}
          ${formatOptionalRow("Urgency", booking.urgency)}
          ${formatOptionalRow("Request Type", booking.requestScope)}
          ${formatOptionalRow("Currency", booking.currency)}
          <p><strong>Map Search:</strong> ${escapeHtml(mapQuery)}</p>
          <p><a href="${escapeHtml(mapsUrl)}" style="display:inline-block; background:#2f241c; color:#ffffff; padding:10px 14px; border-radius:10px; text-decoration:none; font-weight:700;">Open Customer Location in Google Maps</a></p>
          <p><strong>Service:</strong> ${escapeHtml(booking.repairType)}</p>
          <p><strong>Preferred Date:</strong> ${displayValue(booking.preferredDate)}</p>
          ${formatOptionalRow("Size / Measurements", booking.dimensions)}
          ${formatOptionalRow("Quantity", booking.quantity)}
          ${formatOptionalRow("Material", booking.material)}
          ${formatOptionalRow("Color / Finish", booking.color)}
          ${formatOptionalRow("Swing Direction", booking.swingDirection)}
          ${formatOptionalRow("Delivery Needed", booking.deliveryNeeded)}
          ${formatOptionalRow("Installation Needed", booking.installationNeeded)}
          ${formatOptionalRow("Budget", booking.budget)}
          <p><strong>Photos:</strong> ${booking.photos?.length || 0} image(s)${photoAttachments.length ? " attached to this email" : ""}</p>
          ${booking.message ? `<p><strong>Message:</strong> <span style="white-space: pre-wrap;">${escapeHtml(booking.message)}</span></p>` : "<p><strong>Message:</strong> None</p>"}
          <p><strong>Status:</strong> ${booking.status}</p>
          <p><strong>Submitted:</strong> ${formatSubmittedAt(booking.createdAt)}</p>
        </div>

        <p>Please log in to the admin dashboard to manage this booking.</p>
        <p><a href="${escapeHtml(adminUrl)}" style="background: #D97706; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View in Admin Dashboard</a></p>
        </div>
      </div>
    `;

    try {
      const sent = await sendMailWithRetry(this.transporter, {
        from: this.config.from,
        to: adminEmail,
        replyTo: booking.email,
        subject,
        text,
        html,
        attachments: [...(logoAttachment ? [logoAttachment] : []), ...photoAttachments],
      }, "Admin booking notification");
      if (!sent) {
        return false;
      }
      console.log("Admin notification email sent");
      return true;
    } catch (error) {
      console.error("Failed to send admin notification email:", error);
      return false;
    }
  }

  async sendStatusUpdate(booking: Booking) {
    if (!this.transporter || !this.config) {
      console.warn("Email service not initialized");
      return false;
    }

    const businessEmail = getBusinessEmail();
    const trackingUrl = booking.customerToken ? `${getPublicBaseUrl()}/track/${booking.customerToken}` : "";
    const subject = `FixMyDoor request update: ${booking.status.replace("_", " ")}`;
    const logoAttachment = getLogoAttachment();
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background:#fffaf2; border:1px solid #ead8bf; border-radius:20px; overflow:hidden;">
        <div style="background:#2f241c; padding:22px; text-align:center;">
          ${renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px" })}
        </div>
        <div style="padding:26px; color:#3a281f;">
          <h1 style="color:#6B4423; margin-top:0;">Your request status changed</h1>
          <p>Hi ${escapeHtml(booking.name)},</p>
          <p>${escapeHtml(statusMessage(booking.status))}</p>
          <div style="background:#F5F1E8; padding:18px; border-radius:14px; margin:20px 0;">
            <p><strong>Booking ID:</strong> ${escapeHtml(booking.id)}</p>
            <p><strong>Current Status:</strong> ${escapeHtml(booking.status.replace("_", " "))}</p>
            ${formatOptionalRow("Appointment Time", booking.appointmentTime)}
            ${formatOptionalRow("Quote Amount", booking.quoteAmount)}
            ${formatOptionalRow("Invoice Status", booking.invoiceStatus)}
            ${formatOptionalRow("Payment Status", booking.paymentStatus)}
            ${formatOptionalRow("Staff Assigned", booking.staffAssigned)}
          </div>
          ${trackingUrl ? `<p><a href="${escapeHtml(trackingUrl)}" style="display:inline-block; background:#b46532; color:#ffffff; padding:12px 18px; border-radius:12px; text-decoration:none; font-weight:700;">View Request Status</a></p>` : ""}
          <p>You can reach us at <a href="mailto:${escapeHtml(businessEmail)}" style="color:#b46532;">${escapeHtml(businessEmail)}</a> or +1 (438) 347-1823.</p>
          <p>Best regards,<br><strong>FixMyDoor Services</strong></p>
        </div>
      </div>
    `;

    try {
      const sent = await sendMailWithRetry(this.transporter, {
        from: this.config.from,
        to: booking.email,
        replyTo: businessEmail,
        subject,
        html,
        attachments: logoAttachment ? [logoAttachment] : undefined,
      }, "Status update");
      if (!sent) {
        return false;
      }
      console.log(`Status update email sent to ${booking.email}`);
      return true;
    } catch (error) {
      console.error("Failed to send status update email:", error);
      return false;
    }
  }

  async sendTestEmail(to = getBusinessEmail()) {
    if (!this.transporter || !this.config) {
      console.warn("Email service not initialized");
      return false;
    }

    const logoAttachment = getLogoAttachment();
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fffaf2;border:1px solid #ead8bf;border-radius:20px;overflow:hidden;">
        <div style="background:#2f241c;padding:22px;text-align:center;">
          ${
            renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px" })
          }
        </div>
        <div style="padding:24px;color:#3a281f;">
          <h1 style="color:#6B4423;margin-top:0;">FixMyDoor email test</h1>
          <p>This confirms the website can send emails through the configured SMTP account.</p>
          <p>If you received this message, booking emails should also deliver to customers and admin.</p>
        </div>
      </div>
    `;

    try {
      const sent = await sendMailWithRetry(this.transporter, {
        from: this.config.from,
        to,
        replyTo: getBusinessEmail(),
        subject: "FixMyDoor email test",
        html,
        attachments: logoAttachment ? [logoAttachment] : undefined,
      }, "Test");
      if (!sent) {
        return false;
      }
      console.log(`Test email sent to ${to}`);
      return true;
    } catch (error) {
      console.error("Failed to send test email:", error);
      return false;
    }
  }
}

export const emailService = new EmailService();
