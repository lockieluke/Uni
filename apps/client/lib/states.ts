import { Language } from "@/lib/constants/Language";
import type { User } from "@supabase/auth-js";
import { atom } from "jotai";
import { UniTiers } from "@uni/api";

export const userAtom = atom<{
  signedIn: boolean;
  user?: User,
  accessToken?: string,
  tier: keyof typeof UniTiers
}>({
  signedIn: false,
  tier: "free"
});


export const languagesAtom = atom<{
  host: Language,
  guest: Language;
}>({
  host: {
    code: "en-GB",
    displayName: "English (UK)",
    flag: "🇬🇧"
  },
  guest: {
    code: "zh-HK",
    displayName: "Cantonese (Hong Kong)",
    flag: "🇭🇰"
  }
});

export const availableLanguagesAtom = atom<{
  [key: string]: Language;
}>({});

export const translationsAtom = atom<{
  host?: string;
  guest?: string;
}>();
