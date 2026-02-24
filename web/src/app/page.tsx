"use client";

import React, { useState, useEffect } from "react";
import { InitialLoadingScreen } from "@/components/dashboard/InitialLoadingScreen";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return <InitialLoadingScreen />;
  }

  return <DashboardContent />;
}
