import { useColorScheme } from '@/hooks/useColorScheme';
import { getLanguages } from '@/lib/language';
import { languagesAtom } from '@/lib/states';
import { mmkvStorage } from '@/lib/storage';
import { checkSignedIn } from "@/lib/supabase";
import Entypo from '@expo/vector-icons/Entypo';
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Image } from "expo-image";
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSetAtom } from 'jotai';
import { cssInterop } from "nativewind";
import { TouchableOpacity } from 'react-native';
import { useMMKVStorage } from 'react-native-mmkv-storage';
import 'react-native-reanimated';
import useAsyncEffect from "use-async-effect";
import "./global.css";
import { LinearGradient } from 'expo-linear-gradient';
import { AppleAuthenticationButton } from 'expo-apple-authentication';

cssInterop(Image, { className: "style" });
cssInterop(LinearGradient, { className: "style" });
cssInterop(AppleAuthenticationButton, { className: "style" });

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const router = useRouter();

    const setLanguages = useSetAtom(languagesAtom);
    const [hostLanguage, setHostLanguage] = useMMKVStorage("hostLanguage", mmkvStorage, "en-GB");
    const [guestLanguage, setGuestLanguage] = useMMKVStorage("guestLanguage", mmkvStorage, "zh-HK");

    GoogleSignin.configure({
        scopes: [],
        iosClientId: `${process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID}`
    });

    useAsyncEffect(async () => {
        const isSignedIn = await checkSignedIn();

        if (isSignedIn) {
            if (!hostLanguage)
                setHostLanguage("en-GB");

            if (!guestLanguage)
                setGuestLanguage("zh-HK");

            if (hostLanguage && guestLanguage) {
                const supportedLanguages = await getLanguages();
                setLanguages({
                    host: supportedLanguages[hostLanguage],
                    guest: supportedLanguages[guestLanguage]
                });
            }
        }

        if (!isSignedIn)
            router.replace("/sign-in");
    }, []);

    return (
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack initialRouteName="(tabs)">
                <Stack.Screen name="(tabs)" options={{
                    headerShown: false,
                    animation: "none"
                }} />
                <Stack.Screen
                    name="languages"
                    options={{
                        presentation: "modal",
                        title: "Languages",
                        headerLeft: ({ canGoBack }) => {
                            if (!canGoBack)
                                return null;

                            return (
                                <TouchableOpacity onPress={() => router.back()}>
                                    <Entypo name="chevron-down" size={24} color={colorScheme === "dark" ? "white" : "black"} />
                                </TouchableOpacity>
                            )
                        }
                    }}
                />
                <Stack.Screen name="sign-in" options={{
                    headerShown: false,
                    gestureEnabled: false,
                    animation: "none"
                }} />
                <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
        </ThemeProvider>
    );
}
