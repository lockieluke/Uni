import TranscriptButton from "@/components/TranscriptButton";
import TranslationText from "@/components/TranslationText";
import { Language } from "@/constants/Language";
import { useColorScheme } from "@/hooks/useColorScheme";
import translatePhase from "@/lib/language";
import transcript, { TranscriptProvider } from "@/lib/speech";
import { userAtom } from "@/lib/states";
import { cn } from "@/lib/utils";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
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
            code: "en",
            displayName: "English",
            flag: "🇬🇧"
        }
    });
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
    }, []);

    return (
        <View style={{
            marginBottom: bottomTabHeight
        }} className={cn("flex-1 justify-center items-center bg-white dark:bg-black")}>
            <When condition={signedIn}>
                <When condition={speechReady === 'granted'}>
                    <View className={"absolute top-0 py-10 w-full flex flex-col gap-10"}>
                        <TranslationText language={languages.host} revertEnabled={revertEnabled}>{speechText.host}</TranslationText>
                        <View className={"border-[0.05rem] border-gray-300 w-full"} />
                        <TranslationText language={languages.guest} revertEnabled={false}>{speechText.guest}</TranslationText>
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
                                        <Text className={"text-t-primary text-lg"}>Revert Host Language</Text>
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
                            if (audioRecorder.isRecording) {
                                await audioRecorder.stop();

                                const uri = audioRecorder.uri;
                                if (uri) {
                                    setSpeechText({
                                        host: "",
                                        guest: ""
                                    });

                                    const modifiedHostLang = languages.host.code === "zh-HK" ? "zh" : languages.host.code;
                                    const modifiedGuestLang = languages.guest.code === "zh-HK" ? "zh" : languages.guest.code;
                                    const result = await transcript(uri, transcriptProvider, [modifiedHostLang, modifiedGuestLang]);
                                    const transcripted = result?.transcript;
                                    const language = result?.language;
                                    const modifiedLanguage = language === "zh" ? "zh-HK" : language;

                                    if (transcripted) {
                                        const sourceLanguage = [languages.host.code, languages.guest.code].filter(lang => lang === modifiedLanguage)[0];
                                        const targetLanguage = [languages.host.code, languages.guest.code].filter(lang => lang !== modifiedLanguage)[0];
                                        const translated = await translatePhase(transcripted, sourceLanguage, targetLanguage);

                                        setSpeechText({
                                            host: sourceLanguage === modifiedHostLang || sourceLanguage === languages.host.code ? transcripted : translated,
                                            guest: sourceLanguage === modifiedGuestLang || sourceLanguage === languages.guest.code ? transcripted : translated
                                        });
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
