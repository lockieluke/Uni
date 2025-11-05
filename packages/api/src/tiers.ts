import * as _ from "radashi";

export const UniTiers = {
    free: 0,
    basic: 1,
    max: 2
};

export const getTierById = (id: number) => _.invert(UniTiers)[id]!;

export const UniMonthlyLimits: {[key: string]: {
    [K in keyof typeof UniTiers]: number;
}} = {
    "speech_translation": {
        free: 25,
        basic: 3000,
        max: Number.MAX_SAFE_INTEGER,
    }
};
