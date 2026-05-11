export default function Logo({ dark = false, size = 'md' }) {
  const sizes = { sm: { icon: 28, title: 'text-base', sub: 'text-[8px]' }, md: { icon: 36, title: 'text-xl', sub: 'text-[9px]' }, lg: { icon: 44, title: 'text-2xl', sub: 'text-[10px]' } };
  const s = sizes[size] || sizes.md;
  const textColor = dark ? 'text-white' : 'text-navy-900';
  const subColor = dark ? 'text-blue-200' : 'text-navy-500';

  return (
    <div className="flex items-center gap-2.5">
      <svg width={s.icon} height={s.icon} viewBox="0 0 44 44" fill="none">
        <rect width="44" height="44" rx="8" fill={dark ? 'rgba(255,255,255,0.15)' : '#0f2057'} />
        <path d="M22 8L34 13V22C34 28.627 28.627 35 22 36C15.373 35 10 28.627 10 22V13L22 8Z" fill="none" stroke={dark ? 'white' : '#22c55e'} strokeWidth="2" strokeLinejoin="round"/>
        <path d="M17 22L20.5 25.5L27 19" stroke={dark ? 'white' : '#22c55e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div>
        <div className={`font-bold leading-tight ${s.title} ${textColor}`}>LexProtect</div>
        <div className={`font-semibold tracking-widest uppercase ${s.sub} ${subColor}`}>Legal Compliance</div>
      </div>
    </div>
  );
}
