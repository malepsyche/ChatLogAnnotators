"use client";

import * as React from "react";
import {
  SquareTerminal,
  Settings2,
  PieChart,
  LucideIcon,
  Users,
  List,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState<{ name: string; role: string } | null>(
    null
  );
  const [navMain, setNavMain] = React.useState<
    { title: string; url: string; icon?: LucideIcon; isActive?: boolean }[]
  >([]);

  React.useEffect(() => {
    // Fetch the role and username from cookies
    const role = document.cookie
      .split("; ")
      .find((row) => row.startsWith("userRole="))
      ?.split("=")[1];
    const username = document.cookie
      .split("; ")
      .find((row) => row.startsWith("username="))
      ?.split("=")[1];

    if (role && username) {
      setUser({ name: username, role });

      // Set navigation links dynamically based on the role
      if (role === "admin") {
        setNavMain([
          {
            title: "Home",
            url: "/admin/home",
            icon: SquareTerminal,
            isActive: true,
          },
          { title: "Teams", url: "/admin/teams", icon: Users },
          { title: "Admin", url: "/admin/admin", icon: Settings2 },
          { title: "Analytics", url: "/admin/analytics", icon: PieChart },
        ]);
      } else if (role === "annotator") {
        setNavMain([
          {
            title: "Home",
            url: "/annotator/home",
            icon: SquareTerminal,
            isActive: true,
          },
          { title: "Analytics", url: "/annotator/analytics", icon: PieChart },
        ]);
      }
    }
  }, []);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        {navMain.length > 0 ? (
          <NavMain items={navMain} />
        ) : (
          <p className="text-white text-center">Loading...</p>
        )}
      </SidebarContent>
      <SidebarFooter>
        {user ? <NavUser user={{ name: user.name }} /> : <p>Loading user...</p>}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
