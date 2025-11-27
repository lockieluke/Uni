import { type MenuAction, MenuView } from "@react-native-menu/menu";
import { useRouter } from "expo-router";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { RESET } from "jotai/utils";
import { Skeleton } from "moti/skeleton";
import * as _ from "radashi";
import { useState } from "react";
import { Unless } from "react-if";
import { Dimensions, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { cn } from "@/lib/utils";
import { availableLanguagesAtom, languagesAtom, type TClientLanguage, translationsAtom } from "../states";

export default function TranslationText({
	title,
	translating = false,
	revertEnabled,
	language,
	children
}: {
	title: string;
	translating?: boolean;
	revertEnabled: boolean;
	language: TClientLanguage;
	children: React.ReactNode;
}) {
	const router = useRouter();
	const colorScheme = useColorScheme();

	const [languages, setLanguages] = useAtom(languagesAtom);
	const availableLanguages = useAtomValue(availableLanguagesAtom);
	const setTranslations = useSetAtom(translationsAtom);

	const [menuSize, setMenuSize] = useState<{ width: number; height: number }>({
		width: 0,
		height: 0
	});
	const [inLangMenu, setInLangMenu] = useState(false);

	const role = languages.guest.code === language.code ? "guest" : "host";
	const menuActions: MenuAction[] = Object.values(availableLanguages)
		.filter((lang) => (role !== "guest" ? languages.guest.code !== lang.code : languages.host.code !== lang.code))
		.map((lang) => ({
			title: `${lang.flag} ${lang.displayName}`,
			id: lang.code,
			state: lang.code === language.code ? "on" : "off"
		}));

	return (
		<View className={"flex flex-col px-5 h-36"}>
			<TouchableOpacity className="flex justfy-center items-start" onPress={() => {}}>
				<Text
					onLayout={(event) => {
						event.currentTarget.measureInWindow((_x, _y, width, height) => {
							setMenuSize({ width, height });
						});
					}}
					className={cn("text-t-primary text-lg", {
						"pointer-events-none text-transparent": inLangMenu
					})}
				>
					{language.displayName}
				</Text>
				<MenuView
					hitSlop={{
						top: 0,
						bottom: 0,
						left: 30,
						right: Dimensions.get("window").width
					}}
					style={{
						position: "absolute",
						display: "flex",
						justifyContent: "center",
						alignItems: "flex-start",
						width: menuSize.width,
						height: menuSize.height
					}}
					onOpenMenu={() => {
						setInLangMenu(true);
					}}
					onCloseMenu={() => {
						setInLangMenu(false);
					}}
					onPressAction={(event) => {
						const code = event.nativeEvent.event;
						const choosenLanguage = availableLanguages[code];

						setTranslations(RESET);

						if (code === "more_languages") {
							router.push("/languages");
							return;
						}

						if (role === "guest") {
							setLanguages((prevLanguages) => ({
								...prevLanguages,
								guest: choosenLanguage
							}));
						}

						if (role === "host") {
							setLanguages((prevLanguages) => ({
								...prevLanguages,
								host: choosenLanguage
							}));
						}
					}}
					actions={[
						...menuActions,
						{
							id: "more_languages",
							title: "More languages..."
						}
					]}
				/>
			</TouchableOpacity>
			<Unless condition={_.isEmpty(title)}>
				<Text className="text-zinc-700 dark:text-zinc-500 pb-3 pt-1">{title}</Text>
			</Unless>
			<Skeleton
				width={"90%"}
				colorMode={colorScheme === "dark" ? "dark" : "light"}
				transition={{
					type: "spring"
				}}
			>
				{translating ? null : (
					<Text
						className={cn("text-t-primary font-semibold text-5xl text-left", {
							"rotate-180": revertEnabled
						})}
					>
						{children}
					</Text>
				)}
			</Skeleton>
		</View>
	);
}
