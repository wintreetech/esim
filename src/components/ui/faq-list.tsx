export const faqs = [
  [
    "Wait, what exactly is an eSIM?",
    "An eSIM is a digital SIM built into compatible phones. You install a data plan by scanning a QR code or entering activation details, with no physical card to swap.",
  ],
  [
    "Can I keep my usual phone number?",
    "Yes. Keep your regular SIM for your phone number and set the travel eSIM as your mobile data line. Apps such as WhatsApp can keep using your existing number. Your home carrier may charge for calls, texts, or roaming, so check its settings.",
  ],
  [
    "When should I install my eSIM?",
    "Install over reliable Wi-Fi before departure. Your plan's validity starts when the eSIM first connects to a supported network at your destination. Keep your eSIM installed and follow the instructions included with your order.",
  ],
  [
    "Does my phone need to be unlocked?",
    "Yes. Your phone needs to support eSIM and be carrier unlocked. Check our compatibility page and confirm your exact device variant with its manufacturer or carrier before buying.",
  ],
  [
    "What happens after I buy a plan?",
    "After your payment is confirmed, we request your eSIM from the provider and email a secure installation link and QR code. If fulfillment is delayed, your order stays visible and support can help. Keep the confirmation email.",
  ],
  [
    "Can I share data with my laptop?",
    "Plans marked as hotspot supported allow tethering, subject to network coverage and the provider's fair use rules. Check the selected plan before purchasing.",
  ],
];
export function FaqList({ limit }: { limit?: number }) {
  return (
    <div className="faq-list">
      {faqs.slice(0, limit).map(([q, a]) => (
        <details key={q}>
          <summary>
            {q}
            <span>+</span>
          </summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
