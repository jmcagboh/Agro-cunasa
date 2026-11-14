import { useEffect, useState } from "react";
import Gate from "./Gate";
import Logo from "./Logo";

export default function Splash() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 1600);
    return () => window.clearTimeout(timer);
  }, []);

  if (!open) return <Gate />;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-soil-900 px-6 text-center text-soil-50">
      <Logo className="h-28 w-28" />
      <h1 className="mt-6 text-4xl font-semibold">TerraShift</h1>
      <p className="mt-2 text-sm tracking-widest text-amber-200">FIELD SHIFT</p>
    </div>
  );
}
