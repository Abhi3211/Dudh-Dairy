
import { Milk } from 'lucide-react';

interface LogoProps {
  companyName?: string | null;
}

export function Logo({ companyName }: LogoProps) {
  return (
    <div className="flex flex-col items-start group-data-[collapsible=icon]:items-center" aria-label="Dudh Dairy Logo Container">
      <div className="flex items-center gap-2 text-lg font-semibold text-primary group-data-[collapsible=icon]:justify-center">
        <Milk className="h-7 w-7 group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6 transition-all" />
        <span className="group-data-[collapsible=icon]:hidden">Dudh Dairy</span>
      </div>
      {companyName && (
        <span className="mt-0.5 text-xs text-sidebar-foreground/80 group-data-[collapsible=icon]:hidden truncate max-w-[calc(var(--sidebar-width)-2rem)]">
          {companyName}
        </span>
      )}
    </div>
  );
}
