export async function openrouter(payload: object) {
    return await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.EXPO_PUBLIC_OPEN_ROUTER_API}`
        },
        body: JSON.stringify(payload)
    });
}
