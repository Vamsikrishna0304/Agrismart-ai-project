import {
  BellRing,
  Droplets,
  FlaskConical,
  LayoutDashboard,
  Leaf,
  MessageSquare,
  Radio,
  ScanLine,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sprout,
} from "lucide-react";

export const NAV_GROUPS = ["Overview", "Farm records", "Intelligence", "Live field", "Admin"];

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, group: "Overview" },
  { to: "/farms", label: "Farms", Icon: Sprout, group: "Farm records" },
  { to: "/crops", label: "Crops", Icon: Leaf, group: "Farm records" },
  { to: "/soil", label: "Soil samples", Icon: FlaskConical, group: "Farm records" },
  { to: "/recommend", label: "Crop recommendation", Icon: Sparkles, group: "Intelligence" },
  { to: "/disease", label: "Disease detection", Icon: ScanLine, group: "Intelligence" },
  { to: "/assistant", label: "AI assistant", Icon: MessageSquare, group: "Intelligence" },
  { to: "/monitoring", label: "Sensor monitoring", Icon: Radio, group: "Live field" },
  { to: "/irrigation", label: "Smart irrigation", Icon: Droplets, group: "Live field" },
  { to: "/alerts", label: "Alerts", Icon: BellRing, group: "Live field" },
  { to: "/settings", label: "Settings", Icon: SettingsIcon, group: "Admin" },
  { to: "/admin", label: "Admin console", Icon: ShieldCheck, group: "Admin" },
];
