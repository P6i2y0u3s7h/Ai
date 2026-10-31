import React from 'react';
import { LucideIcon } from 'lucide-react';

interface NavigationItemProps {
  icon: LucideIcon;
  label: string;
  badge?: string | number;
  isActive?: boolean;
  isCollapsed?: boolean;
  onClick: () => void;
  accentColor?: string;
  variant?: 'default' | 'primary';
}

export const NavigationItem: React.FC<NavigationItemProps> = ({
  icon: Icon,
  label,
  badge,
  isActive = false,
  isCollapsed = false,
  onClick,
  variant = 'default'
}) => {
  if (variant === 'primary') {
    return (
      <button
        onClick={onClick}
        title={isCollapsed ? label : undefined}
        className={`w-full h-10 flex items-center rounded-xl transition-all duration-200 select-none group font-medium ${
          isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'
        } bg-[#141414] hover:bg-[#1C1C1C] text-white border border-[#262626] shadow-sm`}
      >
        <div className="w-5 h-5 flex items-center justify-center text-white">
          <Icon size={18} strokeWidth={2.2} />
        </div>
        {!isCollapsed && (
          <span className="text-[13.5px] truncate flex-1 text-left tracking-tight">
            {label}
          </span>
        )}
        {!isCollapsed && (
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-zinc-400 bg-[#0A0A0A] px-1.5 py-0.5 rounded border border-[#262626] font-mono">
            New
          </kbd>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={`w-full h-10 flex items-center rounded-xl transition-all duration-150 select-none group text-left ${
        isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'
      } ${
        isActive
          ? 'bg-[#1C1C1C] text-white font-medium border border-[#262626]'
          : 'text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C] border border-transparent'
      }`}
    >
      <div
        className={`w-5 h-5 flex items-center justify-center transition-colors ${
          isActive ? 'text-white' : 'text-[#A1A1AA] group-hover:text-white'
        }`}
      >
        <Icon size={17} strokeWidth={1.8} />
      </div>

      {!isCollapsed && (
        <span className="text-[13.5px] truncate flex-1 tracking-tight">
          {label}
        </span>
      )}

      {!isCollapsed && badge !== undefined && (
        <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-[#181818] text-zinc-300 font-mono border border-[#262626]">
          {badge}
        </span>
      )}
    </button>
  );
};
