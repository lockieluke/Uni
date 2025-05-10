import ColumnTrigger from "@/components/ColumnTrigger";
import { userAtom } from "@/lib/states";
import { signOut } from "@/lib/supabase";
import { to } from "await-to-js";
import * as Clipboard from 'expo-clipboard';
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAtom } from "jotai";
import * as _ from "lodash-es";
import { Alert, SafeAreaView, ScrollView, Text } from "react-native";

export default function YouScreen() {
    const router = useRouter();

    const [{signedIn, user, accessToken}] = useAtom(userAtom);

    if (!user || !signedIn)
        return null;

    const userMetadata = user.user_metadata;

    return (<SafeAreaView className={"flex-1 py-10 items-center gap-3 bg-white dark:bg-black"}>
        <Image className="my-5 w-36 aspect-square rounded-full" source={{
            uri: _.get(userMetadata, "avatar_url")
        }} />
        <Text className="text-3xl font-bold">{_.get(userMetadata, "full_name")}</Text>
        <Text>{user.email}</Text>

        <ScrollView contentContainerClassName="flex-center my-5 gap-5">
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
