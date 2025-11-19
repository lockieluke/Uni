import type { UniTiers } from "@uni/api";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "react-native";
import { cn } from "@/lib/utils";

export default function TierBadge({
	tier,
	className
}: {
	tier: keyof typeof UniTiers;
	className?: string;
}) {
	return (
		<LinearGradient
			className={cn("p-3 rounded-2xl flex-center", className)}
			start={{ x: 1, y: 1 }}
			end={{ x: 0, y: 0 }}
			colors={["#9333EA", "#9E5CF1"]}
		>
			<Text className="text-white font-bold">
				{tier === "free" && "Free"}
				{tier === "basic" && "Basic"}
				{tier === "max" && "Max"}
			</Text>
		</LinearGradient>
	);
}
