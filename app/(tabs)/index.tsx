import TranscriptButton from "@/components/TranscriptButton";
import TranslationText from "@/components/TranslationText";
import { Language } from "@/constants/Language";
import { useColorScheme } from "@/hooks/useColorScheme";
import translatePhrase from "@/lib/language";
import transcript, { TranscriptProvider } from "@/lib/speech";
import { userAtom } from "@/lib/states";
import { cn } from "@/lib/utils";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { to } from "await-to-js";
import {
    getRecordingPermissionsAsync,
    RecordingPresets,
    requestRecordingPermissionsAsync,
    useAudioRecorder
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { When } from "react-if";
import { ActivityIndicator, Switch, Text, View } from "react-native";
import useAsyncEffect from "use-async-effect";

export default function HomeScreen() {
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const bottomTabHeight = useBottomTabBarHeight();
    const colorScheme = useColorScheme();

    const { signedIn } = useAtomValue(userAtom);
    const [speechReady, setSpeechReady] = useState<'unknown' | 'denied' | 'granted'>('unknown');
    const [transcriptProvider,] = useState<TranscriptProvider>('openai');
    const [revertEnabled, setRevertEnabled] = useState(false);
    const [languages,] = useState<{
        host: Language;
        guest: Language;
    }>({
        host: {
            code: "zh-HK",
            displayName: "Cantonese",
            flag: "🇭🇰"
        },
        guest: {
            code: "en-GB",
            displayName: "English",
            flag: "🇬🇧"
        }
    });
    const [translating, setTranslating] = useState(false);
    const [speechText, setSpeechText] = useState<{
        host: string;
        guest: string;
    }>({
        host: "",
        guest: ""
    });

    useAsyncEffect(async () => {
        const requestedPermission = await requestRecordingPermissionsAsync();
        setSpeechReady(requestedPermission.granted ? 'granted' : 'denied');

        setSpeechReady((await getRecordingPermissionsAsync()).granted ? 'granted' : 'denied');

        setTimeout(() => setTranslating(true), 3000);
    }, []);

    return (
        <View style={{
            marginBottom: bottomTabHeight
        }} className={cn("flex-1 justify-center items-center bg-white dark:bg-black")}>
            <When condition={signedIn}>
                <When condition={speechReady === 'granted'}>
                    <View className={"absolute top-0 py-10 w-full flex flex-col gap-10"}>
                        <TranslationText translating={translating} language={languages.guest} revertEnabled={false}>{speechText.guest}</TranslationText>
                        <View className={"border-[0.05rem] border-gray-300 w-full"} />
                        <TranslationText translating={translating} language={languages.host} revertEnabled={revertEnabled}>{speechText.host}</TranslationText>
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
                                <View className={"flex-center gap-5"}>
                                    <View className={"flex-center flex-row gap-5"}>
                                        <Text className={"text-t-primary text-lg"}>Revert Guest Language</Text>
                                        <Switch value={revertEnabled} onValueChange={setRevertEnabled} />
                                    </View>
                                </View>
                            </>
                        </When>

                        <Text className={"my-5 font-bold text-2xl text-t-primary text-center flex-center"}>{languages.host.displayName}  <FontAwesome6 name="arrows-left-right" size={24} color={colorScheme === "light" ? "black" : "white"} />  {languages.guest.displayName}</Text>
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
                                    setSpeechText({
                                        host: "",
                                        guest: ""
                                    });

                                    const hostLanguageCode = languages.host.code;
                                    const guestLanguageCode = languages.guest.code;

                                    const hints = [hostLanguageCode, guestLanguageCode];
                                    const result = await transcript(uri, transcriptProvider, hints);
                                    const transcripted = result?.transcript;

                                    if (transcripted) {
                                        const [err, response] = await to(translatePhrase(transcripted, hints));
                                        if (err) {
                                            console.error("Error translating:", err);
                                            return;
                                        }

                                        if (response) {
                                            const {translatedPhrase, sourceLanguage} = response;

                                            setSpeechText({
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
