import type { User } from "@supabase/auth-js";
import type { TLanguageSchema, UniTiers, UserMetadataSchema } from "@uni/api";
import { atom } from "jotai";
import { atomWithReset } from "jotai/utils";
import type { z } from "zod/v4";

export const userAtom = atomWithReset<{
	signedIn: boolean;
	user?: User;
	accessToken?: string;
	tier: keyof typeof UniTiers;
	limits: z.infer<typeof UserMetadataSchema.shape.limits>;
}>({
	signedIn: false,
	tier: "free",
	limits: {
		speech_translation: {
			monthly_limit: 0,
			usage: 0
		}
	}
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

export const availableLanguagesAtom = atomWithReset<{
	[key: string]: TClientLanguage;
}>({});

export const translationsAtom = atomWithReset<{
	host?: string;
	guest?: string;
	title: { [key: string]: string };
	conversation: { [key: string]: string }[];
}>({
	title: {},
	conversation: []
});
