"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  Kanban,
  ContactRound,
  AlertCircle,
  DatabaseZap,
  LineChart,
  TrendingUp,
  Activity,
  BarChart,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Target,
  CalendarCheck,
  Settings,
  ChevronRight,
  GitPullRequestArrow,
  FlaskConical,
  Gauge,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/stores/useModalStore";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ---------------------------------------------------------------------------
// Nav config
// ---------------------------------------------------------------------------

interface SubItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

interface NavItem {
  label: string;
  /** Primary href — used for isActive check and as the trigger link */
  href: string;
  icon: LucideIcon;
  description: string;
  /** If present, sub-menu or popup shows these */
  subItems?: SubItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: BarChart2,
    description: "KPI 카드 + 시계열 차트",
    subItems: [
      {
        label: "Today",
        href: "/dashboard/today",
        icon: Sun,
        description: "오늘 기준 실시간 현황",
      },
      {
        label: "Period",
        href: "/dashboard/period",
        icon: CalendarRange,
        description: "기간별 KPI · 시계열 차트",
      },
      {
        label: "Monthly",
        href: "/dashboard/monthly",
        icon: CalendarClock,
        description: "월간 집계 대시보드",
      },
    ],
  },
  {
    label: "Charts",
    href: "/charts",
    icon: LineChart,
    description: "이동평균 · 정규화 분석",
    subItems: [
      {
        label: "Data Chart",
        href: "/charts/data-chart",
        icon: Activity,
        description: "실제 데이터 시계열 차트",
      },
      {
        label: "Moving Average",
        href: "/charts/moving-average",
        icon: TrendingUp,
        description: "이동평균으로 트렌드 스무딩",
      },
      {
        label: "Normalized",
        href: "/charts/normalized",
        icon: BarChart,
        description: "지표 간 상관 트렌드 비교",
      },
    ],
  },
  {
    label: "MGMT",
    href: "/management",
    icon: Kanban,
    description: "매체 관리 · 파이프라인",
    subItems: [
      {
        label: "Media MGMT",
        href: "/management",
        icon: Kanban,
        description: "매체 관리 테이블",
      },
      {
        label: "Pipeline",
        href: "/pipeline",
        icon: GitPullRequestArrow,
        description: "파이프라인 관리",
      },
    ],
  },
  {
    label: "Report",
    href: "/data-board",
    icon: ContactRound,
    description: "성과 데이터 분석",
    subItems: [
      {
        label: "Daily",
        href: "/data-board/daily",
        icon: CalendarDays,
        description: "일별 성과 분석 테이블",
      },
      {
        label: "Weekly",
        href: "/data-board/weekly",
        icon: CalendarRange,
        description: "주간 집계 성과 분석",
      },
      {
        label: "Monthly",
        href: "/data-board/monthly",
        icon: CalendarClock,
        description: "월간 집계 성과 분석",
      },
    ],
  },
  {
    label: "External",
    href: "/external",
    icon: FlaskConical,
    description: "외부 매체 정산 · FC 리포트",
    subItems: [
      {
        label: "by Total",
        href: "/external",
        icon: BarChart2,
        description: "지면 총계 정산 리포트",
      },
      {
        label: "by Widget",
        href: "/external/fc",
        icon: Gauge,
        description: "widget 단위 FC 리포트",
      },
      {
        label: "Config",
        href: "/external/fc/admin",
        icon: Settings,
        description: "external_value 이력 관리",
      },
    ],
  },
  {
    label: "CVR",
    href: "/cvr",
    icon: AlertCircle,
    description: "전환율 분석",
  },
  {
    label: "Goal Setting",
    href: "/settings/goal-setting",
    icon: Target,
    description: "팀/매니저별 월간 vIMP 목표 설정",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BTN_BASE =
  "rounded-xl text-[13px] font-medium gap-3 px-3.5 py-2.5 h-auto";

function activeCls(isActive: boolean) {
  return cn(
    BTN_BASE,
    isActive &&
      "data-[active=true]:bg-blue-50 data-[active=true]:text-blue-600 data-[active=true]:border data-[active=true]:border-blue-200 data-[active=true]:shadow-sm data-[active=true]:shadow-blue-100",
  );
}

// ---------------------------------------------------------------------------
// PopupLink — reusable sub-item row inside the hover popup (collapsed mode)
// ---------------------------------------------------------------------------

interface PopupLinkProps {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  isActive: boolean;
  onClose: () => void;
}

function PopupLink({
  label,
  href,
  icon: Icon,
  description,
  isActive,
  onClose,
}: PopupLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        "group flex items-start gap-3 rounded-lg px-2 py-2 transition-all",
        isActive
          ? "bg-blue-50"
          : "hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-sm",
      )}
    >
      <span
        className={cn(
          "mt-0.5 rounded-md p-1.5 transition-colors flex-shrink-0",
          isActive
            ? "bg-blue-100 text-blue-600"
            : "bg-gray-100 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-500",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "text-[13px] font-medium leading-none",
            isActive ? "text-blue-700" : "text-gray-800",
          )}
        >
          {label}
        </p>
        <p className="text-[11px] text-gray-400 mt-1 leading-snug">
          {description}
        </p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// NavItemSimple — direct-link item (no sub-items)
