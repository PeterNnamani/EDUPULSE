import type { SVGProps } from 'react';

interface EduPulseChatIconProps extends SVGProps<SVGSVGElement> {
  variant?: 'mark' | 'fab';
}

/** EduPulse chat mark — speech bubble + graduation cap + pulse dot */
export default function EduPulseChatIcon({
  variant = 'mark',
  className,
  ...props
}: EduPulseChatIconProps) {
  if (variant === 'fab') {
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden
        {...props}
      >
        <path
          d="M8 6h16a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-9.2L8 24.5V19H8a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M11 11.5 16 9l5 2.5v1.2L16 15l-5-2.3v-1.2Z"
          fill="currentColor"
          opacity="0.9"
        />
        <path
          d="M10.5 14.8c0 1.6 1.2 2.8 5.5 2.8s5.5-1.2 5.5-2.8"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="24.5" cy="7.5" r="2" fill="currentColor" />
        <path
          d="M24.5 9.5v2.5"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...props}
    >
      <path
        d="M5 4h14a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 19 17h-7.5L5 20.5V17H5A2.5 2.5 0 0 1 2.5 14.5v-8A2.5 2.5 0 0 1 5 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.5 8.5 12 7l3.5 1.5v.8L12 10.8 8.5 9.3v-.8Z" fill="currentColor" />
      <path
        d="M8 11.2c0 1.1.9 2 4 2s4-.9 4-2"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="18.5" cy="5.5" r="1.25" fill="currentColor" />
    </svg>
  );
}
