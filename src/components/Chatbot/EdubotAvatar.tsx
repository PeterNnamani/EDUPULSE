import EduPulseChatIcon from './EduPulseChatIcon';

type EdubotAvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE: Record<EdubotAvatarSize, { box: string; icon: string; ring: string }> = {
  xs: { box: 'h-7 w-7', icon: 'h-3.5 w-3.5', ring: 'ring-1' },
  sm: { box: 'h-8 w-8', icon: 'h-4 w-4', ring: 'ring-1' },
  md: { box: 'h-10 w-10', icon: 'h-5 w-5', ring: 'ring-2' },
  lg: { box: 'h-14 w-14', icon: 'h-7 w-7', ring: 'ring-2' },
};

interface EdubotAvatarProps {
  size?: EdubotAvatarSize;
  showOnline?: boolean;
  className?: string;
}

export default function EdubotAvatar({ size = 'md', showOnline = false, className = '' }: EdubotAvatarProps) {
  const s = SIZE[size];

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${s.box} ${s.ring} flex items-center justify-center rounded-full bg-neutral-950 text-white ring-neutral-200 dark:bg-white dark:text-neutral-950 dark:ring-neutral-700`}
      >
        <EduPulseChatIcon className={s.icon} variant={size === 'lg' ? 'fab' : 'mark'} />
      </div>
      {showOnline && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-neutral-950"
          aria-hidden
        />
      )}
    </div>
  );
}
