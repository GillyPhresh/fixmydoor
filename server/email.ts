import nodemailer from "nodemailer";
import { setDefaultResultOrder } from "node:dns";
import { existsSync } from "fs";
import { resolve } from "path";
import type { Booking, BookingStatus } from "../shared/types";
import { formatBookingDisplayId } from "../shared/booking-code";

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

interface EmailRuntimeStatus {
  configured: boolean;
  verified: boolean;
  provider: "resend" | "smtp" | "none";
  host: string;
  port: number | null;
  secure: boolean;
  smtpUser: string;
  resendConfigured: boolean;
  resendFrom: string;
  from: string;
  businessEmail: string;
  adminEmail: string;
  publicBaseUrl: string;
  adminDashboardUrl: string;
  missing: string[];
  lastVerifyError: string;
  lastSendError: string;
  initializedAt: string;
}

const DEFAULT_BUSINESS_EMAIL = "info.fixmydoor@gmail.com";
const DEFAULT_PUBLIC_SITE_URL = "https://www.fixmydoor.ca";
const LOGO_CID = "fixmydoor-logo";
const EMAIL_LOGO_CARD_STYLE = "background:#ffffff; background-color:#ffffff; border:1px solid #ead8bf; border-radius:22px; padding:14px 22px; margin:0 auto 14px; box-shadow:0 14px 32px rgba(0,0,0,0.16);";
const EMAIL_LOGO_IMG_STYLE = "display:block; width:220px; max-width:100%; height:auto; margin:0 auto;";

try {
  setDefaultResultOrder("ipv4first");
} catch {
  // Older runtimes can ignore this; the transport also requests IPv4 explicitly.
}

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

function inferSmtpHost(user: string, host: string) {
  if (host) {
    return host;
  }

  const normalizedUser = user.toLowerCase();
  if (/@(?:gmail|googlemail)\.com$/.test(normalizedUser)) {
    return "smtp.gmail.com";
  }
  if (/@(?:outlook|hotmail|live)\.com$/.test(normalizedUser)) {
    return "smtp.office365.com";
  }

  return "";
}

function maskEmail(value: string) {
  const [name, domain] = value.split("@");
  if (!name || !domain) {
    return value ? "configured" : "";
  }

  return `${name.slice(0, 2)}***@${domain}`;
}

