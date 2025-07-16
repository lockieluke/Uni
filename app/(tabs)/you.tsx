import ColumnTrigger from "@/components/ColumnTrigger";
import TierBadge from "@/components/TierBadge";
import { userAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";
import { signOut } from "@/lib/supabase";
import { getUserAdditionalData } from "@/lib/user";
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAtom } from "jotai";
import * as _ from "radashi";
import { Unless, When } from "react-if";
import { Alert, View, SafeAreaView, ScrollView, Switch, Text, TextInput } from "react-native";
import { useMMKVStorage } from "react-native-mmkv-storage";
import useAsyncEffect from "use-async-effect";

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
    const [moreAccurateTranslation, setMoreAccurateTranslation] = useMMKVStorage("accurateTranslationModel", mmkvStorage, false);
    const [moreAccurateTranscription, setMoreAccurateTranscription] = useMMKVStorage("accurateTranscriptionModel", mmkvStorage, false);
    const [disableCache, setDisableCache] = useMMKVStorage("disableCache", mmkvStorage, false);
    const [useDevServer, setUseDevServer] = useMMKVStorage("useDevServer", mmkvStorage, false);
    const [devServerUrl, setDevServerUrl] = useMMKVStorage("devServerUrl", mmkvStorage, "http://127.0.0.1:8787");

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
            <ColumnTrigger>
                <>
                    <View className={"flex-col flex items-start w-2/3 gap-2"}>
                        <Text className="font-semibold text-md text-t-primary">Use a more accurate model for all translations</Text>
                        <Text className="text-t-primary">More accurate translations may take more time but can often produce better and more localised results</Text>
                    </View>
                    <Switch value={moreAccurateTranslation} onValueChange={setMoreAccurateTranslation} />
                </>
            </ColumnTrigger>
            <ColumnTrigger>
                <>
                    <View className={"flex-col flex items-start w-2/3 gap-2"}>
                        <Text className="font-semibold text-md text-t-primary">More accurate transcriptions</Text>
                        <Text className="text-t-primary">May take more time but can often produce better results</Text>
                    </View>
                    <Switch value={moreAccurateTranscription} onValueChange={setMoreAccurateTranscription} />
                </>
            </ColumnTrigger>
            {__DEV__ && <ColumnTrigger>
                <View className="flex-col w-full">
                    <View className="flex w-full flex-row items-center justify-between">
                        <Text className="text-t-primary font-semibold text-md">Use Dev Server</Text>
                        <Switch value={useDevServer} onValueChange={setUseDevServer} />
                    </View>
                    <When condition={useDevServer && Device.isDevice}>
                        <TextInput
                            className="my-3 text-t-primary"
                            onChange={e => setDevServerUrl(e.nativeEvent.text)}
                            value={devServerUrl}
                            enterKeyHint="done"
                            placeholder="Dev Server URL"
                        />
                    </When>
                </View>
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

                router.push("/sign-in");
            }}>Sign Out</ColumnTrigger>
        </ScrollView>
    </SafeAreaView>);
}
