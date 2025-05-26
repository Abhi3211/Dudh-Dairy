
import { Milk } from 'lucide-react';
import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <div className="flex items-center gap-2 text-lg font-semibold text-primary group-data-[collapsible=icon]:justify-center" aria-label="Dudh Dairy Logo">
      <Milk className="h-7 w-7 group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6 transition-all" />
      <span className="group-data-[collapsible=icon]:hidden">Dudh Dairy</span>
    </div>
  );
}
