import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { useAssets } from "expo-asset";
import * as Clipboard from "expo-clipboard";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAtom, useSetAtom } from "jotai";
import { RESET } from "jotai/utils";
import { MotiProgressBar } from "moti";
import * as _ from "radashi";
import { When } from "react-if";
import { ScrollView, Switch, Text, View } from "react-native";
import { ReactNativeLegal } from "react-native-legal";
import { useMMKVStorage } from "react-native-mmkv-storage";
import Purchases from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { SafeAreaView } from "react-native-safe-area-context";
import ColumnTrigger from "@/lib/components/ColumnTrigger";
import DevServerSetting from "@/lib/components/DevServerSetting";
import TierBadge from "@/lib/components/TierBadge";
import { availableLanguagesAtom, translationsAtom, userAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";
import { signOut } from "@/lib/supabase";
import { requestPurchaseFulfillment } from "@/lib/user";

export default function YouScreen() {
	const router = useRouter();

	const [assets, error] = useAssets([require("@/assets/images/user.jpg")]);
	const [{ signedIn, user, accessToken, tier, limits }, setUser] = useAtom(userAtom);
	const setTranslations = useSetAtom(translationsAtom);
	const setAvailableLanguages = useSetAtom(availableLanguagesAtom);

	const [flipGuestLanguage, setFlipGuestLanguage] = useMMKVStorage("flipGuestLang", mmkvStorage, false);
	const [disableCache, setDisableCache] = useMMKVStorage("disableCache", mmkvStorage, false);
	const [liquidGlassEnabled, setLiquidGlassEnabled] = useMMKVStorage("liquidGlassEnabled", mmkvStorage, isLiquidGlassAvailable());

	if (error || !assets || !user || !signedIn) return null;

	const { speech_translation } = limits;

	const defaultProfilePicture = assets[0].localUri;
	const userMetadata = user.user_metadata;
	const provider = user.app_metadata.provider;

	if (!defaultProfilePicture) return null;

	return (
		<SafeAreaView edges={["top", "left", "right"]} className={"flex-1 items-center gap-y-3 bg-white dark:bg-black"}>
			<View>
				<Image
					className="my-5 w-36 aspect-square rounded-full"
					source={{
						uri: _.get(userMetadata, "avatar_url", defaultProfilePicture)
					}}
				/>

				<TierBadge tier={tier} className="absolute bottom-0 right-0" />
			</View>
			<Text className="text-t-primary text-3xl font-bold">{_.get(userMetadata, "full_name") ?? (provider === "apple" ? "Apple ID User" : "")}</Text>
			<Text className="text-t-primary">{user.email}</Text>

			<ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="flex-center my-5 gap-y-5 pb-5">
				<ColumnTrigger
					onPress={async () => {
						const [err, result] = await _.tryit(RevenueCatUI.presentPaywall)();
						if (result === PAYWALL_RESULT.CANCELLED) return;

						if (err) {
							console.error("Purchase failed or cancelled", err.message);
							return;
						}

						if (result === PAYWALL_RESULT.PURCHASED)
							try {
								await requestPurchaseFulfillment();
							} catch (err) {
								if (err instanceof AxiosError) {
									console.error("Error requesting purchase fulfillment:", _.get(err.response?.data, "error.message", "unknown error"));
								}
							}
					}}
				>
					<View className="w-full flex-center flex-col gap-3">
						<Text className="self-start text-t-primary">
							Usage Limits ({speech_translation.usage}/
							{speech_translation.monthly_limit === Number.MAX_SAFE_INTEGER ? (
								<Text className="font-bold text-xl"> ∞</Text>
							) : (
								speech_translation.monthly_limit
							)}
							)
						</Text>
						<MotiProgressBar
							height={8}
							progress={speech_translation.usage / speech_translation.monthly_limit}
							color="#9334E9"
							containerColor="white"
						/>
						<Text className="my-2 font-bold text-purple-600">Upgrade Now</Text>
					</View>
				</ColumnTrigger>
				<ColumnTrigger
					onPress={async () => {
						await Purchases.showManageSubscriptions();
					}}
				>
					<Text className="text-t-primary">Manage Subscription</Text>
				</ColumnTrigger>
				<ColumnTrigger>
					<View className={"flex-col flex items-start w-2/3 gap-2"}>
						<Text className="font-semibold texT-md text-t-primary">Flip Guest Language</Text>
						<Text className="text-t-primary">Guest transcription would be turned towards the top of the phone</Text>
					</View>
					<Switch value={flipGuestLanguage} onValueChange={setFlipGuestLanguage} />
				</ColumnTrigger>
				<DevServerSetting />
				<When condition={__DEV__}>
					<When condition={isLiquidGlassAvailable()}>
						<ColumnTrigger>
							<Text className="text-t-primary font-semibold text-md">Use Liquid Glass</Text>
							<Switch value={liquidGlassEnabled} onValueChange={setLiquidGlassEnabled} />
						</ColumnTrigger>
					</When>
					<ColumnTrigger
						onPress={async () => {
							if (accessToken) await Clipboard.setStringAsync(accessToken);
						}}
					>
						Copy JWT
					</ColumnTrigger>
					<ColumnTrigger>
						<Text className="text-t-primary font-semibold text-md">Disable Cache</Text>
						<Switch value={disableCache} onValueChange={setDisableCache} />
					</ColumnTrigger>
				</When>
				<ColumnTrigger
					onPress={() => {
						ReactNativeLegal.launchLicenseListScreen("Licences");
					}}
					subpage
				>
					Licences
				</ColumnTrigger>
				<ColumnTrigger
					onPress={async () => {
						setUser(RESET);
						setTranslations(RESET);
						setAvailableLanguages(RESET);

						await Promise.all([AsyncStorage.removeItem("lastSignInProvider"), signOut()]);

						router.push("/sign-in");
					}}
				>
					Sign Out
				</ColumnTrigger>
			</ScrollView>
		</SafeAreaView>
	);
}
