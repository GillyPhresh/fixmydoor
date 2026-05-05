import nodemailer from "nodemailer";
import type { Booking } from "../shared/types";

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

const DEFAULT_BUSINESS_EMAIL = "info@fixmydoor.com";

function getBusinessEmail() {
  return process.env.BUSINESS_EMAIL || process.env.ADMIN_EMAIL || DEFAULT_BUSINESS_EMAIL;
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

function formatSubmittedAt(value: string) {
  const submittedAt = new Date(value);
  return Number.isNaN(submittedAt.getTime()) ? escapeHtml(value) : submittedAt.toLocaleString();
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
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6B4423;">Booking Confirmed!</h1>
        <p>Hi ${escapeHtml(booking.name)},</p>
        <p>Thank you for choosing FixMyDoor. Your booking has been received and is being processed.</p>

        <div style="background: #F5F1E8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Booking Details:</h3>
          <p><strong>Booking ID:</strong> ${escapeHtml(booking.id)}</p>
          <p><strong>Service:</strong> ${escapeHtml(booking.repairType)}</p>
          <p><strong>Address:</strong> ${escapeHtml(booking.address)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(booking.phone)}</p>
          <p><strong>Preferred Date:</strong> ${displayValue(booking.preferredDate, "To be scheduled")}</p>
          ${booking.message ? `<p><strong>Message:</strong> ${escapeHtml(booking.message)}</p>` : ""}
          <p><strong>Status:</strong> ${booking.status}</p>
        </div>

        <p>Our Staff will contact you soon to confirm the appointment time. You can reach us at:</p>
        <p><strong>Phone:</strong> +1 (483) 834-7182</p>
        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(businessEmail)}">${escapeHtml(businessEmail)}</a></p>

        <p>Thank you for trusting FixMyDoor with your repair needs!</p>
        <p>Best regards,<br>FixMyDoor Services</p>
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
    const subject = `New FixMyDoor Booking: ${cleanSubjectValue(booking.name)} - ${cleanSubjectValue(booking.repairType)}`;
    const text = [
      "New FixMyDoor booking received",
      "",
      `Booking ID: ${booking.id}`,
      `Name: ${booking.name}`,
      `Phone: ${booking.phone}`,
      `Email: ${booking.email}`,
      `Address: ${booking.address}`,
      `Service: ${booking.repairType}`,
      `Preferred Date: ${booking.preferredDate || "Not specified"}`,
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
          <p><strong>Service:</strong> ${escapeHtml(booking.repairType)}</p>
          <p><strong>Preferred Date:</strong> ${displayValue(booking.preferredDate)}</p>
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
      });
      console.log("Admin notification email sent");
    } catch (error) {
      console.error("Failed to send admin notification email:", error);
    }
  }
}

export const emailService = new EmailService();
