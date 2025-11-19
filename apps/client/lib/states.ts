import type { User } from "@supabase/auth-js";
import { TLanguageSchema, UniTiers } from "@uni/api";
import { atom } from "jotai";

export const userAtom = atom<{
  signedIn: boolean;
  user?: User,
  accessToken?: string,
  tier: keyof typeof UniTiers
}>({
  signedIn: false,
  tier: "free"
});

export type TClientLanguage = Omit<TLanguageSchema, "disclaimer" | "customPrompt" | "displayName"> & {
  code: string;
  displayName: string;
  disclaimer?: string;
};

export const languagesAtom = atom<Record<"host" | "guest", TClientLanguage>>({
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
  [key: string]: TClientLanguage;
}>({});

export const translationsAtom = atom<{
  host?: string;
  guest?: string;
}>();
