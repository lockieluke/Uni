import { useColorScheme } from '@/hooks/useColorScheme';
import { checkSignedIn } from "@/lib/supabase";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Image } from "expo-image";
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { cssInterop } from "nativewind";
import 'react-native-reanimated';
import useAsyncEffect from "use-async-effect";
import "./global.css";

cssInterop(Image, { className: "style" });

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const router = useRouter();

    GoogleSignin.configure({
        scopes: [],
        iosClientId: `${process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID}`
    });

    useAsyncEffect(async () => {
        const isSignedIn = await checkSignedIn();

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
                <Stack.Screen name="sign-in" options={{
                    headerShown: false,
                    gestureEnabled: false,
                    animation: "none"
                }} />
                <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto"/>
        </ThemeProvider>
    );
}
