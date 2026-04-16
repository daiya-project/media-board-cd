import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import AppHeader from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Toast } from "@/components/common/Toast";
import { ImportModal } from "@/components/modals/ImportModal";
import { RecordActionModal } from "@/components/modals/RecordActionModal";
import { ActionHistoryModal } from "@/components/modals/ActionHistoryModal";
import { MemoViewModal } from "@/components/modals/MemoViewModal";
import { AddClientModal } from "@/components/modals/AddClientModal";
import { SidebarProvider } from "@/components/ui/sidebar";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Media Board",
  description: "Media advertising performance dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        /></head>
      <body
        className="antialiased bg-background"
      >
        <Providers>
        <SidebarProvider defaultOpen={defaultOpen}>
          <div className="flex flex-col h-screen w-full overflow-hidden">
            {/* Fixed header — full width above sidebar */}
            <AppHeader />

            {/* Content area — sidebar + page */}
            <div className="flex flex-1 min-h-0">
              <AppSidebar />
              <main className="flex-1 overflow-auto">
                {children}
              </main>
            </div>
          </div>
        </SidebarProvider>

        {/* Global toast notifications */}
        <Toast />

        {/* Global modals — Client Components */}
        <ImportModal />
        <RecordActionModal />
        <ActionHistoryModal />
        <MemoViewModal />
        <AddClientModal />
        </Providers>
      </body>
    </html>
  );
}
