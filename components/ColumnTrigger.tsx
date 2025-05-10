import { cn } from "@/lib/utils";
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { When } from "react-if";
import { Text, TouchableOpacity } from "react-native";

export default function ColumnTrigger({children, className, onPress, subpage = false}: {
    children: string;
    className?: string;
    onPress?: () => void;
    subpage?: boolean;
}) {
    return (<TouchableOpacity activeOpacity={0.8} onPress={() => onPress?.()} className={cn("bg-slate-200 w-[90vw] flex flex-row justify-between items-center p-4 rounded-lg", className)}>
        <Text className="font-semibold">{children}</Text>
        <When condition={subpage}>
            <FontAwesome style={{
                textAlign: "center"
            }} name="angle-right" size={20} color="black" />
        </When>
    </TouchableOpacity>)
}