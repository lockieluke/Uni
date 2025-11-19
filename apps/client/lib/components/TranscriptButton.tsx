import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
	useAnimatedStyle,
	useSharedValue,
	withSpring
} from "react-native-reanimated";
import { cn } from "@/lib/utils";
import AnimatedTouchable from "./AnimatedTouchable";

export default function TranscriptButton({
	className,
	onPressIn,
	onPressOut
}: {
	className?: string;
	onPressIn?: () => void;
	onPressOut?: () => void;
}) {
	const scale = useSharedValue(1);

	const animatedStyle = useAnimatedStyle(() => {
		return {
			transform: [{ scale: withSpring(scale.value) }]
		};
	});

	return (
		<AnimatedTouchable
			activeOpacity={1}
			onPressIn={() => {
				scale.value = 0.9;
				onPressIn?.();
			}}
			onPressOut={() => {
				scale.value = 1;
				onPressOut?.();
			}}
			style={animatedStyle}
			className={cn(
				"bg-purple-600 flex w-28 h-28 items-center justify-center rounded-full",
				className
			)}
		>
			<FontAwesome
				className={"text-center"}
				name="microphone"
				size={40}
				color="white"
			/>
		</AnimatedTouchable>
	);
}
