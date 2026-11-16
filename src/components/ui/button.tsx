import Link from "next/link";
import { cn } from "@/lib/utils";
export const buttonClass = (secondary = false) =>
  cn("button", secondary && "button-secondary");
export function Button({
  className,
  secondary,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button className={cn(buttonClass(secondary), className)} {...props} />
  );
}
export function ButtonLink({
  href,
  children,
  secondary,
  className,
}: {
  href: string;
  children: React.ReactNode;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(buttonClass(secondary), className)}>
      {children}
    </Link>
  );
}
