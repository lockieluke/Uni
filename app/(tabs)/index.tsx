import TranscriptButton from "@/components/TranscriptButton";
import TranslationText from "@/components/TranslationText";
import { useColorScheme } from "@/hooks/useColorScheme";
import translatePhrase from "@/lib/language";
import transcript, { TranscriptProvider } from "@/lib/speech";
import { languagesAtom, translationsAtom, userAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
    getRecordingPermissionsAsync,
    RecordingPresets,
    requestRecordingPermissionsAsync,
    useAudioRecorder
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import { useAtom, useAtomValue } from "jotai";
import * as _ from "radashi";
import { useState } from "react";
import { When } from "react-if";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useMMKVStorage } from "react-native-mmkv-storage";
import useAsyncEffect from "use-async-effect";

export default function HomeScreen() {
    const router = useRouter();
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const bottomTabHeight = useBottomTabBarHeight();
    const colorScheme = useColorScheme();

    const { signedIn } = useAtomValue(userAtom);
    const languages = useAtomValue(languagesAtom);
    const [speechReady, setSpeechReady] = useState<'unknown' | 'denied' | 'granted'>('unknown');
    const [transcriptProvider,] = useState<TranscriptProvider>('openai');

    const [flipGuestLanguage,] = useMMKVStorage("flipGuestLang", mmkvStorage, false);
    const [moreAccurateTranslation,] = useMMKVStorage("accurateTranslationModel", mmkvStorage, false);

    const [translating, setTranslating] = useState(false);
    const [translations, setTranslations] = useAtom(translationsAtom);

    useAsyncEffect(async () => {
        const requestedPermission = await requestRecordingPermissionsAsync();
        setSpeechReady(requestedPermission.granted ? 'granted' : 'denied');

        setSpeechReady((await getRecordingPermissionsAsync()).granted ? 'granted' : 'denied');
    }, []);

    return (
        <View style={{
            marginBottom: bottomTabHeight
        }} className={cn("flex-1 justify-center items-center bg-white dark:bg-black")}>
            <When condition={signedIn}>
                <When condition={speechReady === 'granted'}>
                    <View className={"absolute top-0 py-10 w-full flex flex-col gap-10"}>
                        <TranslationText translating={translating} language={languages.guest} revertEnabled={flipGuestLanguage}>{translations?.guest}</TranslationText>
                        <View className={"border-[0.05rem] border-gray-300 w-full"} />
                        <TranslationText translating={translating} language={languages.host} revertEnabled={false}>{translations?.host}</TranslationText>
                        <View className={"border-[0.05rem] border-gray-300 w-full"} />
                    </View>

                    <View className={"flex-center absolute bottom-14"}>
                        <When condition={__DEV__}>
                            <>
                                {/*<Picker*/}
                                {/*    style={{*/}
                                {/*        width: "80%",*/}
                                {/*        height: "auto",*/}
                                {/*        top: "10%"*/}
                                {/*    }}*/}
                                {/*    itemStyle={{*/}
                                {/*        fontSize: 12*/}
                                {/*    }}*/}
                                {/*    mode={"dropdown"}*/}
                                {/*    selectedValue={transcriptProvider}*/}
                                {/*    onValueChange={(itemValue) => setTranscriptProvider(itemValue)}*/}
                                {/*>*/}
                                {/*    <Picker.Item label="Deepgram" value="deepgram" />*/}
                                {/*    <Picker.Item label="Gladia" value="gladia" />*/}
                                {/*    <Picker.Item label="OpenAI" value="openai" />*/}
                                {/*</Picker>*/}
                            </>
                        </When>

                        <TouchableOpacity className="flex-center flex-col gap-3 my-5" onPress={() => {
                            router.push("/languages");
                        }}>
                            <Text className="text-t-primary text-lg font-semibold">{languages.host.displayName}</Text>
                            <MaterialIcons className="rotate-90" name="compare-arrows" size={28} color={colorScheme === "dark" ? "white" : "black"} />
                            <Text className="text-t-primary text-lg font-semibold">{languages.guest.displayName}</Text>
                        </TouchableOpacity>

                        <TranscriptButton onPressIn={async () => {
                            await audioRecorder.prepareToRecordAsync();
                            audioRecorder.record();
                        }} onPressOut={async () => {
                            setTranslating(true);
                            if (audioRecorder.isRecording) {
                                await audioRecorder.stop();

                                const uri = audioRecorder.uri;
                                if (uri) {
                                    const translationTimer = performance.now();
                                    setTranslations({});

                                    const hostLanguageCode = languages.host.code;
                                    const guestLanguageCode = languages.guest.code;

                                    const hints = [hostLanguageCode, guestLanguageCode];
                                    const result = await transcript(uri, transcriptProvider, hints);
                                    const transcripted = result?.transcript;

                                    if (transcripted) {
                                        const [err, response] = await _.tryit(translatePhrase)(transcripted, hints, moreAccurateTranslation ? "more-accurate" : "accurate");
                                        if (err) {
                                            console.error("Error translating:", err);
                                            return;
                                        }

                                        if (response) {
                                            const { translatedPhrase, sourceLanguage } = response;

                                            setTranslations({
                                                host: languages.host.code === sourceLanguage ? transcripted : translatedPhrase,
                                                guest: languages.guest.code === sourceLanguage ? transcripted : translatedPhrase
                                            });

                                            setTranslating(false);
                                            console.log("Translation took", performance.now() - translationTimer, "ms");
                                        }
                                    }

                                    try {
                                        await FileSystem.deleteAsync(uri);
                                    } catch (error) {
                                        console.error("Error deleting file:", error);
                                    }
                                }
                            }
                        }} />
                    </View>
                </When>

                <When condition={speechReady === 'denied'}>
                    <View className={"flex-center flex-col gap-5"}>
                        <Text className={"text-lg text-center"}>Speech Recognition permission denied{"\n"} Grant access in Settings</Text>
                    </View>
                </When>

                <When condition={speechReady === 'unknown'}>
                    <ActivityIndicator size={"large"} />
                </When>
            </When>
        </View>
    );
}
