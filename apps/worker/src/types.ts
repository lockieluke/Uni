import { SupabaseClient, User } from "@supabase/supabase-js";
import { Database } from "./database.types";

type HonoBindings = {
    OPENROUTER_API_KEY: string;
    OPENAI_API_KEY: string;
    OPENAI_API_BASE: string;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_ADMIN_KEY: string;
    DEV: boolean;
    TRANSLATION_DISCLAIMERS: KVNamespace;
    TRANSLATION_LANGUAGES: KVNamespace;
    BEFORE_USER_CREATED_HOOK_SECRET: string;
};

type HonoVariables = {
    user: User;
    supabase: SupabaseClient<Database>;
};

export type THono = {
    Bindings: HonoBindings;
    Variables: HonoVariables;
};

export type SupabaseWebhookPayload<T = never> = {
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    schema: string;
    record: T;
    old_record?: T;
};
