
"use client";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { Languages } from "lucide-react"; // Using a more generic icon

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleLanguage}
            className="h-8 w-8" // Make it slightly smaller to fit better
            aria-label={`Switch to ${language === "en" ? "Hindi" : "English"}`}
          >
            <Languages className="h-4 w-4" />
            <span className="sr-only">
              {language === "en" ? "Switch to Hindi" : "Switch to English"}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{language === "en" ? "Switch to Hindi" : "Switch to English"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Need to add TooltipProvider and Tooltip imports if not already there
// Assuming Tooltip components are available globally or imported where LanguageToggle is used
// For self-containment, let's ensure they are here (or make a note if they should be imported from ui/tooltip)

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
