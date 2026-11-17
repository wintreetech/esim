import Image from "next/image";

export function PaymentMethods() {
  return (
    <div className="payment-methods" aria-label="Card payment methods">
      <Image
        src="/images/payments/visa.svg"
        alt="Visa"
        width={66}
        height={42}
      />
      <Image
        src="/images/payments/mastercard.svg"
        alt="Mastercard"
        width={66}
        height={42}
      />
    </div>
  );
}
