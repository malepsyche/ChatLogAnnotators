"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AssignmentProvider } from "@/components/context/assignment-context";
import AssignmentSwitcher from "@/components/context/assignment-switcher";

import { ReactNode } from "react";

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <AssignmentProvider>
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
                    </div>
                    <AssignmentSwitcher />
                  </div>
                  {children}
                  <ToastContainer />
                </main>
              </div>
            </SidebarProvider>
          </ThemeProvider>
        
      </div>
    </AssignmentProvider>
  );
};

export default RootLayout;
