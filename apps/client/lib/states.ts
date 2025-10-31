import { Language } from "@/constants/Language";
import type { User } from "@supabase/auth-js";
import { atom } from "jotai";
import { z } from "zod/v4";
import { UserTierSchema } from "./user";

export const userAtom = atom<{
    signedIn: boolean;
    user?: User,
    accessToken?: string,
    tier: z.infer<typeof UserTierSchema>
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

export const translationsAtom = atom<{
    host?: string;
    guest?: string;
}>();