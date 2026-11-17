export function emailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
    process.env.EMAIL_FROM?.trim() &&
    !process.env.EMAIL_FROM.includes("your-verified-domain.com"),
  );
}
