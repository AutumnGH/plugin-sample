export type AIProvider = "deepseek" | "minimax" | "custom";

export interface AIProviderConfig {
    baseURL: string;
    apiKey: string;
    model: string;
}

export interface MessageNoteConfig {
    provider: AIProvider;
    deepseek: AIProviderConfig;
    minimax: AIProviderConfig;
    custom: AIProviderConfig;
    systemPrompt: string;
}

export const DEFAULT_CONFIG: MessageNoteConfig = {
    provider: "deepseek",
    deepseek: { baseURL: "https://api.deepseek.com/v1", apiKey: "", model: "deepseek-chat" },
    minimax: { baseURL: "https://api.minimax.chat/v1", apiKey: "", model: "abab6.5s-chat" },
    custom: { baseURL: "", apiKey: "", model: "" },
    systemPrompt: "你是一个日记助手。请根据用户今天的消息记录，生成一篇自然流畅、有情感温度的日记。",
};

export interface Message {
    id: string;        // SiYuan block ID
    content: string;
    timestamp: string; // HH:mm display
    isoTime: string;   // full ISO string
}
