'use client';

import React from 'react';

interface NotificationDisplayProps {
  message: string | null; // The message to display
  type?: 'info' | 'success' | 'warning' | 'error'; // Optional type for styling
}

const NotificationDisplay: React.FC<NotificationDisplayProps> = ({
  message,
  type = 'info', // Default to info style
}) => {
  if (!message) {
    return null; // Don't render anything if there's no message
  }

  // Basic styling based on type
  let baseClasses = "p-4 rounded-md text-sm font-medium";
  let typeClasses = "";

  switch (type) {
    case 'success':
      typeClasses = "bg-green-100 text-green-800";
      break;
    case 'warning':
      typeClasses = "bg-yellow-100 text-yellow-800";
      break;
    case 'error':
      typeClasses = "bg-red-100 text-red-800";
      break;
    case 'info':
    default:
      typeClasses = "bg-blue-100 text-blue-800";
      break;
  }

  return (
    <div className={`${baseClasses} ${typeClasses}`} role="alert">
      {message}
    </div>
  );
};

export default NotificationDisplay;