import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Attack-Surface Diff",
  description: "Drop a Terraform plan, watch your attack surface change.",
  icons: { icon: "/northschema-mark.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full">
        {children}
        <footer className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-400">
          Models declared reachability from your Terraform plan: what your infrastructure-as-code
          declares, not what is live.
        </footer>
      </body>
    </html>
  );
}
