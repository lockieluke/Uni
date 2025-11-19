import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
	type RecordingConfig,
	useSharedAudioRecorder
} from "@siteed/expo-audio-studio";
import { AxiosError } from "axios";
import { requestRecordingPermissionsAsync } from "expo-audio";
import { File } from "expo-file-system";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useAtom, useAtomValue } from "jotai";
import * as async from "modern-async";
import { MotiView } from "moti";
import * as _ from "radashi";
import { useEffect, useRef, useState } from "react";
import { Unless, When } from "react-if";
import {
	Text,
	TouchableOpacity,
	useColorScheme,
	useWindowDimensions,
	View
} from "react-native";
import { useMMKVStorage } from "react-native-mmkv-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import TranscriptButton from "@/lib/components/TranscriptButton";
import TranslationText from "@/lib/components/TranslationText";
import { useAsyncEffect } from "@/lib/hooks";
import translatePhrase from "@/lib/language";
import { transcriptRealtime } from "@/lib/speech";
import { languagesAtom, translationsAtom, userAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";

export default function HomeScreen() {
	const router = useRouter();
	const audioRecorder = useSharedAudioRecorder();
	const colorScheme = useColorScheme();
	const dimensions = useWindowDimensions();

	const { signedIn } = useAtomValue(userAtom);
	const languages = useAtomValue(languagesAtom);
	const [translations, setTranslations] = useAtom(translationsAtom);

	const [flipGuestLanguage] = useMMKVStorage(
		"flipGuestLang",
		mmkvStorage,
		false
	);
	const [liquidGlassEnabled] = useMMKVStorage(
		"liquidGlassEnabled",
		mmkvStorage,
		isLiquidGlassAvailable()
	);
	const [cachedAudioPaths, setCachedAudioPaths] = useMMKVStorage<string[]>(
		"cachedAudioPaths",
		mmkvStorage,
		[]
	);

	const [translationState, setTranslationState] = useState<
		"idle" | "translating" | "transcripting"
	>("idle");
	const [transcriptionPreview, setTranscriptionPreview] = useState<string[]>(
		[]
	);
	const [speechReady, setSpeechReady] = useState<
		"unknown" | "denied" | "granted"
	>("unknown");

	const blockingNewAudioStream = useRef(false);

	const bottomTabHeight = dimensions.height * 0.15;
	const recordingDelay = 80;

	const recordingConfig: RecordingConfig = {
		sampleRate: 16000,
		keepAwake: true,
		intervalAnalysis: 100,
		interval: 10,
		onAudioStream: async (event) => {
			if (event.data.length === 0 || blockingNewAudioStream.current) return;

			await _.sleep(recordingDelay);

			blockingNewAudioStream.current = true;

			setCachedAudioPaths((prevPaths) =>
				prevPaths.some((path) => path === event.fileUri)
					? [...prevPaths]
					: [...prevPaths, event.fileUri]
			);

			const currentPreviewChunkIndex = transcriptionPreview.length;
			const [transcriptionErr, transcripted] = await _.tryit(
				transcriptRealtime
			)(event.fileUri, "accurate", (transcription) => {
				if (_.isNullish(transcripted)) {
					setTranscriptionPreview((prevPreviews) =>
						_.isNullish(prevPreviews.at(currentPreviewChunkIndex))
							? [...prevPreviews, transcription]
							: [...prevPreviews].map((preview, i) => {
									if (
										i === currentPreviewChunkIndex &&
										!transcription.includes("�")
									) {
										let newPreview = preview;
										newPreview += transcription;
										return newPreview;
									}
									return preview;
								})
					);
				}
			});
			if (transcriptionErr) {
				console.error(
					"Error transcribing in realtime:",
					transcriptionErr.message
				);
				return;
			}

			console.log("Received full transcript", transcripted);

			setTranscriptionPreview((prevPreviews) =>
				_.isNullish(prevPreviews.at(currentPreviewChunkIndex))
					? [...prevPreviews, transcripted.replaceAll("�", "")]
					: [...prevPreviews].map((preview, i) => {
							if (i === currentPreviewChunkIndex)
								return transcripted.replaceAll("�", "");
							return preview;
						})
			);

			blockingNewAudioStream.current = false;
		}
	};

	useAsyncEffect(async () => {
		await audioRecorder.prepareRecording(recordingConfig);
		SplashScreen.hide();

		const requestedPermission = await requestRecordingPermissionsAsync();
		setSpeechReady(requestedPermission.granted ? "granted" : "denied");
	}, []);

	useEffect(() => {
		if (translationState !== "transcripting") setTranscriptionPreview([]);
	}, [translationState]);

	return (
		<SafeAreaView
			className={cn(
				"flex-1 justify-center items-center bg-white dark:bg-black"
			)}
		>
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
									Uni Translate{" "}
									<Text className="text-lg text-purple-600">beta</Text>
								</Text>
							</When>
							<Unless
								condition={
									translationState === "transcripting" ||
									translationState === "translating"
								}
							>
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
										translating={translationState === "translating"}
										language={languages.guest}
										revertEnabled={flipGuestLanguage}
									>
										{translations?.guest}
									</TranslationText>
									<View className={"border-[0.05rem] border-gray-300 w-full"} />
									<TranslationText
										translating={translationState === "translating"}
										language={languages.host}
										revertEnabled={false}
									>
										{translations?.host}
									</TranslationText>
									<View className={"border-[0.05rem] border-gray-300 w-full"} />
								</MotiView>
							</Unless>

							<When
								condition={
									translationState === "transcripting" ||
									translationState === "translating"
								}
							>
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
										<Text className="text-4xl w-full text-center text-t-primary font-semibold">
											{transcriptionPreview.join("")}
										</Text>
									</View>
								</MotiView>
							</When>
						</View>

						<View
							style={{
								bottom: bottomTabHeight
							}}
							className={"flex-center absolute bottom-14"}
						>
							<TouchableOpacity
								className="flex-center flex-col gap-3 my-5"
								onPress={() => {
									router.push("/languages");
								}}
							>
								<Text className="text-t-primary text-lg font-semibold">
									{languages.host.displayName}
								</Text>
								<MaterialIcons
									className="rotate-90"
									name="compare-arrows"
									size={28}
									color={colorScheme === "dark" ? "white" : "black"}
								/>
								<Text className="text-t-primary text-lg font-semibold">
									{languages.guest.displayName}
								</Text>
							</TouchableOpacity>

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
													console.error(
														"Error deleting cached audio file:",
														_.get(error, "message")
													);
												}
											}
										},
										10
									);
									setCachedAudioPaths([]);

									setTranscriptionPreview([]);
									setTranslationState("transcripting");

									try {
										await audioRecorder.startRecording(recordingConfig);
									} catch (error) {
										console.error(
											"Error starting recording:",
											_.get(error, "message", error)
										);
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
													setTranslations({});

													const hostLanguageCode = languages.host.code;
													const guestLanguageCode = languages.guest.code;

													const hints = [hostLanguageCode, guestLanguageCode];
													const transcripted = transcriptionPreview.join("");

													if (!_.isEmpty(transcripted)) {
														const [translationErr, response] = await _.tryit(
															translatePhrase
														)(transcripted, hints, "default");
														if (translationErr) {
															if (translationErr instanceof AxiosError) {
																console.error(
																	"Translation request failed",
																	_.get(
																		translationErr.response?.data,
																		"error.message",
																		"unknown error"
																	)
																);
																setTranslations({});
																return;
															}
															console.error(
																"Error translating:",
																translationErr.message
															);
															return;
														}

														if (response) {
															const {
																translatedPhrase,
																sourceLanguage,
																pretranslatedPhrase
															} = response;

															setTranslations({
																host:
																	languages.host.code === sourceLanguage
																		? pretranslatedPhrase
																		: translatedPhrase,
																guest:
																	languages.guest.code === sourceLanguage
																		? pretranslatedPhrase
																		: translatedPhrase
															});
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
						<Text className={"text-lg text-center"}>
							Speech Recognition permission denied{"\n"} Grant access in
							Settings
						</Text>
					</View>
				</When>

				<When condition={speechReady === "unknown"}></When>
			</When>
		</SafeAreaView>
	);
}
