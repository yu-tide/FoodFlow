"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

export function useAssistantContext() {
  const pathname = usePathname();

  return useMemo(() => {
    const context: Record<string, string> = { page: pathname };

    if (pathname.startsWith("/records/")) {
      context["record_id"] = pathname.split("/")[2] || "";
    }

    return {
      page: pathname,
      pageContext: context,
      isLoginPage: pathname === "/login" || pathname === "/register",
    };
  }, [pathname]);
}
