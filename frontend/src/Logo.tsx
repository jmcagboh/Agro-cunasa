export default function Logo({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 128 128" role="img" aria-label="TerraShift">
      <rect width="128" height="128" rx="28" fill="#243024" />
      <circle cx="64" cy="46" r="16" fill="#f6f4ef" />
      <path d="M22 78c16-20 28-20 42 0s26 20 42 0" fill="none" stroke="#d4a017" strokeWidth="8" strokeLinecap="round" />
      <path d="M22 98c16-16 28-16 42 0s26 16 42 0" fill="none" stroke="#6f8f62" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}
