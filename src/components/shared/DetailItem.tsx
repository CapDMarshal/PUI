'use client';

import React from 'react';

interface DetailItemProps {
  icon?: React.ReactNode;
  iconImage?: string;
  iconBgColor?: string;
  iconColor?: string;
  title: string;
  description: React.ReactNode;
  actionText?: string;
  onActionClick?: () => void;
  className?: string;
}

export const DetailItem: React.FC<DetailItemProps> = ({
  icon,
  iconImage,
  iconBgColor = 'bg-gray-100',
  iconColor = 'text-gray-600',
  title,
  description,
  actionText,
  onActionClick,
  className = ''
}) => {
  return (
    <div className={`flex items-center space-x-3 p-4 bg-gray-50 rounded-xl border border-gray-200 ${className}`}>
      {/* Icon - Center aligned */}
      <div className="flex-shrink-0 self-center">
        <div className={`w-10 h-10 ${iconBgColor} rounded-lg flex items-center justify-center border border-gray-200`}>
          {iconImage ? (
            <img 
              src={iconImage} 
              alt={title}
              className="w-5 h-5 object-contain"
            />
          ) : icon ? (
            <div className={iconColor}>
              {icon}
            </div>
          ) : null}
        </div>
      </div>
      
      {/* Content - Flex 1 */}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      
      {/* Action Button - Center aligned */}
      {onActionClick && actionText && (
        <button
          onClick={onActionClick}
          className="flex-shrink-0 self-center px-2 py-1.5 text-sm font-medium text-black transition-colors border border-gray-300 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

export default DetailItem;