// Expanded: plain link. Collapsed: hover popup with description.
// ---------------------------------------------------------------------------

function NavItemSimple({ item, pathname }: { item: NavItem; pathname: string }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isActive = pathname.startsWith(item.href);

  function handleMouseEnter() {
    clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function handleMouseLeave() {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  // Expanded — simple link, no popup
  if (!isCollapsed) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className={activeCls(isActive)}
        >
          <Link href={item.href}>
            <item.icon className="!size-4" />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  // Collapsed — hover popup
  return (
    <SidebarMenuItem>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              className={activeCls(isActive)}
            >
              <Link href={item.href}>
                <item.icon className="!size-4" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </div>
        </PopoverTrigger>

        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="w-56 p-2 rounded-xl shadow-lg border border-border"
        >
          <PopupLink
            label={item.label}
            href={item.href}
            icon={item.icon}
            description={item.description}
            isActive={isActive}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  );
}

// ---------------------------------------------------------------------------
// NavItemWithSub — has sub-items
// Expanded: collapsible sub-menu below. Collapsed: hover popup.
// ---------------------------------------------------------------------------

function NavItemWithSub({ item, pathname }: { item: NavItem; pathname: string }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive =
    pathname.startsWith(item.href) ||
    (item.subItems?.some((sub) => pathname.startsWith(sub.href)) ?? false);
  const primaryHref = item.subItems?.[0]?.href ?? item.href;

  // --- Collapsed mode: hover popup (same as before) ---
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleMouseEnter() {
    clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function handleMouseLeave() {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  if (isCollapsed) {
    return (
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                className={activeCls(isActive)}
              >
                <Link href={primaryHref}>
                  <item.icon className="!size-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </div>
          </PopoverTrigger>

          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="w-56 p-2 rounded-xl shadow-lg border border-border"
          >
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">
              {item.label}
            </p>
            <div className="flex flex-col gap-0.5 mt-1">
              {item.subItems!.map((sub) => (
                <PopupLink
                  key={sub.href}
                  label={sub.label}
                  href={sub.href}
                  icon={sub.icon}
                  description={sub.description}
                  isActive={pathname === sub.href}
                  onClose={() => setOpen(false)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    );
  }

  // --- Expanded mode: collapsible sub-menu ---
  return (
    <Collapsible asChild defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={isActive}
            className={cn(activeCls(isActive), "justify-between")}
          >
            <span className="flex items-center gap-3">
              <item.icon className="!size-4" />
              <span>{item.label}</span>
            </span>
            <ChevronRight className="!size-3.5 text-gray-400 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {item.subItems!.map((sub) => {
              const subActive = pathname === sub.href;
              return (
                <SidebarMenuSubItem key={sub.href}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={subActive}
                    className={cn(
                      "text-[12px] font-medium py-1.5",
                      subActive && "text-blue-600 font-semibold",
                    )}
                  >
                    <Link href={sub.href}>
                      <sub.icon className="!size-3.5" />
                      <span>{sub.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// AppSidebar
// ---------------------------------------------------------------------------

/**
 * Left sidebar navigation with collapsible icon mode.
 * Expanded: sub-items render as collapsible sub-menus below the parent.
 * Collapsed (icon-only): sub-items show in a hover popup to the right.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const openModal = useModalStore((s) => s.open);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) =>
                item.subItems ? (
                  <NavItemWithSub key={item.href} item={item} pathname={pathname} />
                ) : (
                  <NavItemSimple key={item.href} item={item} pathname={pathname} />
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => openModal("import")}
              className="rounded-xl text-[13px] font-medium gap-3 px-3.5 py-2.5 h-auto text-gray-500 hover:text-green-700 hover:bg-green-50"
            >
              <DatabaseZap className="!size-4" />
              <span>데이터 업데이트</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
