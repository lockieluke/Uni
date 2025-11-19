import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, NativeTabs, VectorIcon } from "expo-router/unstable-native-tabs";
import { useAtomValue } from "jotai";
import { Unless, When } from "react-if";
import { DynamicColorIOS, Platform, useColorScheme } from "react-native";
import { useMMKVStorage } from "react-native-mmkv-storage";
import { HapticTab } from "@/lib/components/HapticTab";
import TranslateHeader from "@/lib/components/TranslateHeader";
import { IconSymbol } from "@/lib/components/ui/IconSymbol";
import TabBarBackground from "@/lib/components/ui/TabBarBackground";
import { Colors } from "@/lib/constants/Colors";
import { userAtom } from "@/lib/states";
import { mmkvStorage } from "@/lib/storage";

export default function TabLayout() {
	const { signedIn } = useAtomValue(userAtom);
	const colorScheme = useColorScheme();
	const [liquidGlassEnabled] = useMMKVStorage("liquidGlassEnabled", mmkvStorage, isLiquidGlassAvailable());

	return (
		<>
			<When condition={liquidGlassEnabled}>
				<NativeTabs
					minimizeBehavior="automatic"
					labelStyle={{
						color: DynamicColorIOS({
							dark: "white",
							light: "black"
						})
					}}
				>
					<NativeTabs.Trigger
						name="index"
						options={{
							title: "Translate"
						}}
					>
						{Platform.select({
							ios: <Icon sf="globe" selectedColor={"purple"} />,
							android: <VectorIcon family={MaterialIcons} name="translate" />
						})}
					</NativeTabs.Trigger>
					<NativeTabs.Trigger
						name="you"
						options={{
							title: "You"
						}}
					>
						{Platform.select({
							ios: <Icon sf="person.fill" selectedColor={"purple"} />,
							android: <VectorIcon family={MaterialIcons} name="person" />
						})}
					</NativeTabs.Trigger>
				</NativeTabs>
			</When>
			<Unless condition={liquidGlassEnabled}>
				<Tabs
					screenOptions={{
						tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
						// headerShown: false,
						tabBarButton: signedIn ? HapticTab : () => <></>,
						tabBarBackground: TabBarBackground,
						tabBarStyle: {
							...Platform.select({
								ios: {
									// Use a transparent background on iOS to show the blur effect
									position: "absolute"
								},
								default: {}
							})
						}
					}}
				>
					<Tabs.Screen
						name="index"
						options={{
							headerTitle: ({ children }) => <TranslateHeader>{children}</TranslateHeader>,
							title: "Translate",
							tabBarIcon: ({ color }) => <IconSymbol size={28} name="translate" color={color} />
						}}
					/>
					<Tabs.Screen
						name="you"
						options={{
							title: "You",
							tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
							headerShown: false
						}}
					/>
				</Tabs>
			</Unless>
		</>
	);
}
