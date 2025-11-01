import { cn } from "@/lib/utils";
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import AnimatedTouchable from "./AnimatedTouchable";

export default function TranscriptButton({ className, onPressIn, onPressOut }: {
    className?: string;
    onPressIn?: () => void;
    onPressOut?: () => void;
}) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const handleScaleAnimation = (value: number) => {
        scale.value = withSpring(value, {
            damping: 5,
            stiffness: 130,
        });
    }

    return (
        <AnimatedTouchable
            activeOpacity={1}
            onPressIn={() => {
                handleScaleAnimation(0.9);
                onPressIn?.();
            }}
            onPressOut={() => {
                handleScaleAnimation(1);
                onPressOut?.();
            }}
            style={animatedStyle}
            className={cn("bg-purple-600 flex w-28 h-28 items-center justify-center rounded-full", className)}
        >
            <FontAwesome className={"text-center"} name="microphone" size={40} color="white" />
        </AnimatedTouchable>
    );
}
