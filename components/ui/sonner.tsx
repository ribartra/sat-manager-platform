"use client";

import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "border border-gray-200 bg-white text-gray-950 shadow-lg",
          description: "text-gray-500",
          actionButton: "bg-blue-600 text-white",
          cancelButton: "bg-gray-100 text-gray-900",
        },
      }}
      {...props}
    />
  );
}
