import { useState } from 'react';
import { countryToFlagEmoji } from '../lib/device.ts';
import { getCountryNameAr, resolveVisibleCountryCode } from '../shared/countryFlag.ts';

function renderFlagSvg(code: string) {
  switch (code) {
    case 'SA':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="16" fill="#006C35" />
          <path d="M5 6.5h14M7 9.2h10" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M7.5 11.8h9" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    case 'AE':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="5.34" y="0" fill="#00732F" />
          <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
          <rect width="24" height="5.34" y="10.66" fill="#000000" />
          <rect width="6.5" height="16" x="0" fill="#FF0000" />
        </svg>
      );
    case 'IQ':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="5.34" y="0" fill="#CE1126" />
          <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
          <rect width="24" height="5.34" y="10.66" fill="#000000" />
          <path d="M8 8h8" stroke="#007A3D" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'KW':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="5.34" y="0" fill="#007A3D" />
          <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
          <rect width="24" height="5.34" y="10.66" fill="#CE1126" />
          <polygon points="0,0 7,5.33 7,10.66 0,16" fill="#000000" />
        </svg>
      );
    case 'QA':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="16" fill="#8D1B3D" />
          <polygon points="0,0 7,0 9,2 7,4 9,6 7,8 9,10 7,12 9,14 7,16 0,16" fill="#FFFFFF" />
        </svg>
      );
    case 'BH':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="16" fill="#CE1126" />
          <polygon points="0,0 6.5,0 9,2 6.5,4 9,6 6.5,8 9,10 6.5,12 9,14 6.5,16 0,16" fill="#FFFFFF" />
        </svg>
      );
    case 'OM':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="5.34" y="0" fill="#FFFFFF" />
          <rect width="24" height="5.34" y="5.33" fill="#DB161B" />
          <rect width="24" height="5.34" y="10.66" fill="#008000" />
          <rect width="7" height="16" x="0" fill="#DB161B" />
        </svg>
      );
    case 'EG':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="5.34" y="0" fill="#CE1126" />
          <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
          <rect width="24" height="5.34" y="10.66" fill="#000000" />
          <circle cx="12" cy="8" r="1.4" fill="#C09300" />
        </svg>
      );
    case 'JO':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="5.34" y="0" fill="#000000" />
          <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
          <rect width="24" height="5.34" y="10.66" fill="#007A3D" />
          <polygon points="0,0 10,8 0,16" fill="#CE1126" />
          <circle cx="3.4" cy="8" r="1.1" fill="#FFFFFF" />
        </svg>
      );
    case 'SY':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="5.34" y="0" fill="#007A3D" />
          <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
          <rect width="24" height="5.34" y="10.66" fill="#000000" />
          <circle cx="8" cy="8" r="1" fill="#CE1126" />
          <circle cx="12" cy="8" r="1" fill="#CE1126" />
          <circle cx="16" cy="8" r="1" fill="#CE1126" />
        </svg>
      );
    case 'LB':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="4" y="0" fill="#ED1C24" />
          <rect width="24" height="8" y="4" fill="#FFFFFF" />
          <rect width="24" height="4" y="12" fill="#ED1C24" />
          <polygon points="12,5 9.2,10.8 14.8,10.8" fill="#00A651" />
        </svg>
      );
    case 'YE':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="5.34" y="0" fill="#CE1126" />
          <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
          <rect width="24" height="5.34" y="10.66" fill="#000000" />
        </svg>
      );
    case 'PS':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="5.34" y="0" fill="#000000" />
          <rect width="24" height="5.34" y="5.33" fill="#FFFFFF" />
          <rect width="24" height="5.34" y="10.66" fill="#007A3D" />
          <polygon points="0,0 9.5,8 0,16" fill="#CE1126" />
        </svg>
      );
    case 'MA':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="16" fill="#C1272D" />
          <circle cx="12" cy="8" r="2.6" fill="none" stroke="#006233" strokeWidth="1.2" />
        </svg>
      );
    case 'DZ':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="12" height="16" x="0" fill="#006233" />
          <rect width="12" height="16" x="12" fill="#FFFFFF" />
          <circle cx="12" cy="8" r="2.8" fill="#D21034" />
          <circle cx="13" cy="8" r="2.1" fill="#FFFFFF" />
        </svg>
      );
    case 'TN':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="16" fill="#E70013" />
          <circle cx="12" cy="8" r="3.6" fill="#FFFFFF" />
          <circle cx="12" cy="8" r="2" fill="#E70013" />
        </svg>
      );
    case 'TR':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="16" fill="#E30A17" />
          <circle cx="10.5" cy="8" r="3.2" fill="#FFFFFF" />
          <circle cx="11.5" cy="8" r="2.5" fill="#E30A17" />
        </svg>
      );
    case 'US':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="16" fill="#FFFFFF" />
          <rect width="24" height="2" y="0" fill="#B22234" />
          <rect width="24" height="2" y="4" fill="#B22234" />
          <rect width="24" height="2" y="8" fill="#B22234" />
          <rect width="24" height="2" y="12" fill="#B22234" />
          <rect width="10" height="8" x="0" y="0" fill="#3C3B6E" />
        </svg>
      );
    case 'GB':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="16" fill="#012169" />
          <path d="M0 0L24 16M24 0L0 16" stroke="#FFFFFF" strokeWidth="2.5" />
          <path d="M12 0V16M0 8H24" stroke="#FFFFFF" strokeWidth="4" />
          <path d="M12 0V16M0 8H24" stroke="#C8102E" strokeWidth="2.2" />
        </svg>
      );
    case 'DE':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="24" height="5.34" y="0" fill="#000000" />
          <rect width="24" height="5.34" y="5.33" fill="#DD0000" />
          <rect width="24" height="5.34" y="10.66" fill="#FFCE00" />
        </svg>
      );
    case 'FR':
      return (
        <svg viewBox="0 0 24 16" className="size-full" aria-hidden="true">
          <rect width="8" height="16" x="0" fill="#002395" />
          <rect width="8" height="16" x="8" fill="#FFFFFF" />
          <rect width="8" height="16" x="16" fill="#ED2939" />
        </svg>
      );
    default:
      return null;
  }
}

export function CountryFlagBadge({
  country,
  hideCountryFlag,
  className = '',
}: {
  country?: string | null;
  hideCountryFlag?: boolean;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const code = resolveVisibleCountryCode({ country, hideCountryFlag });
  if (!code) return null;

  const svg = renderFlagSvg(code);
  const label = getCountryNameAr(code);

  if (svg) {
    return (
      <span
        data-testid="member-country-flag"
        data-country={code}
        title={label}
        aria-label={`علم ${label}`}
        className={`inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-white/20 shadow-xs ${className}`}
      >
        {svg}
      </span>
    );
  }

  if (!imgFailed) {
    return (
      <span
        data-testid="member-country-flag"
        data-country={code}
        title={label}
        aria-label={`علم ${label}`}
        className={`inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-white/20 shadow-xs ${className}`}
      >
        <img
          src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
          alt={`علم ${label}`}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      data-testid="member-country-flag"
      data-country={code}
      title={label}
      aria-label={`علم ${label}`}
      className={`inline-flex shrink-0 items-center justify-center rounded px-1 text-xs leading-none ${className}`}
    >
      {countryToFlagEmoji(code)}
    </span>
  );
}
