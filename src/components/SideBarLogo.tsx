import { X } from "lucide-react";

interface SidebarLogoProps {
  isCollapsed: boolean;
  onClose: () => void;
  className?: string;
}

// Blue ring that stands in for the "o" in the wordmark, with a small drop below it.
function VoiceRing({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <path d="M27.2 17.5a11.5 11.5 0 1 1-4.1-10.6" fill="none" stroke="#1E9BF0" strokeWidth="4.4" strokeLinecap="round" />
      <rect x="13.6" y="20.5" width="4.8" height="8" rx="2.4" fill="#4FC3F7" />
    </svg>
  );
}

export default function SidebarLogo({ isCollapsed, onClose, className = "" }: SidebarLogoProps) {
  return (
    <div className={`client-sidebar-brand flex shrink-0 items-center justify-between px-8 py-7 ${isCollapsed ? "md:px-5" : ""} ${className}`}>
      <div className="flex flex-col" aria-label="Voicedots">
        <div className="flex items-center text-[#0B1B3F] dark:text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
          {isCollapsed ? (
            <VoiceRing size={30} />
          ) : (
            <>
              <span className="text-[30px] font-semibold leading-none tracking-tight">V</span>
              <VoiceRing size={26} />
              <span className="text-[30px] font-semibold leading-none tracking-tight">icedots</span>
              <sup className="ml-0.5 text-[10px] leading-none text-[#6B7A99]">®</sup>
            </>
          )}
        </div>
        {!isCollapsed && (
          <span className="mt-1 text-[12px] font-medium tracking-wide" style={{ fontFamily: "Poppins, sans-serif", color: "#6B7A99" }}>
            AI Avatar VoiceBot
          </span>
        )}
      </div>
      <button type="button" onClick={onClose} aria-label="Close sidebar" className="md:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">
        <X size={20} />
      </button>
    </div>
  );
}
