import type { User } from "@supabase/auth-js";
import { atom } from "jotai";

export const userAtom = atom<{
    signedIn: boolean;
    user?: User,
    accessToken?: string,
}>({
    signedIn: false
});
