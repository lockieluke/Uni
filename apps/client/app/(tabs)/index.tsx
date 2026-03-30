import Ionicons from "@expo/vector-icons/Ionicons";
import { MenuView } from "@react-native-menu/menu";
import { ExpoAudioStreamModule, type RecordingConfig, useSharedAudioRecorder } from "@siteed/expo-audio-studio";
import { AxiosError } from "axios";
import { File } from "expo-file-system";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import * as SplashScreen from "expo-splash-screen";
import { useAtom, useAtomValue } from "jotai";
import { RESET } from "jotai/utils";
import * as async from "modern-async";
import { MotiText, MotiView } from "moti";
import * as _ from "radashi";
import { useEffect, useRef, useState } from "react";
import { Unless, When } from "react-if";
import { Platform, Text, useWindowDimensions, View } from "react-native";
import { useMMKVStorage } from "react-native-mmkv-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import TranscriptButton from "@/lib/components/TranscriptButton";
import TranslationText from "@/lib/components/TranslationText";
import { useAsyncEffect } from "@/lib/hooks";
import { summariseConversation, translatePhrase } from "@/lib/language";
import { transcriptRealtime } from "@/lib/speech";
import { languagesAtom, translationsAtom, userAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";

export default function HomeScreen() {
	const audioRecorder = useSharedAudioRecorder();
	const dimensions = useWindowDimensions();

	const { signedIn } = useAtomValue(userAtom);
	const languages = useAtomValue(languagesAtom);
	const [translations, setTranslations] = useAtom(translationsAtom);

	const [flipGuestLanguage] = useMMKVStorage("flipGuestLang", mmkvStorage, false);
	const [liquidGlassEnabled] = useMMKVStorage("liquidGlassEnabled", mmkvStorage, isLiquidGlassAvailable());
	const [cachedAudioPaths, setCachedAudioPaths] = useMMKVStorage<string[]>("cachedAudioPaths", mmkvStorage, []);

	const [translationState, setTranslationState] = useState<"idle" | "translating" | "transcripting">("idle");
	const [transcriptionPreview, setTranscriptionPreview] = useState<string[]>([]);
	const [speechReady, setSpeechReady] = useState<"unknown" | "denied" | "granted">("unknown");

	const blockingNewAudioStream = useRef(false);
	const previewChunkIndexRef = useRef(0);

	const bottomTabHeight = dimensions.height * 0.18;
	const recordingDelay = 80;
	const isTranscribing = translationState === "transcripting" && audioRecorder.isRecording;

	const recordingConfig: RecordingConfig = {
		sampleRate: 16000,
		keepAwake: true,
		ios: {
			audioSession: {
				category: "PlayAndRecord",
				categoryOptions: ["MixWithOthers", "DefaultToSpeaker"],
				mode: "Default"
			}
		},
		intervalAnalysis: 100,
		interval: 10,
		onAudioStream: async (event) => {
			if (event.data.length === 0 || blockingNewAudioStream.current) return;

			blockingNewAudioStream.current = true;

			await _.sleep(recordingDelay);

			setCachedAudioPaths((prevPaths) => (prevPaths.some((path) => path === event.fileUri) ? [...prevPaths] : [...prevPaths, event.fileUri]));

			const currentPreviewChunkIndex = previewChunkIndexRef.current++;
			let finalReceived = false;
			const [transcriptionErr, transcripted] = await _.tryit(transcriptRealtime)(event.fileUri, "accurate", (transcription) => {
				if (!finalReceived) {
					setTranscriptionPreview((prevPreviews) =>
						_.isNullish(prevPreviews.at(currentPreviewChunkIndex))
							? [...prevPreviews, transcription]
							: [...prevPreviews].map((preview, i) => {
									if (i === currentPreviewChunkIndex && !transcription.includes("�")) {
										let newPreview = preview;
										newPreview += transcription;
										return newPreview;
									}
									return preview;
								})
					);
				}
			});
			finalReceived = true;

			if (transcriptionErr) {
				console.error("Error transcribing in realtime:", transcriptionErr.message);
				blockingNewAudioStream.current = false;
				return;
			}

			console.log("Received full transcript", transcripted);

			setTranscriptionPreview((prevPreviews) =>
				_.isNullish(prevPreviews.at(currentPreviewChunkIndex))
					? [...prevPreviews, transcripted.replaceAll("�", "")]
					: [...prevPreviews].map((preview, i) => {
							if (i === currentPreviewChunkIndex) return transcripted.replaceAll("�", "");
							return preview;
						})
			);

			blockingNewAudioStream.current = false;
		}
	};

	useAsyncEffect(async () => {
		const [, requestedPermission] = await Promise.all([
			audioRecorder.prepareRecording(recordingConfig),
			ExpoAudioStreamModule.requestPermissionsAsync()
		]);
		setSpeechReady(requestedPermission.granted ? "granted" : "denied");

		SplashScreen.hide();
	}, []);

	useEffect(() => {
		if (translationState !== "transcripting") setTranscriptionPreview([]);
	}, [translationState]);

	return (
		<SafeAreaView className={cn("flex-1 justify-center items-center bg-white dark:bg-black")}>
			<When condition={signedIn}>
				<When condition={speechReady === "granted"}>
					<MotiView
						className={cn("absolute inset-0 flex items-center", {
							"top-10": liquidGlassEnabled,
							"top-0": !liquidGlassEnabled
						})}
						transition={{
							type: "spring",
							duration: 300
						}}
						from={{ opacity: 0 }}
						animate={{ opacity: 1 }}
					>
						<View className={"absolute py-10 w-full flex flex-col gap-10"}>
							<When condition={liquidGlassEnabled}>
								<Text className="mx-5 font-bold text-t-primary text-3xl">
									Uni Translate <Text className="text-lg text-purple-600">beta</Text>
								</Text>
							</When>
							<Unless condition={translationState === "transcripting" || translationState === "translating"}>
								<MotiView
									className="w-full flex flex-col gap-10"
									from={{
										opacity: 0
									}}
									animate={{
										opacity: 1
									}}
									exit={{
										opacity: 0
									}}
									transition={{
										type: "spring",
										duration: 300
									}}
								>
									<TranslationText
										title={translations.title[languages.guest.code] ?? ""}
										translating={translationState === "translating"}
										language={languages.guest}
										revertEnabled={flipGuestLanguage}
									>
										{translations?.guest}
									</TranslationText>
									<View className={"border-[0.05rem] border-gray-300 w-full"} />
									<TranslationText
										title={translations.title[languages.host.code] ?? ""}
										translating={translationState === "translating"}
										language={languages.host}
										revertEnabled={false}
									>
										{translations?.host}
									</TranslationText>
									<View className={"border-[0.05rem] border-gray-300 w-full"} />
								</MotiView>
							</Unless>

							<When condition={translationState === "transcripting" || translationState === "translating"}>
								<MotiView
									from={{
										opacity: 0
									}}
									animate={{
										opacity: 1
									}}
									exit={{
										opacity: 0
									}}
									transition={{
										type: "spring",
										duration: 300
									}}
								>
									<View className="flex flex-center px-5 my-52">
										<Text className="text-4xl w-full text-center text-t-primary font-semibold">{transcriptionPreview.join("")}</Text>
									</View>
								</MotiView>
							</When>
						</View>

						<View
							style={{
								bottom: bottomTabHeight
							}}
							className={"flex-center gap-5 absolute bottom-14"}
						>
							{/*<TouchableOpacity
                className="flex-center flex-col gap-3 my-5"
                onPress={() => {
                  router.push("/languages");
                }}
              >
                <Text className="text-t-primary text-lg font-semibold">{languages.host.displayName}</Text>
                <MaterialIcons className="rotate-90" name="compare-arrows" size={28} color={colorScheme === "dark" ? "white" : "black"} />
                <Text className="text-t-primary text-lg font-semibold">{languages.guest.displayName}</Text>
              </TouchableOpacity>*/}

							<When condition={_.isEmpty(translations.conversation) && !isTranscribing}>
								<MotiText
									from={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{
										type: "spring",
										duration: 300
									}}
									className="text-t-primary my-5"
								>
									Press and hold to start, release when done speaking
								</MotiText>
							</When>

							<When condition={translations.conversation.length > 0 && !isTranscribing}>
								<MenuView
									onPressAction={({ nativeEvent }) => {
										const code = nativeEvent.event;

										if (code === "clear_context") setTranslations(RESET);
									}}
									actions={[
										{
											id: "clear_context",
											title: "Clear Context",
											image: Platform.select({
												ios: "trash"
											}),
											imageColor: "#fc3d39",
											attributes: {
												destructive: true
											}
										},
										{
											title: "Using Context",
											subtitle: `${Object.values(translations.title).join(", ")}`,
											attributes: {
												disabled: true
											}
										}
									]}
								>
									<MotiView
										from={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{
											type: "spring",
											duration: 300
										}}
										className="flex-row flex-center gap-3 p-3 bg-gray-500 dark:bg-slate-400 rounded-full"
									>
										<Ionicons name="sparkles-sharp" size={24} color="white" />
										<Text className="text-white">Using Context</Text>
									</MotiView>
								</MenuView>
							</When>

							<When condition={isTranscribing}>
								<MotiText
									from={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{
										type: "spring",
										duration: 300
									}}
									className="text-t-primary my-5"
								>
									Release when phrase has been fully transcribed
								</MotiText>
							</When>

							<TranscriptButton
								onPressIn={async () => {
									await async.asyncForEach(
										cachedAudioPaths,
										(path) => {
											const file = new File(path);
											if (file.exists) {
												try {
													file.delete();
												} catch (error) {
													console.error("Error deleting cached audio file:", _.get(error, "message"));
												}
											}
										},
										10
									);
									setCachedAudioPaths([]);

									setTranscriptionPreview([]);
									previewChunkIndexRef.current = 0;
									setTranslationState("transcripting");

									try {
										await audioRecorder.startRecording(recordingConfig);
									} catch (error) {
										console.error("Error starting recording:", _.get(error, "message", error));
									}
								}}
								onPressOut={async () => {
									try {
										return await (async () => {
											if (audioRecorder.isRecording) {
												// Artificial delay to ensure the user has finished speaking
												await _.sleep(100);

												const result = await audioRecorder.stopRecording();

												if (result) {
													setTranslations(RESET);

													const hostLanguageCode = languages.host.code;
													const guestLanguageCode = languages.guest.code;

													const hints = [hostLanguageCode, guestLanguageCode];
													const transcripted = transcriptionPreview.join("");

													if (!_.isEmpty(transcripted)) {
														const [translationErr, response] = await _.tryit(translatePhrase)(
															{
																hints,
																phrase: transcripted,
																history: translations.conversation
															},
															"default"
														);
														if (translationErr) {
															if (translationErr instanceof AxiosError) {
																console.error("Translation request failed", _.get(translationErr.response?.data, "error.message", "unknown error"));
																setTranslations(RESET);
																return;
															}
															console.error("Error translating:", translationErr.message);
															return;
														}

														if (response) {
															const { translatedPhrase, sourceLanguage, pretranslatedPhrase } = response;

															const newConversationEntry: { [key: string]: string } = {};
															newConversationEntry[hostLanguageCode] =
																languages.host.code === sourceLanguage ? pretranslatedPhrase : translatedPhrase;
															newConversationEntry[guestLanguageCode] =
																languages.guest.code === sourceLanguage ? pretranslatedPhrase : translatedPhrase;

															const title = await summariseConversation([...translations.conversation, newConversationEntry]);

															setTranslations((prevTranslations) => ({
																host: languages.host.code === sourceLanguage ? pretranslatedPhrase : translatedPhrase,
																guest: languages.guest.code === sourceLanguage ? pretranslatedPhrase : translatedPhrase,
																title,
																conversation: [...prevTranslations.conversation, newConversationEntry]
															}));
														}
													}
												}
											}
										})();
									} finally {
										setTranscriptionPreview([]);
										setTranslationState("idle");
									}
								}}
							/>
						</View>
					</MotiView>
				</When>

				<When condition={speechReady === "denied"}>
					<View className={"flex-center flex-col gap-5"}>
						<Text className={"text-lg text-center"}>Speech Recognition permission denied{"\n"} Grant access in Settings</Text>
					</View>
				</When>

				<When condition={speechReady === "unknown"}></When>
			</When>
		</SafeAreaView>
	);
}
