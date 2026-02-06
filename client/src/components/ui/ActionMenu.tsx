import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, LucideIcon } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
  divider?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  disabled?: boolean;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div
      ref={menuRef}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="p-1 rounded hover:bg-background-secondary text-text-secondary disabled:opacity-50 disabled:pointer-events-none"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-background border border-border rounded-lg shadow-lg py-1">
          {items.map((item, index) => {
            const Icon = item.icon;
            const isDanger = item.variant === 'danger';

            return (
              <React.Fragment key={index}>
                {item.divider && (
                  <div className="border-t border-border my-1" />
                )}
                <button
                  type="button"
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none ${
                    isDanger
                      ? 'text-error hover:bg-background-secondary'
                      : 'text-text-primary hover:bg-background-secondary'
                  }`}
                  disabled={item.disabled}
                  onClick={() => {
                    setIsOpen(false);
                    item.onClick();
                  }}
                >
                  {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                  {item.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
