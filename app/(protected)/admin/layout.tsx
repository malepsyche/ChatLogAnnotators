"use client";

import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { DatabaseProvider } from "@/components/context/database-context";
import DatabaseSwitcher from "@/components/context/database-switcher";

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <DatabaseProvider>
      <div className="h-screen overflow-hidden bg-primary text-foreground">
        
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SidebarProvider>
              <div className="flex h-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                  <div className="sticky top-0 z-10 bg-background p-1 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <SidebarTrigger />
                      <ModeToggle />
                      <DatabaseSwitcher />
                      {/* Additional UI components can be added here */}
                    </div>
                  </div>
                  {children}
                  <ToastContainer />
                </main>
              </div>
            </SidebarProvider>
          </ThemeProvider>
        
      </div>
    </DatabaseProvider>
  );
};

export default RootLayout;
