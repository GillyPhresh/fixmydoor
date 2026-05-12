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
const LOGO_CID = "fixmydoor-logo";

function getBusinessEmail() {
  return process.env.BUSINESS_EMAIL || process.env.ADMIN_EMAIL || DEFAULT_BUSINESS_EMAIL;
}

function getPublicBaseUrl() {
  return (
    process.env.PUBLIC_SITE_URL ||
    process.env.VITE_PUBLIC_SITE_URL ||
    process.env.ADMIN_URL?.replace(/\/admin\/?$/, "") ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function getGoogleMapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
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

function formatSubmittedAt(value: string) {
  const submittedAt = new Date(value);
  return Number.isNaN(submittedAt.getTime()) ? escapeHtml(value) : submittedAt.toLocaleString();
}

function formatOptionalRow(label: string, value?: string | null) {
  return value ? `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>` : "";
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
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.FROM_EMAIL || "noreply@fixmydoor.com";

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
    return true;
  }

  async sendBookingConfirmation(booking: Booking) {
    if (!this.transporter || !this.config) {
      console.warn("Email service not initialized");
      return;
    }

    const businessEmail = getBusinessEmail();
    const subject = "FixMyDoor - Booking Confirmation";
    const logoAttachment = getLogoAttachment();
    const trackingUrl = booking.customerToken ? `${getPublicBaseUrl()}/track/${booking.customerToken}` : "";
    const logoHtml = logoAttachment
      ? `<div style="display:inline-block; background:#ffffff; border-radius:18px; padding:12px 18px; margin:0 auto 12px; box-shadow:0 10px 24px rgba(0,0,0,0.14);"><img src="cid:${LOGO_CID}" alt="FixMyDoor" style="display:block; width:190px; max-width:100%; height:auto; margin:0 auto;" /></div>`
      : `<div style="display:inline-block; background:#ffffff; border-radius:18px; padding:14px 22px; margin:0 auto 12px; font-size:30px; font-weight:800; color:#6B4423; box-shadow:0 10px 24px rgba(0,0,0,0.14);">FixMyDoor</div>`;
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
      await this.transporter.sendMail({
        from: this.config.from,
        to: booking.email,
        replyTo: businessEmail,
        subject,
        html,
        attachments: logoAttachment ? [logoAttachment] : undefined,
      });
      console.log(`Booking confirmation email sent to ${booking.email}`);
    } catch (error) {
      console.error("Failed to send booking confirmation email:", error);
    }
  }

  async sendAdminNotification(booking: Booking) {
    if (!this.transporter || !this.config) {
      console.warn("Email service not initialized");
      return;
    }

    const businessEmail = getBusinessEmail();
    const adminEmail = process.env.ADMIN_EMAIL || businessEmail || this.config.auth.user;
    const adminUrl = process.env.ADMIN_URL || "https://your-app-url.com/admin";
    const mapsUrl = getGoogleMapsUrl(booking.address);
    const photoAttachments = getPhotoAttachments(booking);
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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #D97706;">New Booking Alert!</h1>
        <p>A new booking has been received:</p>

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
          <p><a href="${escapeHtml(mapsUrl)}" style="display:inline-block; background:#2f241c; color:#ffffff; padding:10px 14px; border-radius:10px; text-decoration:none; font-weight:700;">Open Customer Address in Google Maps</a></p>
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
    `;

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: adminEmail,
        replyTo: booking.email,
        subject,
        text,
        html,
        attachments: photoAttachments,
      });
      console.log("Admin notification email sent");
    } catch (error) {
      console.error("Failed to send admin notification email:", error);
    }
  }

  async sendStatusUpdate(booking: Booking) {
    if (!this.transporter || !this.config) {
      console.warn("Email service not initialized");
      return;
    }

    const businessEmail = getBusinessEmail();
    const trackingUrl = booking.customerToken ? `${getPublicBaseUrl()}/track/${booking.customerToken}` : "";
    const subject = `FixMyDoor request update: ${booking.status.replace("_", " ")}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background:#fffaf2; border:1px solid #ead8bf; border-radius:20px; overflow:hidden;">
        <div style="background:#2f241c; padding:22px; text-align:center;">
          <div style="display:inline-block; background:#ffffff; border-radius:16px; padding:12px 18px; color:#6B4423; font-size:28px; font-weight:800;">FixMyDoor</div>
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
      await this.transporter.sendMail({
        from: this.config.from,
        to: booking.email,
        replyTo: businessEmail,
        subject,
        html,
      });
      console.log(`Status update email sent to ${booking.email}`);
    } catch (error) {
      console.error("Failed to send status update email:", error);
    }
  }
}

export const emailService = new EmailService();
