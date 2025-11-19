import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { useMMKVStorage } from "react-native-mmkv-storage";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { languagesAtom, translationsAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";

export default function TranslateHeader({ children }: { children: React.ReactNode }) {
	const [flipGuestLanguage] = useMMKVStorage("flipGuestLang", mmkvStorage, false);
	const translations = useAtomValue(translationsAtom);
	const languages = useAtomValue(languagesAtom);
	const [disclaimerState, setDisclaimerState] = useState<"host" | "guest">("host");

	const showDisclaimers = translations?.host && translations?.guest;
	const opacity = useSharedValue(1);

	const style = useAnimatedStyle(() => ({
		opacity: showDisclaimers
			? withTiming(
					opacity.value,
					{
						duration: 1000,
						easing: Easing.inOut(Easing.ease)
					},
					(finished) => {
						if (finished && opacity.value === 0) runOnJS(setDisclaimerState)(disclaimerState === "host" ? "guest" : "host");
					}
				)
			: 1
	}));

	useEffect(() => {
		const timer = setInterval(() => {
			opacity.value = opacity.value === 0 ? 1 : 0;
		}, 2000);

		return () => {
			clearInterval(timer);
		};
	}, [opacity]);

	const disclaimer = languages[disclaimerState].disclaimer?.replace("{{PRODUCT_NAME}}", "Uni Translate");

	return (
		<Animated.View
			style={[
				style,
				{
					transform: [
						{
							rotate: `${disclaimerState === "guest" && flipGuestLanguage ? 180 : 0}deg`
						}
					]
				}
			]}
		>
			<Text className="text-t-primary text-lg">
				{showDisclaimers ? (
					<Text>{disclaimer}</Text>
				) : (
					<>
						<Text className="font-bold">Uni</Text> {children}
					</>
				)}
			</Text>
		</Animated.View>
	);
}
