import TranscriptButton from "@/lib/components/TranscriptButton";
import TranslationText from "@/lib/components/TranslationText";
import { useAsyncEffect } from "@/lib/hooks";
import translatePhrase from "@/lib/language";
import transcript from "@/lib/speech";
import { languagesAtom, translationsAtom, userAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { AxiosError } from "axios";
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { useRouter } from "expo-router";
import { useAtom, useAtomValue } from "jotai";
import * as _ from "radashi";
import { use, useState } from "react";
import { When } from "react-if";
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

  const [translating, setTranslating] = useState(false);
  const [translations, setTranslations] = useAtom(translationsAtom);

  const bottomTabHeight = liquidGlassEnabled ? dimensions.height * 0.1 : use(BottomTabBarHeightContext) ?? 0;

  useAsyncEffect(async () => {
    const requestedPermission = await requestRecordingPermissionsAsync();
    setSpeechReady(requestedPermission.granted ? 'granted' : 'denied');

    setSpeechReady((await getRecordingPermissionsAsync()).granted ? 'granted' : 'denied');

    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    });
  }, []);

  return (
    <SafeAreaView style={{
      marginBottom: bottomTabHeight
    }} className={cn("flex-1 justify-center items-center bg-white dark:bg-black")}>
      <When condition={signedIn}>
        <When condition={speechReady === 'granted'}>
          <View className={cn("absolute py-10 w-full flex flex-col gap-10", {
            "top-0": !liquidGlassEnabled,
            "top-10": liquidGlassEnabled
          })}>
            <When condition={liquidGlassEnabled}>
              <Text className="mx-5 font-bold text-3xl">Uni Translate</Text>
            </When>
            <TranslationText translating={translating} language={languages.guest} revertEnabled={flipGuestLanguage}>{translations?.guest}</TranslationText>
            <View className={"border-[0.05rem] border-gray-300 w-full"} />
            <TranslationText translating={translating} language={languages.host} revertEnabled={false}>{translations?.host}</TranslationText>
            <View className={"border-[0.05rem] border-gray-300 w-full"} />
          </View>

          <View className={"flex-center absolute bottom-14"}>
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
              setTranslating(true);
              const resetTranslatingTimeout = setTimeout(() => {
                setTranslating(false);
              }, 1000);
              if (audioRecorder.isRecording) {
                clearTimeout(resetTranslatingTimeout);
                await audioRecorder.stop();

                const uri = audioRecorder.uri;
                if (uri) {
                  setTranslations({});

                  const hostLanguageCode = languages.host.code;
                  const guestLanguageCode = languages.guest.code;

                  const hints = [hostLanguageCode, guestLanguageCode];
                  const transcriptionTimer = performance.now();
                  const [transcriptionErr, result] = await _.tryit(transcript)(uri);
                  if (transcriptionErr) {
                    setTranslating(false);
                    setTranslations({});
                    if (transcriptionErr instanceof AxiosError) {
                      console.error("Transcription request failed", _.get(transcriptionErr.response?.data, "error.message", "unknown error"));
                      return;
                    }
                    console.error("Error transcribing:", transcriptionErr.message);
                    return;
                  }
                  const transcripted = result?.transcript;
                  const transcriptionDuration = performance.now() - transcriptionTimer;

                  if (transcripted) {
                    const translationTimer = performance.now();
                    const [translationErr, response] = await _.tryit(translatePhrase)(transcripted, hints, "default");
                    if (translationErr) {
                      if (translationErr instanceof AxiosError) {
                        console.error("Translation request failed", _.get(translationErr.response?.data, "error.message", "unknown error"));
                        return;
                      }
                      console.error("Error translating:", translationErr.message);
                      return;
                    }

                    if (response) {
                      const { translatedPhrase, sourceLanguage } = response;
                      const translationDuration = performance.now() - translationTimer;

                      setTranslations({
                        host: languages.host.code === sourceLanguage ? transcripted : translatedPhrase,
                        guest: languages.guest.code === sourceLanguage ? transcripted : translatedPhrase
                      });

                      console.log(`Transcription took ${transcriptionDuration}ms, Translation took ${translationDuration}ms, Total: ${transcriptionDuration + translationDuration}ms`);

                      setTranslating(false);
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
    </SafeAreaView>
  );
}
