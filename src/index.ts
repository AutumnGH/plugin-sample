import { Plugin, Setting, showMessage, getFrontend } from "siyuan";
import "./index.scss";
import { MessageNoteConfig, DEFAULT_CONFIG, AIProvider } from "./types";
import { MessageDock } from "./dock/MessageDock";

const CONFIG_KEY = "config";
const DOCK_TYPE = "mn_dock";

export default class MessageNotePlugin extends Plugin {
    private isMobile: boolean;
    config: MessageNoteConfig = { ...DEFAULT_CONFIG };

    onload() {
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

        this.addIcons(`<symbol id="iconMessageNote" viewBox="0 0 32 32">
<path d="M28 4H4C2.9 4 2 4.9 2 6v16c0 1.1.9 2 2 2h6l4 4 4-4h10c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 14H6v-2h20v2zm0-4H6v-2h20v2zm0-4H6V8h20v2z"/>
</symbol>
<symbol id="iconSparkles" viewBox="0 0 32 32">
<path d="M16 2l2.5 8.5L27 13l-8.5 2.5L16 24l-2.5-8.5L5 13l8.5-2.5L16 2zm8 16l1.25 4.25L29.5 23.5l-4.25 1.25L24 29l-1.25-4.25L18.5 23.5l4.25-1.25L24 18zm-14 0l1.25 4.25L11.5 23.5l-4.25 1.25L6 29l-1.25-4.25L.5 23.5l4.25-1.25L6 18z"/>
</symbol>`);

        this.addDock({
            config: {
                position: "LeftBottom",
                size: { width: 280, height: 0 },
                icon: "iconMessageNote",
                title: "MessageNote",
                hotkey: "⌥⌘N",
            },
            data: {},
            type: DOCK_TYPE,
            init: (dock) => {
                const dockInstance = new MessageDock(
                    dock.element,
                    this.i18n,
                    () => this.config
                );
                dockInstance.init();
            },
            destroy() {
                console.log("destroy dock:", DOCK_TYPE);
            },
        });

        this.initSettings();
    }

    async onLayoutReady() {
        // Config is loaded here (after onload) because loadData requires the
        // kernel to be ready. initSettings() uses createActionElement lazily,
        // so the settings panel always reads the up-to-date config when opened.
        const saved = await this.loadData(CONFIG_KEY).catch(() => null);
        if (saved) {
            this.config = this.mergeConfig(saved);
        }
    }

    onunload() {
        console.log(this.i18n.byePlugin);
    }

    private mergeConfig(saved: Partial<MessageNoteConfig>): MessageNoteConfig {
        return {
            ...DEFAULT_CONFIG,
            ...saved,
            deepseek: { ...DEFAULT_CONFIG.deepseek, ...(saved.deepseek || {}) },
            minimax: { ...DEFAULT_CONFIG.minimax, ...(saved.minimax || {}) },
            custom: { ...DEFAULT_CONFIG.custom, ...(saved.custom || {}) },
        };
    }

    private initSettings() {
        const providers: AIProvider[] = ["deepseek", "minimax", "custom"];

        // Provider select
        const providerSelect = document.createElement("select");
        providerSelect.className = "b3-select fn__block";
        providers.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p;
            opt.textContent = p;
            providerSelect.appendChild(opt);
        });

        // API Key input
        const apiKeyInput = document.createElement("input");
        apiKeyInput.className = "b3-text-field fn__block";
        apiKeyInput.type = "password";
        apiKeyInput.placeholder = "sk-...";

        // Base URL input
        const baseURLInput = document.createElement("input");
        baseURLInput.className = "b3-text-field fn__block";
        baseURLInput.placeholder = "https://api.example.com/v1";

        // Model input
        const modelInput = document.createElement("input");
        modelInput.className = "b3-text-field fn__block";
        modelInput.placeholder = "model-name";

        // System prompt textarea
        const systemPromptInput = document.createElement("textarea");
        systemPromptInput.className = "b3-text-field fn__block";
        systemPromptInput.rows = 4;

        const syncFieldsFromProvider = (provider: AIProvider) => {
            const cfg = this.config[provider];
            apiKeyInput.value = cfg.apiKey;
            baseURLInput.value = cfg.baseURL;
            modelInput.value = cfg.model;
            systemPromptInput.value = this.config.systemPrompt;
            baseURLInput.disabled = provider !== "custom";
        };

        providerSelect.addEventListener("change", () => {
            this.config.provider = providerSelect.value as AIProvider;
            syncFieldsFromProvider(this.config.provider);
        });

        this.setting = new Setting({
            confirmCallback: () => {
                const provider = providerSelect.value as AIProvider;
                this.config.provider = provider;
                this.config[provider].apiKey = apiKeyInput.value;
                this.config[provider].baseURL = baseURLInput.value;
                this.config[provider].model = modelInput.value;
                this.config.systemPrompt = systemPromptInput.value;
                this.saveData(CONFIG_KEY, this.config).catch(e => {
                    showMessage(`[MessageNote] save config fail: ${e}`);
                });
            },
        });

        this.setting.addItem({
            title: this.i18n.settingProvider,
            description: this.i18n.settingProviderDesc,
            createActionElement: () => {
                providerSelect.value = this.config.provider;
                syncFieldsFromProvider(this.config.provider);
                return providerSelect;
            },
        });

        this.setting.addItem({
            title: this.i18n.settingApiKey,
            description: this.i18n.settingApiKeyDesc,
            createActionElement: () => apiKeyInput,
        });

        this.setting.addItem({
            title: this.i18n.settingBaseURL,
            description: this.i18n.settingBaseURLDesc,
            createActionElement: () => baseURLInput,
        });

        this.setting.addItem({
            title: this.i18n.settingModel,
            description: this.i18n.settingModelDesc,
            createActionElement: () => modelInput,
        });

        this.setting.addItem({
            title: this.i18n.settingSystemPrompt,
            description: this.i18n.settingSystemPromptDesc,
            createActionElement: () => systemPromptInput,
        });
    }
}
