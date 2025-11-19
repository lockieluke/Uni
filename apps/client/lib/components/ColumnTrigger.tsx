import FontAwesome from "@expo/vector-icons/FontAwesome";
import { When } from "react-if";
import { Text, TouchableOpacity } from "react-native";
import { cn } from "@/lib/utils";

export default function ColumnTrigger({
	children,
	className,
	onPress,
	subpage = false,
}: {
	children: string | React.ReactNode;
	className?: string;
	onPress?: () => void;
	subpage?: boolean;
}) {
	return (
		<TouchableOpacity
			activeOpacity={0.8}
			onPress={() => onPress?.()}
			className={cn(
				"bg-slate-200 dark:bg-zinc-900 w-[90vw] flex flex-row justify-between items-center p-4 rounded-lg",
				className,
			)}
		>
			{typeof children === "string" ? (
				<Text className="text-md text-t-primary font-semibold">{children}</Text>
			) : (
				children
			)}
			<When condition={subpage}>
				<FontAwesome
					style={{
						textAlign: "center",
					}}
					name="angle-right"
					size={20}
					color="black"
				/>
			</When>
		</TouchableOpacity>
	);
}
