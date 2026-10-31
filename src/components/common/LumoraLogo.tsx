import React from 'react';
import logoImg from '../../assets/logo.jpg';

interface AiLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  showTagline?: boolean;
  className?: string;
}

export const AiLogo: React.FC<AiLogoProps> = ({
  size = 'md',
  showWordmark = true,
  showTagline = false,
  className = ''
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Neural AI Logo */}
      <img
        src={logoImg}
        alt="Ai Logo"
        className={`${iconSizes[size]} rounded-xl object-cover flex-shrink-0 shadow-md shadow-white/5 transition-transform duration-200 hover:scale-105 border border-[#262626]`}
      />

      {showWordmark && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-bold text-white tracking-tight text-[17px]">
              Ai
            </span>
          </div>
          {showTagline && (
            <span className="text-[10.5px] text-[#71717A] font-normal tracking-normal mt-0.5">
              Learn Smarter. Think Brighter.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Alias for backwards compatibility across existing imports
export const LumoraLogo = AiLogo;
export default AiLogo;
