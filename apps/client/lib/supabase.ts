import { userAtom } from "@/lib/states";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, isNoSavedCredentialFoundResponse } from "@react-native-google-signin/google-signin";
import { createClient } from '@supabase/supabase-js';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { getDefaultStore } from "jotai";
import * as _ from "radashi";
import 'react-native-url-polyfill/auto';
import { getUrlSafeNonce } from './crypto';

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

export async function checkSignedIn() {
  const lastSignInProvider = await AsyncStorage.getItem("lastSignInProvider");

  if (lastSignInProvider === "google") {
    // From: https://react-native-google-signin.github.io/docs/original#signinsilently
    const [err, response] = await _.tryit(GoogleSignin.signInSilently)();
    if (err)
      throw new Error(`Error signing in silently: ${err.message}`);

    if (isNoSavedCredentialFoundResponse(response))
      // user has not signed in yet, or they have revoked access
      return false;
    else if (response.type === "success") {
      await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.data?.idToken!
      });
    }
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Error getting user:", error);
    return false;
  }

  const user = session?.user;
  const isSignedIn = !_.isNullish(user);

  getDefaultStore().set(userAtom, prevUser => ({
    ...prevUser,
    signedIn: isSignedIn,
    user,
    accessToken: session?.access_token
  }));

  return isSignedIn;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error)
    throw new Error(error.message);

  const [err] = await _.tryit(GoogleSignin.signOut)();
  if (err)
    throw new Error(`Error signing out of Google: ${err}`);
}

// From: https://react-native-google-signin.github.io/docs/security#custom-nonce
export async function getSignInNonce() {
  // `rawNonce` goes to Supabase's signInWithIdToken().
  // Supabase makes a hash of `rawNonce` and compares it with the `nonceDigest`
  // which is included in the ID token from RN-google-signin.
  const rawNonce = getUrlSafeNonce();
  // `nonceDigest` goes to the `nonce` parameter in RN-google-signin APIs
  const nonceDigest = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  return { rawNonce, nonceDigest };
}
