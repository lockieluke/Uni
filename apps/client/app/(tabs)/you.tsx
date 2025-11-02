import ColumnTrigger from "@/lib/components/ColumnTrigger";
import DevServerSetting from "@/lib/components/DevServerSetting";
import TierBadge from "@/lib/components/TierBadge";
import { useAsyncEffect } from "@/lib/hooks";
import { userAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";
import { signOut } from "@/lib/supabase";
import { getUserAdditionalData } from "@/lib/user";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from 'expo-clipboard';
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAtom } from "jotai";
import * as _ from "radashi";
import { Unless } from "react-if";
import { Alert, ScrollView, Switch, Text, View } from "react-native";
import { useMMKVStorage } from "react-native-mmkv-storage";
import { SafeAreaView } from "react-native-safe-area-context";

export default function YouScreen() {
  const router = useRouter();

  const [{ signedIn, user, accessToken, tier }, setUser] = useAtom(userAtom);

  useAsyncEffect(async () => {
    const [err, additionalUserInfo] = await _.tryit(getUserAdditionalData)();
    if (err) {
      console.error("Error fetching user metadata:", err.message);
      return;
    }

    setUser(prevUser => ({
      ...prevUser,
      tier: additionalUserInfo.tier
    }));
  }, []);

  const [flipGuestLanguage, setFlipGuestLanguage] = useMMKVStorage("flipGuestLang", mmkvStorage, false);
  const [disableCache, setDisableCache] = useMMKVStorage("disableCache", mmkvStorage, false);
  const [liquidGlassEnabled, setLiquidGlassEnabled] = useMMKVStorage("liquidGlassEnabled", mmkvStorage, isLiquidGlassAvailable());

  if (!user || !signedIn)
    return null;

  const userMetadata = user.user_metadata;

  return (<SafeAreaView className={"flex-1 py-10 items-center gap-y-3 bg-white dark:bg-black"}>
    <View>
      <Image className="my-5 w-36 aspect-square rounded-full" source={{
        uri: _.get(userMetadata, "avatar_url")
      }} />

      <Unless condition={tier === "free"}>
        <TierBadge tier={tier} className="absolute bottom-0 right-0" />
      </Unless>
    </View>
    <Text className="text-t-primary text-3xl font-bold">{_.get(userMetadata, "full_name")}</Text>
    <Text className="text-t-primary">{user.email}</Text>

    <ScrollView contentContainerClassName="flex-center my-5 pb-20 gap-y-5">
      <ColumnTrigger>
        <>
          <View className={"flex-col flex items-start w-2/3 gap-2"}>
            <Text className="font-semibold texT-md text-t-primary">Flip Guest Language</Text>
            <Text className="text-t-primary">Guest transcription would be turned towards the top of the phone</Text>
          </View>
          <Switch value={flipGuestLanguage} onValueChange={setFlipGuestLanguage} />
        </>
      </ColumnTrigger>
      {__DEV__ && <DevServerSetting />}
      {__DEV__ && isLiquidGlassAvailable() && <ColumnTrigger>
        <>
          <Text className="text-t-primary font-semibold text-md">Use Liquid Glass</Text>
          <Switch value={liquidGlassEnabled} onValueChange={setLiquidGlassEnabled} />
        </>
      </ColumnTrigger>}
      <ColumnTrigger>
        <>
          <Text className="text-t-primary font-semibold text-md">Disable Cache</Text>
          <Switch value={disableCache} onValueChange={setDisableCache} />
        </>
      </ColumnTrigger>
      <ColumnTrigger subpage>Licences</ColumnTrigger>
      {__DEV__ && <ColumnTrigger onPress={async () => {
        if (accessToken)
          await Clipboard.setStringAsync(accessToken);
      }}>Copy JWT</ColumnTrigger>}
      <ColumnTrigger onPress={async () => {
        const [err] = await _.tryit(signOut)();
        if (err) {
          Alert.alert("Error", "Failed to sign out. Please try again later.");
          return;
        }

        await AsyncStorage.removeItem("lastSignInProvider");

        router.push("/sign-in");
      }}>Sign Out</ColumnTrigger>
    </ScrollView>
  </SafeAreaView>);
}
