import { fetchPost, showMessage } from "siyuan";
import { Message, MessageNoteConfig, newSiYuanId } from "../types";
import { AIClient } from "../ai/AIClient";

const NOTEBOOK_NAME = "MessageNote";

function todayStr(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function timeStr(date: Date): string {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function apiPost<T = any>(url: string, data: object): Promise<T> {
    return new Promise((resolve, reject) => {
        fetchPost(url, data, (res: any) => {
            if (res.code !== 0) {
                reject(new Error(res.msg || `API error: ${url}`));
            } else {
                resolve(res.data as T);
            }
        });
    });
}

export class MessageDock {
    private element: HTMLElement;
    private i18n: any;
    private getConfig: () => MessageNoteConfig;
    private saveConfig: (patch: Partial<MessageNoteConfig>) => Promise<void>;

    private listEl: HTMLElement;
    private textareaEl: HTMLTextAreaElement;
    private sendBtn: HTMLButtonElement;
    private aiBtn: HTMLElement;

    private notebookId = "";
    private docId = "";
    private messages: Message[] = [];

    constructor(
        element: HTMLElement,
        i18n: any,
        getConfig: () => MessageNoteConfig,
        saveConfig: (patch: Partial<MessageNoteConfig>) => Promise<void>,
    ) {
        this.element = element;
        this.i18n = i18n;
        this.getConfig = getConfig;
        this.saveConfig = saveConfig;
    }

    async init() {
        this.render();
        this.bindEvents();
        try {
            await this.ensureNotebook();
            await this.ensureDoc();
            await this.loadMessages();
            this.renderMessages();
            this.scrollToBottom();
        } catch (e) {
            console.error("[MessageNote] init error:", e);
        }
    }

    private render() {
        this.element.innerHTML = `<div class="fn__flex-1 fn__flex-column mn__dock">
  <div class="block__icons">
    <div class="block__logo">
      <svg class="block__logoicon"><use xlink:href="#iconMessageNote"></use></svg>
      MessageNote
    </div>
    <span class="fn__flex-1 fn__space"></span>
    <span class="block__icon b3-tooltips b3-tooltips__sw mn__ai-btn" aria-label="${this.i18n.generateDiary}">
      <svg><use xlink:href="#iconSparkles"></use></svg>
    </span>
    <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="Min">
      <svg><use xlink:href="#iconMin"></use></svg>
    </span>
  </div>
  <div class="fn__flex-1 mn__list"></div>
  <div class="mn__input-area">
    <textarea class="b3-text-field mn__textarea" rows="3" placeholder="${this.i18n.sendPlaceholder}"></textarea>
    <div class="mn__actions">
      <span class="mn__hint">${this.i18n.inputHint}</span>
      <button class="b3-button b3-button--text mn__send-btn">${this.i18n.send}</button>
    </div>
  </div>
</div>`;

        this.listEl = this.element.querySelector(".mn__list");
        this.textareaEl = this.element.querySelector(".mn__textarea");
        this.sendBtn = this.element.querySelector(".mn__send-btn");
        this.aiBtn = this.element.querySelector(".mn__ai-btn");
    }

    private bindEvents() {
        this.textareaEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.sendBtn.addEventListener("click", () => this.sendMessage());
        this.aiBtn.addEventListener("click", () => this.generateDiary());
    }

    private async ensureNotebook() {
        const data = await apiPost<{ notebooks: any[] }>("/api/notebook/lsNotebooks", {});
        const notebooks = data.notebooks || [];
        // Find by name regardless of closed status
        const existing = notebooks.find((nb: any) => nb.name === NOTEBOOK_NAME);
        if (existing) {
            this.notebookId = existing.id;
            if (existing.closed) {
                await apiPost("/api/notebook/openNotebook", { notebook: existing.id });
            }
        } else {
            const created = await apiPost<{ notebook: any }>("/api/notebook/createNotebook", { name: NOTEBOOK_NAME });
            this.notebookId = created.notebook.id;
        }
    }

    private async ensureDoc() {
        if (!this.notebookId) throw new Error("notebookId is empty");
        const today = todayStr();
        let rows: any[] = [];
        try {
            rows = await apiPost<any[]>("/api/sql/query", {
                stmt: `SELECT id FROM blocks WHERE type='d' AND box='${this.notebookId}' AND hpath='/${today}' LIMIT 1`,
            });
        } catch (e) {
            console.warn("[MessageNote] ensureDoc query failed, will create doc:", e);
        }
        if (rows && rows.length > 0) {
            this.docId = rows[0].id;
        } else {
            const docId = await apiPost<string>("/api/filetree/createDocWithMd", {
                notebook: this.notebookId,
                path: `/${today}`,
                markdown: "",
            });
            this.docId = docId;
        }
    }

    private async loadMessages() {
        if (!this.docId) return;
        let rows: any[] = [];
        try {
            rows = await apiPost<any[]>("/api/sql/query", {
                stmt: `SELECT id, content, ial, created FROM blocks WHERE type='p' AND root_id='${this.docId}' AND ial LIKE '%custom-mn-type="message"%' ORDER BY created ASC`,
            });
        } catch (e) {
            console.warn("[MessageNote] loadMessages query failed:", e);
        }
        this.messages = (rows || []).map((row: any) => {
            const isoMatch = row.ial.match(/custom-mn-ts="([^"]+)"/);
            const isoTime = isoMatch ? isoMatch[1] : row.created;
            const date = new Date(isoTime);
            return {
                id: row.id,
                content: row.content,
                timestamp: timeStr(isNaN(date.getTime()) ? new Date() : date),
                isoTime,
            };
        });
    }

    private renderMessages() {
        this.listEl.innerHTML = "";
        for (const msg of this.messages) {
            this.listEl.appendChild(this.createBubble(msg));
        }
    }

    private createBubble(msg: Message): HTMLElement {
        const div = document.createElement("div");
        div.className = "mn__bubble-wrap";
        div.innerHTML = `<div class="mn__bubble">${this.escapeHtml(msg.content)}</div><div class="mn__time">${msg.timestamp}</div>`;
        return div;
    }

    private escapeHtml(text: string): string {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    }

    private scrollToBottom() {
        this.listEl.scrollTop = this.listEl.scrollHeight;
    }

    private async sendMessage() {
        const content = this.textareaEl.value.trim();
        if (!content) return;
        this.textareaEl.value = "";
        this.textareaEl.disabled = true;
        this.sendBtn.disabled = true;

        try {
            if (!this.docId) {
                if (!this.notebookId) await this.ensureNotebook();
                await this.ensureDoc();
            }
            const now = new Date();
            const isoTime = now.toISOString();
            const markdown = `${content}\n{: custom-mn-type="message" custom-mn-ts="${isoTime}"}`;
            const result = await apiPost<{ doOperations: any[] }>("/api/block/appendBlock", {
                parentID: this.docId,
                dataType: "markdown",
                data: markdown,
            });
            const blockId = result?.doOperations?.[0]?.id || "";
            if (blockId) {
                await apiPost("/api/attr/setBlockAttrs", {
                    id: blockId,
                    attrs: { "custom-mn-type": "message", "custom-mn-ts": isoTime },
                });
            }
            const msg: Message = { id: blockId, content, timestamp: timeStr(now), isoTime };
            this.messages.push(msg);
            this.listEl.appendChild(this.createBubble(msg));
            this.scrollToBottom();
        } catch (e) {
            console.error("[MessageNote] sendMessage error:", e);
            showMessage(`[MessageNote] 发送失败: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            this.textareaEl.disabled = false;
            this.sendBtn.disabled = false;
            this.textareaEl.focus();
        }
    }

    private async generateDiary() {
        if (this.messages.length === 0) {
            showMessage(this.i18n.noMessages);
            return;
        }
        const config = this.getConfig();
        const providerCfg = config[config.provider];
        if (!providerCfg.apiKey) {
            showMessage(this.i18n.configApiKey);
            return;
        }

        this.aiBtn.classList.add("mn__ai-btn--loading");
        try {
            const client = new AIClient(providerCfg.baseURL, providerCfg.apiKey, providerCfg.model);
            const messagesText = this.messages.map(m => `[${m.timestamp}] ${m.content}`).join("\n");
            showMessage(this.i18n.generating);
            const diary = await client.chat(config.systemPrompt, messagesText);

            // Ensure diary database exists in MessageNote notebook
            const { avId, dateKeyId, contentKeyId } = await this.ensureDiaryDatabase();

            // Append a detached row with date + content
            const now = new Date();
            const dateMs = now.setHours(0, 0, 0, 0);  // midnight of today, ms
            const blockKeyId = await this.getDiaryBlockKeyId(avId);
            await apiPost("/api/av/appendAttributeViewDetachedBlocksWithValues", {
                avID: avId,
                blocksValues: [[
                    {
                        keyID: blockKeyId,
                        type: "block",
                        block: { content: todayStr(), id: "" },
                    },
                    {
                        keyID: dateKeyId,
                        type: "date",
                        date: {
                            content: dateMs,
                            isNotEmpty: true,
                            isNotTime: true,
                            hasEndDate: false,
                            content2: 0,
                            isNotEmpty2: false,
                        },
                    },
                    {
                        keyID: contentKeyId,
                        type: "text",
                        text: { content: diary },
                    },
                ]],
            });

            showMessage(this.i18n.generateSuccess);
        } catch (e) {
            console.error("[MessageNote] generateDiary error:", e);
            showMessage(`${this.i18n.generateFail}: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            this.aiBtn.classList.remove("mn__ai-btn--loading");
        }
    }

    /**
     * Ensures the diary index page and database exist in the MessageNote notebook.
     * Creates them on first run and persists avId/docId to config.
     * Returns the avId and column key IDs.
     */
    private async ensureDiaryDatabase(): Promise<{ avId: string; dateKeyId: string; contentKeyId: string }> {
        const config = this.getConfig();

        // If we already have a valid avId, verify it still exists
        if (config.diaryAvId) {
            try {
                const av = await apiPost<{ av: any }>("/api/av/getAttributeView", { id: config.diaryAvId });
                if (av?.av) {
                    // AV exists — retrieve key IDs from it
                    const keys = await apiPost<any[]>("/api/av/getAttributeViewKeys", { id: config.diaryDocId });
                    const dateKey = (keys || []).find((k: any) => k.key?.type === "date");
                    const contentKey = (keys || []).find((k: any) => k.key?.type === "text");
                    if (dateKey && contentKey) {
                        return { avId: config.diaryAvId, dateKeyId: dateKey.key.id, contentKeyId: contentKey.key.id };
                    }
                }
            } catch (_) {
                // AV gone — fall through to recreate
            }
        }

        // Ensure notebook exists
        if (!this.notebookId) await this.ensureNotebook();

        // Create or find the diary index page
        const DIARY_PATH = "/DiaryDatabase";
        let diaryDocId = "";
        try {
            const rows = await apiPost<any[]>("/api/sql/query", {
                stmt: `SELECT id FROM blocks WHERE type='d' AND box='${this.notebookId}' AND hpath='${DIARY_PATH}' LIMIT 1`,
            });
            if (rows && rows.length > 0) diaryDocId = rows[0].id;
        } catch (_) { /* ignore */ }

        // Generate IDs for the new database block and columns
        const avId = newSiYuanId();
        const dateKeyId = newSiYuanId();
        const contentKeyId = newSiYuanId();

        if (!diaryDocId) {
            // Create the diary index page with the database block embedded
            const dbDom = `<div data-node-id="${newSiYuanId()}" data-type="NodeAttributeView" data-av-id="${avId}" data-av-type="table" class="av"></div>`;
            diaryDocId = await apiPost<string>("/api/filetree/createDocWithMd", {
                notebook: this.notebookId,
                path: DIARY_PATH,
                markdown: "",
            });
            // Append the database block as DOM
            await apiPost("/api/block/appendBlock", {
                parentID: diaryDocId,
                dataType: "dom",
                data: dbDom,
            });
        } else {
            // Page exists — check if it already has a database block
            const children = await apiPost<any[]>("/api/block/getChildBlocks", { id: diaryDocId });
            const existingAv = (children || []).find((b: any) => b.type === "av");
            if (existingAv) {
                // Use the existing AV — get its avId from block attrs
                const attrs = await apiPost<Record<string, string>>("/api/attr/getBlockAttrs", { id: existingAv.id });
                const existingAvId = attrs?.["av-id"] || "";
                if (existingAvId) {
                    // Retrieve key IDs
                    const keys = await apiPost<any[]>("/api/av/getAttributeViewKeys", { id: existingAv.id });
                    const dateKey = (keys || []).find((k: any) => k.key?.type === "date");
                    const contentKey = (keys || []).find((k: any) => k.key?.type === "text");
                    if (dateKey && contentKey) {
                        await this.saveConfig({ diaryAvId: existingAvId, diaryDocId });
                        return { avId: existingAvId, dateKeyId: dateKey.key.id, contentKeyId: contentKey.key.id };
                    }
                }
            } else {
                // Page exists but no AV block — insert one
                const dbDom = `<div data-node-id="${newSiYuanId()}" data-type="NodeAttributeView" data-av-id="${avId}" data-av-type="table" class="av"></div>`;
                await apiPost("/api/block/appendBlock", {
                    parentID: diaryDocId,
                    dataType: "dom",
                    data: dbDom,
                });
            }
        }

        // Add date column
        await apiPost("/api/av/addAttributeViewKey", {
            avID: avId,
            keyID: dateKeyId,
            keyName: this.i18n.diaryDateCol,
            keyType: "date",
            keyIcon: "",
            previousKeyID: "",
        });

        // Add content column
        await apiPost("/api/av/addAttributeViewKey", {
            avID: avId,
            keyID: contentKeyId,
            keyName: this.i18n.diaryContentCol,
            keyType: "text",
            keyIcon: "",
            previousKeyID: dateKeyId,
        });

        // Persist to config
        await this.saveConfig({ diaryAvId: avId, diaryDocId });

        return { avId, dateKeyId, contentKeyId };
    }

    /** Get the primary block key ID of an attribute view. */
    private async getDiaryBlockKeyId(avId: string): Promise<string> {
        const config = this.getConfig();
        const keys = await apiPost<any[]>("/api/av/getAttributeViewKeys", { id: config.diaryDocId });
        const blockKey = (keys || []).find((k: any) => k.key?.type === "block");
        return blockKey?.key?.id || "";
    }
}
