import nodemailer from 'nodemailer';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import { getSESClient } from '../config/aws';
import { env } from '../config/env';

export interface SendOtpResult {
  success: boolean;
  message: string;
  devOtp?: string;
  error?: string;
}

export const sendOtpEmail = async (toEmail: string, otp: string): Promise<SendOtpResult> => {
  const smtpUser = env.smtpUser();
  const smtpPass = env.smtpPass();
  const subject = `Your SmartHospital Security Code: ${otp}`;
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0284c7, #0d9488); padding: 32px 24px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 32px 28px; text-align: center; color: #1e293b; }
    .desc { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .otp-box { background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 12px; padding: 20px; display: inline-block; margin: 0 auto 24px; min-width: 240px; }
    .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #15803d; font-family: monospace; margin: 0; }
    .expiry { font-size: 13px; color: #64748b; margin-top: 8px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏥 SmartHospital Security</h1>
      <p>Cloud Electronic Medical Records</p>
    </div>
    <div class="content">
      <p class="desc">Please use the following 6-digit One-Time Password (OTP) to verify your email address and complete your registration.</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="expiry">⏱️ Valid for 10 minutes</div>
      </div>
      <p style="font-size: 13px; color: #64748b;">If you did not request this verification code, please ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} SmartHospital System.
    </div>
  </div>
</body>
</html>
  `;

  const textBody = `Your SmartHospital verification code is: ${otp}. It is valid for 10 minutes.`;

  console.log(`\n=======================================================`);
  console.log(`[EMAIL VERIFICATION OTP] Generated for: ${toEmail}`);
  console.log(`[OTP CODE]: ${otp} (Valid for 10 minutes)`);
  console.log(`=======================================================\n`);

  // Priority 1: Gmail SMTP (Nodemailer) -> sends to ANY email without AWS sandbox limits
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"SmartHospital" <${smtpUser}>`,
        to: toEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });

      console.log(`[Gmail SMTP] Verification email successfully sent to: ${toEmail}`);
      return { success: true, message: 'Verification OTP sent to your email via Gmail.' };
    } catch (err: any) {
      console.warn(`[Gmail SMTP Error] ${err.message}`);
    }
  }

  // Priority 2: AWS SES fallback
  try {
    const fromEmail = env.sesFromEmail();
    const ses = getSESClient();
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [toEmail] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: htmlBody, Charset: 'UTF-8' },
            Text: { Data: textBody, Charset: 'UTF-8' },
          },
        },
      })
    );
    console.log(`[AWS SES] Successfully sent OTP email to: ${toEmail}`);
    return { success: true, message: 'Verification OTP sent to your email.' };
  } catch (err: any) {
    console.warn(`[AWS SES Warning] ${err.message}`);
    return {
      success: true,
      message: 'OTP generated! Check your email or see terminal/screen for test code.',
      devOtp: otp,
      error: err.message,
    };
  }
};
