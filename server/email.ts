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

    const subject = "FixMyDoor - Booking Confirmation";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6B4423;">Booking Confirmed!</h1>
        <p>Hi ${booking.name},</p>
        <p>Thank you for choosing FixMyDoor. Your booking has been received and is being processed.</p>

        <div style="background: #F5F1E8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Booking Details:</h3>
          <p><strong>Service:</strong> ${booking.repairType}</p>
          <p><strong>Address:</strong> ${booking.address}</p>
          <p><strong>Phone:</strong> ${booking.phone}</p>
          <p><strong>Preferred Date:</strong> ${booking.preferredDate || "To be scheduled"}</p>
          ${booking.message ? `<p><strong>Message:</strong> ${booking.message}</p>` : ""}
          <p><strong>Status:</strong> ${booking.status}</p>
        </div>

        <p>Richard will contact you soon to confirm the appointment time. You can reach us at:</p>
        <p><strong>Phone:</strong> +1 (483) 834-7182</p>
        <p><strong>Email:</strong> info.fixmydoor@gmail.com</p>

        <p>Thank you for trusting FixMyDoor with your repair needs!</p>
        <p>Best regards,<br>Richard Ampofo<br>FixMyDoor Services</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: booking.email,
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

    const subject = "New FixMyDoor Booking Received";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #D97706;">New Booking Alert!</h1>
        <p>A new booking has been received:</p>

        <div style="background: #F5F1E8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Customer Details:</h3>
          <p><strong>Name:</strong> ${booking.name}</p>
          <p><strong>Phone:</strong> ${booking.phone}</p>
          <p><strong>Email:</strong> ${booking.email}</p>
          <p><strong>Address:</strong> ${booking.address}</p>
          <p><strong>Service:</strong> ${booking.repairType}</p>
          <p><strong>Preferred Date:</strong> ${booking.preferredDate || "Not specified"}</p>
          ${booking.message ? `<p><strong>Message:</strong> ${booking.message}</p>` : ""}
          <p><strong>Status:</strong> ${booking.status}</p>
          <p><strong>Submitted:</strong> ${new Date(booking.createdAt).toLocaleString()}</p>
        </div>

        <p>Please log in to the admin dashboard to manage this booking.</p>
        <p><a href="${process.env.ADMIN_URL || "https://your-app-url.com/admin"}" style="background: #D97706; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View in Admin Dashboard</a></p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: process.env.ADMIN_EMAIL || this.config.auth.user,
        subject,
        html,
      });
      console.log("Admin notification email sent");
    } catch (error) {
      console.error("Failed to send admin notification email:", error);
    }
  }
}

export const emailService = new EmailService();
