import DevServerSetting from "@/components/DevServerSetting";
import { userAtom } from "@/lib/states";
import { getSignInNonce, supabase } from "@/lib/supabase";
import AntDesign from '@expo/vector-icons/AntDesign';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { usePreventRemove } from "@react-navigation/core";
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from "expo-image";
import { Link, useNavigationContainerRef, useRouter } from "expo-router";
import { useAtom } from "jotai";
import * as _ from "radashi";
import { Text, TouchableOpacity, useColorScheme, View } from "react-native";

export default function SignIn() {
  const rootNavigation = useNavigationContainerRef();

  const colorScheme = useColorScheme();
  const router = useRouter();

  const [user, setUser] = useAtom(userAtom);
  usePreventRemove(!user.signedIn, ({ data }) => {

  });

  return (<View className={"flex-1 flex-center gap-6 bg-white dark:bg-black"}>
    <View className="flex-center gap-5">
      <Image className={"w-28 shadow-xl rounded-3xl aspect-square"} source={require("@/assets/images/icon.png")} />

      <Text className="text-2xl text-t-primary font-bold">Communicate without limits.</Text>
    </View>

    <TouchableOpacity
      activeOpacity={0.8}
      className={"flex-center flex-row gap-5 bg-blue-500 w-64 py-5 rounded-lg"}
      onPress={async () => {
        try {
          await GoogleSignin.hasPlayServices();

          const { nonceDigest, rawNonce } = await getSignInNonce();

          const response = await GoogleSignin.signIn({
            nonce: nonceDigest
          } as any);

          if (isSuccessResponse(response)) {
            const { data: { session, user }, error } = await supabase.auth.signInWithIdToken({
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

            await AsyncStorage.setItem("lastSignInProvider", "google");

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

    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={colorScheme === "light" ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={5}
      className="w-64 h-12"
      onPress={async () => {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (!isAvailable) {
          console.error("Apple Authentication is not available on this device");
          return;
        }

        const [err, credentials] = await _.tryit(AppleAuthentication.signInAsync)({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL
          ]
        });
        if (err) {
          if (_.get(err, "code") === "ERR_CANCELED") {
            console.log("User cancelled the sign-in request");
            return;
          }
          console.error("Error signing in with Apple", err.message);
          return;
        }

        if (!credentials.identityToken) {
          console.error("No identity token received from Apple");
          return;
        }

        const accessToken = credentials.authorizationCode;
        if (!accessToken) {
          console.error("No authorization code received from Apple");
          return;
        }

        const { error, data: { user } } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credentials.identityToken
        });
        if (error || !user) {
          console.error("Error signing in with Apple", error?.message);
          return;
        }

        setUser({
          signedIn: true,
          user: user,
          accessToken,
          tier: "free"
        });

        await AsyncStorage.setItem("lastSignInProvider", "apple");

        console.log("User signed in with Apple", user.email);
        rootNavigation.reset({
          routes: [{ name: "(tabs)" }],
        });
        router.replace("/(tabs)");
      }}
    />

    {__DEV__ && <DevServerSetting />}

    <Text className="text-gray-500">a <Link className="text-t-primary" href={"https://lockie.dev"}>lockie.dev</Link> product</Text>
  </View>)
}
