import Entypo from "@expo/vector-icons/Entypo";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider
} from "@react-navigation/native";
import { AudioRecorderProvider } from "@siteed/expo-audio-studio";
import { AppleAuthenticationButton } from "expo-apple-authentication";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { VideoView } from "expo-video";
import { useSetAtom } from "jotai";
import { cssInterop } from "nativewind";
import { Pressable, TouchableOpacity, useColorScheme } from "react-native";
import { useMMKVStorage } from "react-native-mmkv-storage";
import { useAsyncEffect } from "@/lib/hooks";
import { getLanguages } from "@/lib/language";
import { availableLanguagesAtom, languagesAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";
import { checkSignedIn } from "@/lib/supabase";
import "react-native-reanimated";
import "./global.css";

cssInterop(Image, { className: "style" });
cssInterop(LinearGradient, { className: "style" });
cssInterop(AppleAuthenticationButton, { className: "style" });
cssInterop(VideoView, { className: "style" });
cssInterop(GlassView, { className: "style" });

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const router = useRouter();

	const setLanguages = useSetAtom(languagesAtom);
	const setAvailableLanguages = useSetAtom(availableLanguagesAtom);
	const [hostLanguage, setHostLanguage] = useMMKVStorage(
		"hostLanguage",
		mmkvStorage,
		"en-GB"
	);
	const [guestLanguage, setGuestLanguage] = useMMKVStorage(
		"guestLanguage",
		mmkvStorage,
		"zh-HK"
	);
	const [liquidGlassEnabled] = useMMKVStorage(
		"liquidGlassEnabled",
		mmkvStorage,
		isLiquidGlassAvailable()
	);

	GoogleSignin.configure({
		scopes: [],
		iosClientId: `${process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID}`
	});

	useAsyncEffect(async () => {
		const isSignedIn = await checkSignedIn();

		if (isSignedIn) {
			const supportedLanguages = await getLanguages();
			setAvailableLanguages(supportedLanguages);

			if (!hostLanguage) setHostLanguage("en-GB");

			if (!guestLanguage) setGuestLanguage("zh-HK");

			if (hostLanguage && guestLanguage) {
				setLanguages({
					host: supportedLanguages[hostLanguage],
					guest: supportedLanguages[guestLanguage]
				});
			}
		} else {
			SplashScreen.hide();
			router.replace("/sign-in");
		}
	}, []);

	return (
		<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
			<AudioRecorderProvider
				config={
					{
						// logger: console
					}
				}
			>
				<Stack initialRouteName="(tabs)">
					<Stack.Screen
						name="(tabs)"
						options={{
							headerShown: false,
							animation: "none"
						}}
					/>
					<Stack.Screen
						name="languages"
						options={{
							presentation: "modal",
							title: "Languages",
							headerLeft: ({ canGoBack }) => {
								if (!canGoBack) return null;

								const Icon = () => (
									<Entypo
										name="chevron-down"
										className="text-center"
										size={24}
										color={colorScheme === "dark" ? "white" : "black"}
									/>
								);

								return liquidGlassEnabled ? (
									<Pressable className="px-5" onPress={() => router.back()}>
										<Icon />
									</Pressable>
								) : (
									<TouchableOpacity onPress={() => router.back()}>
										<Icon />
									</TouchableOpacity>
								);
							}
						}}
					/>
					<Stack.Screen
						name="sign-in"
						options={{
							headerShown: false,
							gestureEnabled: false,
							animation: "none"
						}}
					/>
					<Stack.Screen name="+not-found" />
				</Stack>
			</AudioRecorderProvider>
			<StatusBar style="auto" />
		</ThemeProvider>
	);
}
