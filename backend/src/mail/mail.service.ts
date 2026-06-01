import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter, SendMailOptions } from "nodemailer";

type Transport = "resend" | "smtp" | "console";

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transport: Transport = "console";
  private transporter: Transporter | null = null;
  private resendApiKey: string | null = null;
  private fromAddress: string = "HealthSecure Portal <onboarding@resend.dev>";

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const resendKey = this.config.get<string>("RESEND_API_KEY");
    const emailFrom = this.config.get<string>("EMAIL_FROM");

    if (resendKey && resendKey.trim().length > 0) {
      this.resendApiKey = resendKey.trim();
      this.transport = "resend";
      this.fromAddress = emailFrom?.trim() || "HealthSecure Portal <onboarding@resend.dev>";
      this.logger.log(`Resend transport ready (from=${this.fromAddress})`);
      return;
    }

    const host = this.config.get<string>("SMTP_HOST");
    const port = Number(this.config.get<string>("SMTP_PORT") ?? 587);
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");
    const smtpFrom = this.config.get<string>("SMTP_FROM");

    if (!host || !user || !pass) {
      this.logger.warn(
        "No email transport configured (RESEND_API_KEY missing AND SMTP_HOST/USER/PASS missing). Emails will be logged to the console.",
      );
      return;
    }

    this.fromAddress = emailFrom?.trim() || smtpFrom || `HealthSecure Portal <${user}>`;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    try {
      await this.transporter.verify();
      this.transport = "smtp";
      this.logger.log(`SMTP transport ready (${host}:${port} as ${user})`);
    } catch (err) {
      this.logger.error(
        `SMTP verification failed — emails will fall back to console. ${err instanceof Error ? err.message : err}`,
      );
      this.transporter = null;
    }
  }

  async send(opts: { to: string; subject: string; text: string; html?: string }): Promise<void> {
    if (this.transport === "resend" && this.resendApiKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: this.fromAddress,
            to: [opts.to],
            subject: opts.subject,
            text: opts.text,
            ...(opts.html ? { html: opts.html } : {}),
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          this.logger.error(`Resend API returned ${res.status}: ${body}`);
          this.logger.warn(
            `\n=== EMAIL (resend failed — console fallback) ===\nTo: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.text}\n================================\n`,
          );
          return;
        }
        const data = (await res.json()) as { id?: string };
        this.logger.log(`Sent "${opts.subject}" to ${opts.to} via Resend (id=${data.id ?? "?"})`);
      } catch (err) {
        this.logger.error(
          `Resend send failed — falling back to console. ${err instanceof Error ? err.message : err}`,
        );
        this.logger.warn(
          `\n=== EMAIL (resend error — console fallback) ===\nTo: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.text}\n================================\n`,
        );
      }
      return;
    }

    if (this.transport === "smtp" && this.transporter) {
      const mail: SendMailOptions = {
        from: this.fromAddress,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
      };
      const info = await this.transporter.sendMail(mail);
      this.logger.log(`Sent "${opts.subject}" to ${opts.to} via SMTP (messageId=${info.messageId})`);
      return;
    }

    this.logger.warn(
      `\n=== EMAIL (console fallback) ===\nTo: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.text}\n================================\n`,
    );
  }
}
