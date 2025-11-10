import { When } from "react-if";
import { Switch, Text, TextInput, View } from "react-native";
import ColumnTrigger from "./ColumnTrigger";
import { useMMKVStorage } from "react-native-mmkv-storage";
import * as Device from "expo-device";
import { mmkvStorage } from "@/lib/storage";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { cn } from "../utils";

export default function DevServerSetting() {
    const [useDevServer, setUseDevServer] = useMMKVStorage("useDevServer", mmkvStorage, false);
    const [devServerUrl, setDevServerUrl] = useMMKVStorage("devServerUrl", mmkvStorage, "http://127.0.0.1:8787");
    const [liquidGlassEnabled] = useMMKVStorage("liquidGlassEnabled", mmkvStorage, isLiquidGlassAvailable());

    const AdaptiveColumnTrigger = liquidGlassEnabled ? GlassView : ColumnTrigger;

    return (<AdaptiveColumnTrigger glassEffectStyle="clear" className={cn({
      "p-5 mx-5 rounded-xl": liquidGlassEnabled,
    })}>
        <View className="flex-col w-full">
            <View className="flex w-full flex-row items-center justify-between">
                <Text className="text-t-primary font-semibold text-md">Use Dev Server</Text>
                <Switch value={useDevServer} onValueChange={setUseDevServer} />
            </View>
            <When condition={useDevServer && Device.isDevice}>
                <TextInput
                    className="my-3 text-t-primary"
                    onChange={e => setDevServerUrl(e.nativeEvent.text)}
                    value={devServerUrl}
                    enterKeyHint="done"
                    placeholder="Dev Server URL"
                />
            </When>
        </View>
    </AdaptiveColumnTrigger>);
}