function summarizeEmailError(error: unknown) {
  const rawError = error as any;
  const pieces = [
    rawError?.code,
    rawError?.command,
    rawError?.responseCode ? `response ${rawError.responseCode}` : "",
    rawError?.message || String(error || ""),
  ].filter(Boolean);

  return pieces.join(" | ").replace(/\s+/g, " ").slice(0, 320);
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

export function getPublicBaseUrl() {
  const adminRoot = normalizeEnvValue(process.env.ADMIN_URL).replace(/\/admin\/?$/, "");
  return (
    normalizePublicUrl(process.env.PUBLIC_SITE_URL) ||
    normalizePublicUrl(process.env.VITE_PUBLIC_SITE_URL) ||
    normalizePublicUrl(adminRoot) ||
    getRailwayPublicBaseUrl() ||
    (process.env.NODE_ENV === "production" ? DEFAULT_PUBLIC_SITE_URL : "http://localhost:3000")
  ).replace(/\/+$/, "");
}

export function getAdminDashboardUrl() {
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

function sanitizeSingleLine(value: string, maxLength = 120) {
  return cleanSubjectValue(String(value || "")).slice(0, maxLength);
}

function cleanBodyText(value: string, maxLength = 1000) {
  return String(value || "").replace(/\r/g, "").trim().slice(0, maxLength);
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

function renderEmailLogo(logoAttachment: ReturnType<typeof getLogoAttachment>, options: { marginBottom?: string; textSize?: string; hosted?: boolean } = {}) {
  const marginBottom = options.marginBottom ?? "14px";
  const textSize = options.textSize ?? "30px";
  const logoSrc = options.hosted ? `${getPublicBaseUrl()}/img5150-transparent.png` : `cid:${LOGO_CID}`;
  const content = logoAttachment || options.hosted
    ? `<img src="${logoSrc}" alt="FixMyDoor" width="220" style="${EMAIL_LOGO_IMG_STYLE} background:#ffffff; background-color:#ffffff;" />`
    : `<span style="display:block; color:#6B4423; font-size:${textSize}; font-weight:800; line-height:1.1;">FixMyDoor Services</span>`;

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

async function sendMailWithRetry(transporter: any, options: Record<string, unknown>, label: string, onError?: (error: unknown) => void) {
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
  onError?.(lastError);
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
      return "Your request has been marked as completed. Thank you for trusting FixMyDoor Services.";
    case "CANCELLED":
      return "Your request has been cancelled. Contact us if you need to reopen it.";
    default:
      return "Your request is still pending. Our staff will contact you soon.";
  }
}

class EmailService {
  private transporter: any | null = null;
  private config: EmailConfig | null = null;
  private verified = false;
  private resendVerified = false;
  private lastVerifyError = "";
  private lastSendError = "";
  private initializedAt = "";

  private getResendApiKey() {
    return normalizeEnvValue(process.env.RESEND_API_KEY);
  }

  private getResendFrom() {
    return normalizeEnvValue(process.env.RESEND_FROM_EMAIL) || normalizeEnvValue(process.env.FROM_EMAIL);
  }

  private canUseResend() {
    return Boolean(this.getResendApiKey() && this.getResendFrom());
  }

  private canSendEmail() {
    return this.canUseResend() || Boolean(this.transporter && this.config);
  }

  initialize() {
    this.initializedAt = new Date().toISOString();
    this.verified = false;
    this.resendVerified = false;
    this.lastVerifyError = "";
    this.lastSendError = "";

    if (this.canUseResend()) {
      this.transporter = null;
      this.config = null;
      this.resendVerified = true;
      console.log("Email service configured for Resend HTTPS delivery.");
      return true;
    }

    const rawHost = normalizeEnvValue(process.env.SMTP_HOST);
    const user = normalizeEnvValue(process.env.SMTP_USER);
    const host = inferSmtpHost(user, rawHost);
    const port = parseInt(normalizeEnvValue(process.env.SMTP_PORT) || (/gmail/i.test(host) ? "465" : "587"), 10);
    const pass = normalizeSmtpPassword(normalizeEnvValue(process.env.SMTP_PASS), host);
    const from = `FixMyDoor Services <${user}>`;

    if (!host || !user || !pass) {
      this.transporter = null;
      this.config = null;
      if (!this.canUseResend()) {
        this.lastVerifyError = "Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in Railway, or set SMTP_USER and SMTP_PASS on a Railway plan that supports SMTP.";
        console.warn(this.lastVerifyError);
      }
      return false;
    }

    this.config = {
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      from,
    };

    this.transporter = nodemailer.createTransport({
      ...this.config,
      family: 4,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        servername: host,
      },
    });
    this.transporter.verify().then(
      () => {
        this.verified = true;
        this.lastVerifyError = "";
        console.log("Email service verified and ready.");
      },
      (error: unknown) => {
        this.verified = false;
        this.lastVerifyError = summarizeEmailError(error);
        console.error("Email service verification failed:", error);
      },
    );
    return true;
  }

  getStatus(): EmailRuntimeStatus {
    const rawHost = normalizeEnvValue(process.env.SMTP_HOST);
    const user = normalizeEnvValue(process.env.SMTP_USER);
    const host = this.config?.host || inferSmtpHost(user, rawHost);
    const pass = normalizeEnvValue(process.env.SMTP_PASS);
    const resendApiKey = this.getResendApiKey();
    const resendFrom = this.getResendFrom();
    const resendConfigured = Boolean(resendApiKey && resendFrom);
    const provider = resendConfigured ? "resend" : this.transporter && this.config ? "smtp" : "none";
    const missing = [
      resendApiKey && !resendFrom ? "RESEND_FROM_EMAIL" : "",
      !resendApiKey && !host ? "SMTP_HOST" : "",
      !resendApiKey && !user ? "SMTP_USER" : "",
      !resendApiKey && !pass ? "SMTP_PASS" : "",
    ].filter(Boolean);

    return {
      configured: Boolean(resendConfigured || (this.transporter && this.config && missing.length === 0)),
      verified: provider === "resend" ? this.resendVerified : this.verified,
      provider,
      host,
      port: this.config?.port || null,
      secure: Boolean(this.config?.secure),
      smtpUser: maskEmail(user),
      resendConfigured,
      resendFrom: resendFrom ? "configured" : "",
      from: this.config?.from || "",
      businessEmail: getBusinessEmail(),
      adminEmail: normalizeEnvValue(process.env.ADMIN_EMAIL) || getBusinessEmail(),
      publicBaseUrl: getPublicBaseUrl(),
      adminDashboardUrl: getAdminDashboardUrl(),
      missing,
      lastVerifyError: provider === "resend" ? "" : this.lastVerifyError,
      lastSendError: this.lastSendError,
      initializedAt: this.initializedAt,
    };
  }

  private getProviderName() {
    return this.canUseResend() ? "resend" : "smtp";
  }

  private async sendViaResend(options: Record<string, any>, label: string, onError?: (error: unknown) => void) {
    const apiKey = this.getResendApiKey();
    const from = this.getResendFrom();
    if (!apiKey || !from) {
      const error = new Error("Resend is missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
      this.lastSendError = summarizeEmailError(error);
      onError?.(error);
      return false;
    }

    try {
      const attachments = (options.attachments || [])
        .filter((attachment: any) => attachment && !attachment.cid && attachment.filename && attachment.content)
        .map((attachment: any) => ({
          filename: attachment.filename,
          content: Buffer.isBuffer(attachment.content)
            ? attachment.content.toString("base64")
            : String(attachment.content),
        }));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: Array.isArray(options.to) ? options.to : [options.to],
          reply_to: options.replyTo,
          subject: options.subject,
          html: options.html,
          text: options.text,
          attachments: attachments.length ? attachments : undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const responseBody = await response.text();

      if (!response.ok) {
        throw new Error(`Resend ${response.status}: ${responseBody.slice(0, 260)}`);
      }

      this.resendVerified = true;
      this.lastSendError = "";
      console.log(`${label} email sent with Resend.`);
      return true;
    } catch (error) {
      this.resendVerified = false;
      this.lastSendError = summarizeEmailError(error);
      console.error(`${label} email failed with Resend:`, error);
      onError?.(error);
      return false;
    }
  }

  private async sendEmail(options: Record<string, any>, label: string, onError?: (error: unknown) => void) {
    if (this.canUseResend()) {
      return this.sendViaResend(options, label, onError);
    }

    if (!this.transporter || !this.config) {
      console.warn("Email service not initialized");
      return false;
    }

    return sendMailWithRetry(this.transporter, options, label, onError);
  }

  async sendBookingConfirmation(booking: Booking) {
    if (!this.canSendEmail()) {
      console.warn("Email service not initialized");
      return false;
    }

    const businessEmail = getBusinessEmail();
    const subject = "FixMyDoor Services - Booking Confirmation";
    const useResend = this.getProviderName() === "resend";
    const logoAttachment = useResend ? undefined : getLogoAttachment();
    const trackingUrl = booking.customerToken ? `${getPublicBaseUrl()}/track/${booking.customerToken}` : "";
    const bookingDisplayId = formatBookingDisplayId(booking);
    const logoHtml = renderEmailLogo(logoAttachment, { hosted: useResend });
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; background:#fffaf2; border:1px solid #ead8bf; border-radius:22px; overflow:hidden;">
        <div style="background:#2f241c; padding:24px 24px 20px; text-align:center;">
          ${logoHtml}
          <p style="margin:0; color:#f7efe4; font-size:13px; letter-spacing:1.5px; text-transform:uppercase;">Door & Furniture Repair Services</p>
        </div>

        <div style="padding:28px;">
        <h1 style="color:#6B4423; margin:0 0 14px;">We received your request</h1>
        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Hi ${escapeHtml(booking.name)},</p>
        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Thanks for contacting FixMyDoor Services. Your request is now in our system, and our staff will contact you soon to confirm the details.</p>

        <div style="background:#F5F1E8; padding:20px; border-radius:16px; margin:22px 0; color:#3a281f;">
          <h3 style="margin-top:0; color:#6B4423;">Your request details</h3>
          <p><strong>Booking ID:</strong> ${escapeHtml(bookingDisplayId)}</p>
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

        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Thank you for trusting FixMyDoor Services with your repair needs.</p>
        <p style="font-size:16px; line-height:1.6; color:#3a281f;">Best regards,<br><strong>FixMyDoor Services</strong></p>
        </div>
      </div>
    `;

    try {
      const text = [
        `Hi ${booking.name},`,
        "",
        "Thanks for contacting FixMyDoor Services. Your request is now in our system, and our staff will contact you soon to confirm the details.",
        "",
        `Booking ID: ${bookingDisplayId}`,
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

      const sent = await this.sendEmail({
        from: this.config?.from,
        to: booking.email,
        replyTo: businessEmail,
        subject,
        text,
        html,
        attachments: logoAttachment ? [logoAttachment] : undefined,
      }, "Customer booking confirmation", (error) => {
        this.lastSendError = summarizeEmailError(error);
      });
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
    if (!this.canSendEmail()) {
      console.warn("Email service not initialized");
      return false;
    }

    const businessEmail = getBusinessEmail();
    const adminEmail = normalizeEnvValue(process.env.ADMIN_EMAIL) || businessEmail || this.config?.auth.user;
    const adminUrl = getAdminDashboardUrl();
    const mapQuery = getBookingMapQuery(booking);
    const mapsUrl = getGoogleMapsUrl(booking);
    const photoAttachments = getPhotoAttachments(booking);
    const useResend = this.getProviderName() === "resend";
    const logoAttachment = useResend ? undefined : getLogoAttachment();
    const logoHtml = `<div style="text-align:center; background:#2f241c; padding:24px; border-radius:18px 18px 0 0;">${renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px", hosted: useResend })}</div>`;
    const subject = `New FixMyDoor Services Booking: ${cleanSubjectValue(booking.name)} - ${cleanSubjectValue(booking.repairType)}`;
    const bookingDisplayId = formatBookingDisplayId(booking);
    const text = [
      "New FixMyDoor Services booking received",
      "",
      `Booking ID: ${bookingDisplayId}`,
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
          <p><strong>Booking ID:</strong> ${escapeHtml(bookingDisplayId)}</p>
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
      const sent = await this.sendEmail({
        from: this.config?.from,
        to: adminEmail,
        replyTo: booking.email,
        subject,
        text,
        html,
        attachments: [...(logoAttachment ? [logoAttachment] : []), ...photoAttachments],
      }, "Admin booking notification", (error) => {
        this.lastSendError = summarizeEmailError(error);
      });
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
    if (!this.canSendEmail()) {
      console.warn("Email service not initialized");
      return false;
    }

    const businessEmail = getBusinessEmail();
    const trackingUrl = booking.customerToken ? `${getPublicBaseUrl()}/track/${booking.customerToken}` : "";
    const subject = `FixMyDoor Services request update: ${booking.status.replace("_", " ")}`;
    const useResend = this.getProviderName() === "resend";
    const logoAttachment = useResend ? undefined : getLogoAttachment();
    const bookingDisplayId = formatBookingDisplayId(booking);
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background:#fffaf2; border:1px solid #ead8bf; border-radius:20px; overflow:hidden;">
        <div style="background:#2f241c; padding:22px; text-align:center;">
          ${renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px", hosted: useResend })}
        </div>
        <div style="padding:26px; color:#3a281f;">
          <h1 style="color:#6B4423; margin-top:0;">Your request status changed</h1>
          <p>Hi ${escapeHtml(booking.name)},</p>
          <p>${escapeHtml(statusMessage(booking.status))}</p>
          <div style="background:#F5F1E8; padding:18px; border-radius:14px; margin:20px 0;">
            <p><strong>Booking ID:</strong> ${escapeHtml(bookingDisplayId)}</p>
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
      const sent = await this.sendEmail({
        from: this.config?.from,
        to: booking.email,
        replyTo: businessEmail,
        subject,
        html,
        attachments: logoAttachment ? [logoAttachment] : undefined,
      }, "Status update", (error) => {
        this.lastSendError = summarizeEmailError(error);
      });
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

  async sendCustomerBroadcastEmail(to: string, payload: { title: string; message: string; url?: string; type?: "advert" | "notification" }) {
    if (!this.canSendEmail()) {
      console.warn("Email service not initialized");
      return false;
    }

    const businessEmail = getBusinessEmail();
    const useResend = this.getProviderName() === "resend";
    const logoAttachment = useResend ? undefined : getLogoAttachment();
    const title = sanitizeSingleLine(payload.title, 90) || "FixMyDoor Services update";
    const message = cleanBodyText(payload.message, 600) || "A new FixMyDoor Services update is available.";
    const url = payload.url ? normalizePublicUrl(payload.url) || `${getPublicBaseUrl()}${payload.url.startsWith("/") ? payload.url : `/${payload.url}`}` : getPublicBaseUrl();
    const subjectPrefix = payload.type === "advert" ? "New FixMyDoor Services offer" : "FixMyDoor Services update";
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#fffaf2;border:1px solid #ead8bf;border-radius:20px;overflow:hidden;">
        <div style="background:#2f241c;padding:22px;text-align:center;">
          ${renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px", hosted: useResend })}
        </div>
        <div style="padding:26px;color:#3a281f;">
          <p style="margin:0 0 10px;color:#b46532;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(subjectPrefix)}</p>
          <h1 style="color:#6B4423;margin:0 0 14px;">${escapeHtml(title)}</h1>
          <p style="font-size:16px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</p>
          <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#b46532;color:#ffffff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:800;">View Update</a></p>
          <p style="font-size:13px;line-height:1.5;color:#6f6258;">You are receiving this because you previously contacted FixMyDoor Services. To stop receiving service updates, reply STOP to this email.</p>
          <p style="font-size:14px;color:#3a281f;">FixMyDoor Services<br><a href="mailto:${escapeHtml(businessEmail)}" style="color:#b46532;">${escapeHtml(businessEmail)}</a><br>+1 (438) 347-1823</p>
        </div>
      </div>
    `;

    try {
      return await this.sendEmail({
        from: this.config?.from,
        to,
        replyTo: businessEmail,
        subject: `${subjectPrefix}: ${title}`,
        text: [
          title,
          "",
          message,
          "",
          `View update: ${url}`,
          "",
          "You are receiving this because you previously contacted FixMyDoor Services. To stop receiving service updates, reply STOP to this email.",
          `Contact: ${businessEmail} | +1 (438) 347-1823`,
        ].join("\n"),
        html,
        attachments: logoAttachment ? [logoAttachment] : undefined,
      }, "Customer update broadcast", (error) => {
        this.lastSendError = summarizeEmailError(error);
      });
    } catch (error) {
      console.error("Failed to send customer update email:", error);
      return false;
    }
  }

  async sendTestEmail(to = getBusinessEmail()) {
    if (!this.canSendEmail()) {
      console.warn("Email service not initialized");
      return false;
    }

    const useResend = this.getProviderName() === "resend";
    const logoAttachment = useResend ? undefined : getLogoAttachment();
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fffaf2;border:1px solid #ead8bf;border-radius:20px;overflow:hidden;">
        <div style="background:#2f241c;padding:22px;text-align:center;">
          ${
            renderEmailLogo(logoAttachment, { marginBottom: "0", textSize: "28px", hosted: useResend })
          }
        </div>
        <div style="padding:24px;color:#3a281f;">
          <h1 style="color:#6B4423;margin-top:0;">FixMyDoor Services email test</h1>
          <p>This confirms the website can send emails through the configured SMTP account.</p>
          <p>If you received this message, booking emails should also deliver to customers and admin.</p>
        </div>
      </div>
    `;

    try {
      const sent = await this.sendEmail({
        from: this.config?.from,
        to,
        replyTo: getBusinessEmail(),
        subject: "FixMyDoor Services email test",
        html,
        attachments: logoAttachment ? [logoAttachment] : undefined,
      }, "Test", (error) => {
        this.lastSendError = summarizeEmailError(error);
      });
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
