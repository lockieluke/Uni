import { userAtom } from "@/lib/states";
import { getSignInNonce, supabase } from "@/lib/supabase";
import AntDesign from '@expo/vector-icons/AntDesign';
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { usePreventRemove } from "@react-navigation/core";
import { Image } from "expo-image";
import { Link, useNavigationContainerRef, useRouter } from "expo-router";
import { useAtom } from "jotai";
import { Text, TouchableOpacity, View } from "react-native";

export default function SignIn() {
    const rootNavigation = useNavigationContainerRef();
    const router = useRouter();

    const [user, setUser] = useAtom(userAtom);
    usePreventRemove(!user.signedIn, ({ data }) => {

    });

    return (<View className={"flex-1 flex-center gap-8 bg-white dark:bg-black"}>
        <View className="flex-center gap-5">
            <Image className={"w-28 shadow-xl rounded-3xl aspect-square"} source={require("@/assets/images/icon.png")} />

            <Text className="text-2xl text-t-primary font-bold">Communicate without limits.</Text>
        </View>

        <TouchableOpacity
            activeOpacity={0.8}
            className={"flex-center flex-row gap-5 bg-blue-500 p-5 rounded-lg"}
            onPress={async () => {
                try {
                    await GoogleSignin.hasPlayServices();

                    const { nonceDigest, rawNonce } = await getSignInNonce();

                    const response = await GoogleSignin.signIn({
                        nonce: nonceDigest
                    } as any);

                    if (isSuccessResponse(response)) {
                        const { data: {session, user}, error } = await supabase.auth.signInWithIdToken({
                            provider: "google",
                            token: response.data.idToken!,
                            nonce: rawNonce
                        });

                        if (error || !user) {
                            console.error("Error signing in", error?.message);
                            return;
                        }

                        setUser({
                            signedIn: true,
                            user: user,
                            accessToken: session.access_token,
                            tier: "free"
                        });

                        console.log("User signed in", user.email);
                        rootNavigation.reset({
                            routes: [{ name: "(tabs)" }],
                        });
                        router.replace("/(tabs)");
                    } else {
                        console.error("No id token present");
                    }
                } catch (err) {
                    console.error("Error signing in", err);
                }

            }}
        >
            <AntDesign name="google" size={24} color="white" />
            <Text className={"text-white font-semibold"}>Sign In with Google</Text>
        </TouchableOpacity>

        <Text className="text-gray-500">a <Link className="text-t-primary" href={"https://lockie.dev"}>lockie.dev</Link> product</Text>
    </View>)
}
