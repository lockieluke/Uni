import { Language } from "@/constants/Language";
import { useColorScheme } from "@/hooks/useColorScheme.web";
import { cn } from "@/lib/utils";
import { Skeleton } from 'moti/skeleton';
import { Text, View } from "react-native";

export default function TranslationText({ translating = false, revertEnabled, language, children }: {
    translating?: boolean,
    revertEnabled: boolean,
    language: Language,
    children: React.ReactNode
}) {
    const colorScheme = useColorScheme();

    return (
        <View className={"flex flex-col px-5 gap-5"}>
            <Text className={"text-t-primary text-lg"}>{language.displayName}</Text>
            <Skeleton
                width={"90%"}
                colorMode={colorScheme === "dark" ? "dark" : "light"}
                transition={{
                    type: "spring"
                }}
            >
                { translating ? null : <Text className={cn("text-t-primary font-semibold text-5xl text-left", {
                    "rotate-180": revertEnabled,
                })}>{children}</Text> }
            </Skeleton>
        </View>
    );
}
