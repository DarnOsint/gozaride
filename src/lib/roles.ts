import type { Role } from "@/context/AuthContext";

export function dashboardFor(role: Role | undefined): string {
  switch (role) {
    case "driver":
      return "/driver";
    case "shop":
      return "/shop";
    case "admin":
      return "/nen";
    default:
      return "/customer";
  }
}
