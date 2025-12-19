"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Switch } from "@heroui/react";
import { SunIcon, MoonIcon } from "@/lib/icons";

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-14 h-8" />; // Placeholder to avoid layout shift
  }

  return (
    <Switch
      isSelected={theme === "dark"}
      onValueChange={(isSelected) => setTheme(isSelected ? "dark" : "light")}
      size="lg"
      color="primary"
      startContent={<SunIcon className="h-4 w-4" />}
      endContent={<MoonIcon className="h-4 w-4" />}
      aria-label="Toggle theme"
    />
  );
}
