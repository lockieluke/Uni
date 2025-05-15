import ColumnTrigger from "@/components/ColumnTrigger";
import { Language } from "@/constants/Language";
import { getLanguages } from "@/lib/language";
import { languagesAtom } from "@/lib/states";
import { FlashList } from "@shopify/flash-list";
import { useAtom } from "jotai";
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from "react";
import { Text, View } from "react-native";
import useAsyncEffect from "use-async-effect";

export default function LanguagesScreen() {
    const [languages, setLanguages] = useAtom(languagesAtom);
    const [supportedLangs, setSupportedLangs] = useState<{
        [key: string]: Language;
    }>({});
    const [selectMode, setSelectMode] = useState<"host" | "guest">("host");

    useAsyncEffect(async () => {
        const languages = await getLanguages();
        setSupportedLangs(languages);
    }, []);

    return (<View className="flex-1 justify-start items-center">
        {/* {Object.entries(supportedLangs).map(([key, value]) => (
            <ColumnTrigger
                key={key}
                onPress={() => {
                    console.log(key);
                }}
            >{`${value.flag ? `${value.flag} ` : ""}${value.displayName}`}</ColumnTrigger>
        ))} */}

        <View className="w-screen h-full">
            <FlashList
                data={Object.entries(supportedLangs)}
                extraData={Object.entries(supportedLangs)}
                renderItem={({ item }) => (
                    <ColumnTrigger
                        className="w-80% my-2"
                        onPress={() => {
                            if (languages.host?.code === item[1].code || languages.guest?.code === item[1].code)
                                return;

                            if (selectMode === "host") {
                                setLanguages(prevLanguages => ({
                                    ...prevLanguages,
                                    host: item[1]
                                }));
                            }

                            if (selectMode === "guest") {
                                setLanguages(prevLanguages => ({
                                    ...prevLanguages,
                                    guest: item[1]
                                }));
                            }

                            setSelectMode(prevSelectMode => prevSelectMode === "host" ? "guest" : "host");
                        }}
                    >
                        <View className="flex flex-row w-full justify-between items-center h-10">
                            <Text>{`${item[1].flag ? `${item[1].flag} ` : ""}${item[1].displayName}`}</Text>

                            {(languages.host?.code === item[1].code || languages.guest?.code === item[1].code) &&
                                <Ionicons name="checkmark-outline" size={24} color="black" />
                            }
                        </View>
                    </ColumnTrigger>
                )}
                estimatedItemSize={50}
                keyExtractor={(item) => item[0]}
                contentContainerClassName="px-5 py-3"
                contentContainerStyle={{
                    paddingHorizontal: 20
                }}
            />
        </View>
    </View>);
}