import { UserTierSchema } from "@/lib/user";
import { cn } from "@/lib/utils";
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from "react-native";
import { z } from "zod";

export default function TierBadge({
  tier,
  className
}: {
  tier: z.infer<typeof UserTierSchema>,
  className?: string
}) {
  return (<LinearGradient
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
  </LinearGradient>);
}
