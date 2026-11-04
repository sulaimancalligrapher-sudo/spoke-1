import React from 'react';
import {
  Youtube,
  Facebook,
  Instagram,
  Twitter,
  Globe,
  Send,
  Phone,
} from 'lucide-react';

interface SocialIconProps {
  iconKey: string;
  className?: string;
}

/**
 * Standardized Social Icon component supporting brand colors & icons
 * Key names for user sheet: line, facebook, instagram, youtube, twitter (or x), whatsapp, telegram, tiktok, web
 */
export const SocialIcon: React.FC<SocialIconProps> = ({ iconKey, className = 'w-5 h-5' }) => {
  const normalizedKey = (iconKey || '').trim().toLowerCase();

  switch (normalizedKey) {
    case 'line':
      // Official LINE app icon SVG
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C6.48 2 2 5.92 2 10.75c0 4.3 3.6 7.9 8.47 8.63.33.07.78.22.89.51.1.26.07.67.03.93l-.15.93c-.05.29-.22 1.13.99.62 1.21-.52 6.54-3.85 8.93-6.59C22.42 14.16 22 12.51 22 10.75 22 5.92 17.52 2 12 2zm-4.7 11.23h-1.6c-.28 0-.5-.22-.5-.5V8.58c0-.28.22-.5.5-.5h1.6c.28 0 .5.22.5.5v4.15c0 .28-.22.5-.5.5zm3.17 0h-1.6c-.28 0-.5-.22-.5-.5V8.58c0-.28.22-.5.5-.5h.5c.28 0 .5.22.5.5v3.65h1.1c.28 0 .5.22.5.5s-.22.5-.5.5zm3.62 0h-.63c-.18 0-.34-.09-.43-.24l-2-2.88v2.62c0 .28-.22.5-.5.5h-.5c-.28 0-.5-.22-.5-.5V8.58c0-.28.22-.5.5-.5h.63c.18 0 .34.09.43.24l2 2.88V8.58c0-.28.22-.5.5-.5h.5c.28 0 .5.22.5.5v4.15c0 .28-.22.5-.5.5zm3.68-3.15h-1.6v.77h1.6c.28 0 .5.22.5.5s-.22.5-.5.5h-2.1c-.28 0-.5-.22-.5-.5V8.58c0-.28.22-.5.5-.5h2.1c.28 0 .5.22.5.5s-.22.5-.5.5h-1.6v.77h1.6c.28 0 .5.22.5.5s-.22.5-.5.5z" />
        </svg>
      );

    case 'facebook':
    case 'fb':
    case 'فيسبوك':
      return <Facebook className={className} />;

    case 'instagram':
    case 'insta':
    case 'انستقرام':
    case 'انستغرام':
      return <Instagram className={className} />;

    case 'youtube':
    case 'yt':
    case 'يوتيوب':
      return <Youtube className={className} />;

    case 'x':
    case 'twitter':
    case 'تويتر':
      // Official X (Twitter) icon SVG
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );

    case 'whatsapp':
    case 'واتساب':
    case 'واتس':
      return <Phone className={className} />;

    case 'telegram':
    case 'تليجرام':
    case 'تيليجرام':
      return <Send className={className} />;

    case 'tiktok':
    case 'تيك توك':
    case 'تيكتوك':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      );

    case 'web':
    case 'globe':
    case 'site':
    case 'رابط':
    case 'موقع':
    default:
      return <Globe className={className} />;
  }
};

/**
 * Brand color classes helper for attractive social buttons
 */
export function getSocialBrandClasses(iconKey: string): {
  bg: string;
  hover: string;
  text: string;
  border: string;
} {
  const key = (iconKey || '').trim().toLowerCase();
  switch (key) {
    case 'line':
      return {
        bg: 'bg-emerald-500/10',
        hover: 'hover:bg-emerald-500 hover:text-white',
        text: 'text-emerald-600',
        border: 'border-emerald-300',
      };
    case 'facebook':
    case 'fb':
    case 'فيسبوك':
      return {
        bg: 'bg-blue-600/10',
        hover: 'hover:bg-blue-600 hover:text-white',
        text: 'text-blue-600',
        border: 'border-blue-300',
      };
    case 'instagram':
    case 'insta':
    case 'انستقرام':
    case 'انستغرام':
      return {
        bg: 'bg-rose-500/10',
        hover: 'hover:bg-linear-to-tr hover:from-amber-500 hover:via-rose-600 hover:to-purple-600 hover:text-white',
        text: 'text-rose-600',
        border: 'border-rose-300',
      };
    case 'youtube':
    case 'yt':
    case 'يوتيوب':
      return {
        bg: 'bg-red-600/10',
        hover: 'hover:bg-red-600 hover:text-white',
        text: 'text-red-600',
        border: 'border-red-300',
      };
    case 'x':
    case 'twitter':
    case 'تويتر':
      return {
        bg: 'bg-slate-900/10',
        hover: 'hover:bg-slate-900 hover:text-white',
        text: 'text-slate-900',
        border: 'border-slate-300',
      };
    case 'whatsapp':
    case 'واتساب':
      return {
        bg: 'bg-emerald-600/10',
        hover: 'hover:bg-emerald-600 hover:text-white',
        text: 'text-emerald-600',
        border: 'border-emerald-300',
      };
    case 'telegram':
    case 'تليجرام':
      return {
        bg: 'bg-sky-500/10',
        hover: 'hover:bg-sky-500 hover:text-white',
        text: 'text-sky-600',
        border: 'border-sky-300',
      };
    case 'tiktok':
    case 'تيك توك':
      return {
        bg: 'bg-slate-900/10',
        hover: 'hover:bg-slate-950 hover:text-white',
        text: 'text-slate-900',
        border: 'border-slate-300',
      };
    default:
      return {
        bg: 'bg-slate-100',
        hover: 'hover:bg-slate-700 hover:text-white',
        text: 'text-slate-600',
        border: 'border-slate-200',
      };
  }
}
