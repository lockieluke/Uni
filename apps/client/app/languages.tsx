import Ionicons from "@expo/vector-icons/Ionicons";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "expo-router";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { Text, useColorScheme, View } from "react-native";
import ColumnTrigger from "@/lib/components/ColumnTrigger";
import {
	availableLanguagesAtom,
	languagesAtom,
	translationsAtom,
} from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";

export default function LanguagesScreen() {
	const colorScheme = useColorScheme();

	const [languages, setLanguages] = useAtom(languagesAtom);
	const availableLanguages = useAtomValue(availableLanguagesAtom);
	const setTranslations = useSetAtom(translationsAtom);
	const [selectMode, setSelectMode] = useState<"host" | "guest">("host");

	useFocusEffect(() => {
		return () => {
			setTranslations({});
		};
	});

	return (
		<View className="flex-1 justify-start items-center">
			<View className="w-screen h-full">
				<FlashList
					data={Object.entries(availableLanguages)}
					extraData={Object.entries(availableLanguages)}
					renderItem={({ item }) => {
						const languageCode = item[1].code;
						return (
							<ColumnTrigger
								className="w-80% my-2"
								onPress={async () => {
									if (
										languages.host?.code === languageCode ||
										languages.guest?.code === languageCode
									)
										return;

									if (selectMode === "host") {
										await mmkvStorage.setStringAsync(
											"hostLanguage",
											languageCode,
										);
										setLanguages((prevLanguages) => ({
											...prevLanguages,
											host: item[1],
										}));
									}

									if (selectMode === "guest") {
										await mmkvStorage.setStringAsync(
											"guestLanguage",
											languageCode,
										);
										setLanguages((prevLanguages) => ({
											...prevLanguages,
											guest: item[1],
										}));
									}

									setSelectMode((prevSelectMode) =>
										prevSelectMode === "host" ? "guest" : "host",
									);
								}}
							>
								<View className="flex flex-row w-full justify-between items-center h-10">
									<Text className="text-t-primary">{`${item[1].flag ? `${item[1].flag} ` : ""}${item[1].displayName}`}</Text>

									{(languages.host?.code === languageCode ||
										languages.guest?.code === languageCode) && (
										<Ionicons
											name="checkmark-outline"
											size={24}
											color={colorScheme === "dark" ? "white" : "black"}
										/>
									)}
								</View>
							</ColumnTrigger>
						);
					}}
					keyExtractor={(item) => item[0]}
					contentContainerClassName="px-5 py-3"
					contentContainerStyle={{
						paddingHorizontal: 20,
					}}
				/>
			</View>
		</View>
	);
}
