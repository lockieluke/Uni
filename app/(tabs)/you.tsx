import ColumnTrigger from "@/components/ColumnTrigger";
import { userAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";
import { signOut } from "@/lib/supabase";
import { to } from "await-to-js";
import * as Clipboard from 'expo-clipboard';
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAtom } from "jotai";
import * as _ from "lodash-es";
import { Alert, View, SafeAreaView, ScrollView, Switch, Text } from "react-native";
import { useMMKVStorage } from "react-native-mmkv-storage";

export default function YouScreen() {
    const router = useRouter();

    const [{signedIn, user, accessToken}] = useAtom(userAtom);

    const [flipGuestLanguage, setFlipGuestLanguage] = useMMKVStorage("flipGuestLang", mmkvStorage, false);
    const [moreAccurateTranslation, setMoreAccurateTranslation] = useMMKVStorage("accurateTranslationModel", mmkvStorage, false);
    const [disableCache, setDisableCache] = useMMKVStorage("disableCache", mmkvStorage, false);

    if (!user || !signedIn)
        return null;

    const userMetadata = user.user_metadata;

    return (<SafeAreaView className={"flex-1 py-10 items-center gap-y-3 bg-white dark:bg-black"}>
        <Image className="my-5 w-36 aspect-square rounded-full" source={{
            uri: _.get(userMetadata, "avatar_url")
        }} />
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
                <Text className="text-t-primary font-semibold texT-md">Disable Cache</Text>
                <Switch value={disableCache} onValueChange={setDisableCache} />
                </>
            </ColumnTrigger>
            <ColumnTrigger subpage>Licences</ColumnTrigger>
            { __DEV__ && <ColumnTrigger onPress={async () => {
                if (accessToken)
                    await Clipboard.setStringAsync(accessToken);
            }}>Copy JWT</ColumnTrigger> }
            <ColumnTrigger onPress={async () => {
                const [err] = await to(signOut());
                if (err) {
                    Alert.alert("Error", "Failed to sign out. Please try again later.");
                    return;
                }

                router.push("/sign-in");
            }}>Sign Out</ColumnTrigger>
        </ScrollView>
    </SafeAreaView>);
}
