import nodemailer from "nodemailer";
import { getAdminSettings } from "@/lib/db";

export async function sendEmailNotification({
  subject,
  html,
  text,
}: {
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  try {
    const settings = await getAdminSettings();
    const recipient = settings.adminEmail || settings.voicemailEmail || process.env.ADMIN_EMAIL || "shatnezlab@gmail.com";
    const host = settings.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(settings.smtpPort || process.env.SMTP_PORT || "587", 10);
    const user = settings.smtpUser || process.env.SMTP_USER || settings.adminEmail || "shatnezlab@gmail.com";
    const pass = settings.smtpPass || process.env.SMTP_PASS;

    if (!pass) {
      console.warn("[Email Notification] SMTP_PASS not configured in Admin Settings or process.env. Skipping email.");
      return false;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"The Shatnez Lab" <${user}>`,
      to: recipient,
      subject,
      text,
      html,
    });

    console.log(`[Email Notification] Email sent successfully to ${recipient}`);
    return true;
  } catch (err) {
    console.error("[Email Notification] Error sending email:", err);
    return false;
  }
}
