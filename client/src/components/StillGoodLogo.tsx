export function StillGoodLogo({ className = "logo-mark" }: { className?: string }) {
  return (
    <img
      src="/stillgood-logo.svg"
      alt="StillGood logo"
      className={className}
      width={42}
      height={42}
      draggable={false}
    />
  );
}
