# Contact email delivery (Node server)

The contact form posts to /api/contact. Its fixed recipient is office@londonpentecostalchurch.org. Set SMTP_HOST, SMTP_PORT (587 STARTTLS or 465 TLS), SMTP_USER, SMTP_PASSWORD and SMTP_FROM in the hosting service environment. SMTP_FROM must be an address verified with your email provider; visitor email is Reply-To. Never put credentials in browser JavaScript or Git. The preview server reads environment variables, not .env files.

This connection requires a provider supporting authenticated SMTP username/password or a provider SMTP key. It is not a Microsoft Graph connection. Microsoft 365 tenants may require OAuth instead; do not weaken tenant authentication to use this transport.

Validation, same-origin checks, a honeypot, and a per-process five-attempts-per-ten-minutes IP limit are included. Multi-instance hosting needs shared rate limiting. Success is shown only after SMTP accepts the message; acceptance does not guarantee inbox delivery. Test receipt and reply routing before launch.

The direct SMTP endpoint runs in the Node/Docker deployment. The alternative Worker adapter does not support this endpoint yet; use Node hosting for this package.

SMTP documentation: https://nodemailer.com/smtp

Microsoft 365: set CONTACT_MAIL_PROVIDER=microsoft365, MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET and MS_MAIL_SENDER. Use app-only Graph Mail.Send access scoped to the sender mailbox through Exchange application RBAC. Do not grant unrestricted tenant-wide send access. Configure and test authorisation with the tenant administrator. A Graph 202 response means accepted for processing, not guaranteed inbox delivery.
