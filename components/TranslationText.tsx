import {Text, View} from "react-native";
import {cn} from "@/lib/utils";
import {Language} from "@/constants/Language";

export default function TranslationText({ revertEnabled, language, children }: {
    revertEnabled: boolean,
    language: Language,
    children: React.ReactNode
}) {
    return (
        <View className={"flex flex-col px-5 gap-5"}>
            <Text className={"text-t-primary text-lg"}>{language.displayName}</Text>
            <Text className={cn("text-t-primary font-semibold text-5xl text-left", {
                "rotate-180": revertEnabled,
            })}>{children}</Text>
        </View>
    );
}
