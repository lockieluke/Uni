import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin, isNoSavedCredentialFoundResponse } from "@react-native-google-signin/google-signin";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import { getTierById } from "@uni/api";
import { CryptoDigestAlgorithm, digestStringAsync } from "expo-crypto";
import { getDefaultStore } from "jotai";
import * as _ from "radashi";
import Purchases from "react-native-purchases";
import { userAtom } from "@/lib/states";
import "react-native-url-polyfill/auto";
import { isTestFlight } from "expo-testflight";
import { getUrlSafeNonce } from "./crypto";
import { getUserAdditionalData } from "./user";

const supabaseUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}`;
const supabaseAnonKey = `${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		storage: AsyncStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false
	}
});

export async function refreshSignInState(options?: { session: Session; user: User }) {
	const lastSignInProvider = await AsyncStorage.getItem("lastSignInProvider");

	if (lastSignInProvider === "google") {
		// From: https://react-native-google-signin.github.io/docs/original#signinsilently
		const [err, response] = await _.tryit(GoogleSignin.signInSilently)();
		if (err || !response) throw new Error(`Error signing in silently: ${err.message}`);

		const token = response.data?.idToken;

		if (response.type === "success" && token) {
			await supabase.auth.signInWithIdToken({
				provider: "google",
				token
			});
		} else if (isNoSavedCredentialFoundResponse(response))
			// user has not signed in yet, or they have revoked access
			return false;
	}

	const { data, error } = await supabase.auth.getSession();
	if (error && _.isNullish(options?.session)) {
		console.error("Error getting user:", error);
		return false;
	}

	const session = options?.session ?? data.session;
	const user = options?.user ?? session?.user;
	const isSignedIn = !_.isNullish(user) && _.isString(session?.access_token);

	const defaultStore = getDefaultStore();

	defaultStore.set(userAtom, (prevUser) => ({
		...prevUser,
		signedIn: isSignedIn,
		user,
		accessToken: session?.access_token
	}));

	const email = user?.email;
	if (email && !isTestFlight)
		await Purchases.setAttributes({
			email
		});

	if (user) {
		if (!isTestFlight) {
			const { created } = await Purchases.logIn(user.id);
			const appUserId = await Purchases.getAppUserID();
			if (created) console.log(`Created new RevenueCat user with ID: ${appUserId}`);
			else console.log(`Logged in to RevenueCat with existing user ID: ${appUserId}`);

			await Purchases.syncPurchases();
		}

		const { tier, limits } = await getUserAdditionalData();
		if (isSignedIn) {
			defaultStore.set(userAtom, (prevUser) => ({
				...prevUser,
				tier: getTierById(tier),
				limits
			}));
		}
	}

	return isSignedIn;
}

export async function signOut() {
	const lastSignInProvider = await AsyncStorage.getItem("lastSignInProvider");

	try {
		await Promise.all([supabase.auth.signOut(), lastSignInProvider === "google" ? GoogleSignin.signOut() : async () => {}, Purchases.logOut()]);
	} catch (error) {
		console.error("Unable to sign out: ", _.get(error, "message", "unknown error"));
	}

	AsyncStorage.clear();
}

// From: https://react-native-google-signin.github.io/docs/security#custom-nonce
export async function getSignInNonce() {
	// `rawNonce` goes to Supabase's signInWithIdToken().
	// Supabase makes a hash of `rawNonce` and compares it with the `nonceDigest`
	// which is included in the ID token from RN-google-signin.
	const rawNonce = getUrlSafeNonce();
	// `nonceDigest` goes to the `nonce` parameter in RN-google-signin APIs
	const nonceDigest = await digestStringAsync(CryptoDigestAlgorithm.SHA256, rawNonce);
	return { rawNonce, nonceDigest };
}
