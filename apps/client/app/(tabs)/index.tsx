import TranscriptButton from "@/lib/components/TranscriptButton";
import TranslationText from "@/lib/components/TranslationText";
import { useAsyncEffect } from "@/lib/hooks";
import translatePhrase from "@/lib/language";
import { transcriptRealtime } from "@/lib/speech";
import { languagesAtom, translationsAtom, userAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AxiosError } from "axios";
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder
} from "expo-audio";
import { File } from "expo-file-system";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { useRouter } from "expo-router";
import { useAtom, useAtomValue } from "jotai";
import { MotiView } from "moti";
import * as _ from "radashi";
import { useEffect, useState } from "react";
import { Unless, When } from "react-if";
import { ActivityIndicator, Text, TouchableOpacity, useColorScheme, useWindowDimensions, View } from "react-native";
import { useMMKVStorage } from "react-native-mmkv-storage";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const colorScheme = useColorScheme();
  const dimensions = useWindowDimensions();

  const { signedIn } = useAtomValue(userAtom);
  const languages = useAtomValue(languagesAtom);
  const [speechReady, setSpeechReady] = useState<'unknown' | 'denied' | 'granted'>('unknown');

  const [flipGuestLanguage] = useMMKVStorage("flipGuestLang", mmkvStorage, false);
  const [liquidGlassEnabled] = useMMKVStorage("liquidGlassEnabled", mmkvStorage, isLiquidGlassAvailable());

  const [translationState, setTranslationState] = useState<"idle" | "translating" | "transcripting">("idle");
  const [previewTranscription, setPreviewTranscription] = useState<string>("");
  const [translations, setTranslations] = useAtom(translationsAtom);

  const bottomTabHeight = dimensions.height * 0.15;

  useAsyncEffect(async () => {
    const requestedPermission = await requestRecordingPermissionsAsync();
    setSpeechReady(requestedPermission.granted ? 'granted' : 'denied');

    setSpeechReady((await getRecordingPermissionsAsync()).granted ? 'granted' : 'denied');

    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    });
  }, []);

  useEffect(() => {
    if (translationState !== "transcripting")
      setPreviewTranscription("");
  }, [translationState]);

  return (
    <SafeAreaView className={cn("flex-1 justify-center items-center bg-white dark:bg-black")}>
      <When condition={signedIn}>
        <When condition={speechReady === 'granted'}>
          <MotiView className={cn("absolute inset-0 flex items-center", {
            "top-10": liquidGlassEnabled,
            "top-0": !liquidGlassEnabled
          })} transition={{
            type: "spring",
            duration: 300
          }} from={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <View className={"absolute py-10 w-full flex flex-col gap-10"}>
              <When condition={liquidGlassEnabled}>
                <Text className="mx-5 font-bold text-t-primary text-3xl">Uni Translate</Text>
              </When>
              <Unless condition={translationState === "transcripting" || translationState === "translating"}>
                <MotiView className="w-full flex flex-col gap-10" from={{
                  opacity: 0
                }} animate={{
                  opacity: 1
                }} exit={{
                  opacity: 0
                }} transition={{
                  type: "spring",
                  duration: 300
                }}>
                  <TranslationText translating={translationState === "translating"} language={languages.guest} revertEnabled={flipGuestLanguage}>{translations?.guest}</TranslationText>
                  <View className={"border-[0.05rem] border-gray-300 w-full"} />
                  <TranslationText translating={translationState === "translating"} language={languages.host} revertEnabled={false}>{translations?.host}</TranslationText>
                  <View className={"border-[0.05rem] border-gray-300 w-full"} />
                </MotiView>
              </Unless>

              <When condition={translationState === "transcripting" || translationState === "translating"}>
                <MotiView from={{
                  opacity: 0
                }} animate={{
                  opacity: 1
                }} exit={{
                  opacity: 0
                }} transition={{
                  type: "spring",
                  duration: 300
                }}>
                  <View className="flex flex-center my-52">
                    <Text className="text-3xl w-full text-center text-t-primary font-semibold">{previewTranscription}</Text>
                  </View>
                </MotiView>
              </When>
            </View>

            <View style={{
              bottom: bottomTabHeight
            }} className={"flex-center absolute bottom-14"}>
              <TouchableOpacity className="flex-center flex-col gap-3 my-5" onPress={() => {
                router.push("/languages");
              }}>
                <Text className="text-t-primary text-lg font-semibold">{languages.host.displayName}</Text>
                <MaterialIcons className="rotate-90" name="compare-arrows" size={28} color={colorScheme === "dark" ? "white" : "black"} />
                <Text className="text-t-primary text-lg font-semibold">{languages.guest.displayName}</Text>
              </TouchableOpacity>

              <TranscriptButton onPressIn={async () => {
                try {
                  await audioRecorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
                  audioRecorder.record();
                } catch (error) {
                  console.error("Error starting recording:", error);
                }
              }} onPressOut={async () => {
                setTranslationState("transcripting");
                const resetTranslatingTimeout = setTimeout(() => {
                  setTranslationState("idle");
                }, 1000);
                if (audioRecorder.isRecording) {
                  clearTimeout(resetTranslatingTimeout);
                  await audioRecorder.stop();

                  const uri = audioRecorder.uri;
                  if (uri) {
                    const file = new File(uri);
                    setTranslations({});

                    const hostLanguageCode = languages.host.code;
                    const guestLanguageCode = languages.guest.code;

                    const hints = [hostLanguageCode, guestLanguageCode];
                    const transcriptionTimer = performance.now();
                    const [transcriptionErr, transcripted] = await _.tryit(transcriptRealtime)(uri, "accurate", transcription => {
                      setPreviewTranscription(prevPreviewTranscription => prevPreviewTranscription + transcription);
                    });
                    if (transcriptionErr) {
                      console.error("Error transcribing in realtime:", transcriptionErr.message);
                      setTranslationState("idle");
                      setTranslations({});
                    }
                    const transcriptionDuration = performance.now() - transcriptionTimer;

                    if (transcripted) {
                      setPreviewTranscription(transcripted);

                      const translationTimer = performance.now();
                      const [translationErr, response] = await _.tryit(translatePhrase)(transcripted, hints, "default");
                      if (translationErr) {
                        if (translationErr instanceof AxiosError) {
                          console.error("Translation request failed", _.get(translationErr.response?.data, "error.message", "unknown error"));
                          setTranslations({});
                          return;
                        }
                        console.error("Error translating:", translationErr.message);
                        return;
                      }

                      if (response) {
                        const { translatedPhrase, sourceLanguage, modelId } = response;
                        const translationDuration = performance.now() - translationTimer;

                        setTranslations({
                          host: languages.host.code === sourceLanguage ? transcripted : translatedPhrase,
                          guest: languages.guest.code === sourceLanguage ? transcripted : translatedPhrase
                        });

                        console.log(`Transcription took ${transcriptionDuration}ms, Translation with ${modelId} took ${translationDuration}ms, Total: ${transcriptionDuration + translationDuration}ms`);

                        setTranslationState("idle");
                      }

                      try {
                        file.delete();
                      } catch (error) {
                        console.error("Error deleting file:", error);
                      }
                    }
                  }
                }
              }} />
            </View>
          </MotiView>
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
    </SafeAreaView>
  );
}
