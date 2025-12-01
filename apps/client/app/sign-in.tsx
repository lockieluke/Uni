import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { useIsFocused, usePreventRemove } from "@react-navigation/core";
import { useEventListener } from "expo";
import * as AppleAuthentication from "expo-apple-authentication";
import { Link, useNavigationContainerRef, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useAtom } from "jotai";
import * as _ from "radashi";
import { useEffect } from "react";
import { When } from "react-if";
import { AppState, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import DevServerSetting from "@/lib/components/DevServerSetting";
import { userAtom } from "@/lib/states";
import { getSignInNonce, refreshSignInState, supabase } from "@/lib/supabase";

export default function SignIn() {
	const rootNavigation = useNavigationContainerRef();

	const colorScheme = useColorScheme();
	const router = useRouter();
	const isFocused = useIsFocused();

	const [user, setUser] = useAtom(userAtom);

	const opacity = useSharedValue(0);
	const videoAnimatedStyle = useAnimatedStyle(() => ({
		opacity: withTiming(opacity.value, {
			duration: 1000
		})
	}));

	usePreventRemove(!user.signedIn, () => {});

	const player = useVideoPlayer(require("@/assets/images/uni_cover.mp4"), (player) => {
		player.loop = true;
		player.timeUpdateEventInterval = 1;
		player.play();
		opacity.value = 1;
	});

	useEventListener(player, "timeUpdate", async ({ currentTime }) => {
		if (currentTime === 0 && opacity.value === 0) {
			player.play();
			opacity.value = 1;
		}

		if (currentTime >= player.duration - 2 && opacity.value === 1) opacity.value = 0;
	});

	useEffect(() => {
		const focusCallback = () => {
			if (AppState.currentState === "active") player.play();
		};

		AppState.addEventListener("change", focusCallback);
	}, [player]);

	useEffect(() => {
		if (isFocused) player.play();
	}, [isFocused, player]);

	return (
		<View className="flex-1 bg-black">
			<Animated.View className="flex-1" style={videoAnimatedStyle}>
				<VideoView contentFit="fill" nativeControls={false} player={player} className="flex-1 scale-x-[2.3]" />
			</Animated.View>
			<View className="absolute flex-1 size-full items-center justify-end py-10 gap-5">
				<View className="absolute h-screen flex-1 flex gap-3 flex-center">
					<Text className="text-6xl text-white text-center shadow font-black">Uni</Text>
					<Text className="text-lg text-white text-center shadow font-bold">Communicate without limits.</Text>
				</View>

				<When condition={__DEV__}>
					<View className="absolute top-20 flex flex-col gap-5">
						<DevServerSetting />
					</View>
				</When>

				<TouchableOpacity
					activeOpacity={0.8}
					className={"flex-center flex-row gap-5 bg-blue-500 w-64 py-2.5 rounded-lg"}
					onPress={async () => {
						try {
							await GoogleSignin.hasPlayServices();

							const { nonceDigest, rawNonce } = await getSignInNonce();

							const response = await GoogleSignin.signIn({
								nonce: nonceDigest
							} as never);

							const token = response.data?.idToken;

							if (isSuccessResponse(response) && token) {
								const {
									data: { session, user },
									error
								} = await supabase.auth.signInWithIdToken({
									provider: "google",
									token,
									nonce: rawNonce
								});

								if (error || !user) {
									console.error("Error signing in", error?.message);
									return;
								}

								await AsyncStorage.setItem("lastSignInProvider", "google");

								await refreshSignInState();

								console.log("User signed in", user.email);
								rootNavigation.reset({
									routes: [{ name: "(tabs)" }]
								});
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
					buttonStyle={
						colorScheme === "light"
							? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
							: AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
					}
					cornerRadius={5}
					className="w-64 h-12"
					onPress={async () => {
						const isAvailable = await AppleAuthentication.isAvailableAsync();
						if (!isAvailable) {
							console.error("Apple Authentication is not available on this device");
							return;
						}

						const [err, credentials] = await _.tryit(AppleAuthentication.signInAsync)({
							requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL]
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

						const {
							error,
							data: { user }
						} = await supabase.auth.signInWithIdToken({
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

						await refreshSignInState();

						console.log("User signed in with Apple", user.email);
						rootNavigation.reset({
							routes: [{ name: "(tabs)" }]
						});
						router.replace("/(tabs)");
					}}
				/>

				<Text className="text-gray-300">
					a{" "}
					<Link className="text-white" href={"https://lockie.dev"}>
						lockie.dev
					</Link>{" "}
					product
				</Text>
			</View>
		</View>
	);
}
