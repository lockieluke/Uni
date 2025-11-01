import { Language } from "@/constants/Language";
import { cn } from "@/lib/utils";
import { useRouter } from "expo-router";
import { Skeleton } from 'moti/skeleton';
import { Text, TouchableOpacity, useColorScheme, View } from "react-native";

export default function TranslationText({ translating = false, revertEnabled, language, children }: {
  translating?: boolean,
  revertEnabled: boolean,
  language: Language,
  children: React.ReactNode
}) {
  const router = useRouter();
  const colorScheme = useColorScheme();

  return (
    <View className={"flex flex-col px-5 gap-5 h-36"}>
      <TouchableOpacity onPress={() => {
        router.push("/languages");
      }}>
        <Text className={"text-t-primary text-lg"}>{language.displayName}</Text>
      </TouchableOpacity>
      <Skeleton
        width={"90%"}
        colorMode={colorScheme === "dark" ? "dark" : "light"}
        transition={{
          type: "spring"
        }}
      >
        {translating ? null : <Text className={cn("text-t-primary font-semibold text-5xl text-left", {
          "rotate-180": revertEnabled,
        })}>{children}</Text>}
      </Skeleton>
    </View>
  );
}
