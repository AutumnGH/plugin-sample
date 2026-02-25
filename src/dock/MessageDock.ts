import { fetchPost, showMessage } from "siyuan";
import { Message, MessageNoteConfig } from "../types";
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

    private listEl: HTMLElement;
    private textareaEl: HTMLTextAreaElement;
    private sendBtn: HTMLButtonElement;
    private aiBtn: HTMLElement;

    private notebookId = "";
    private docId = "";
    private messages: Message[] = [];

    constructor(element: HTMLElement, i18n: any, getConfig: () => MessageNoteConfig) {
        this.element = element;
        this.i18n = i18n;
        this.getConfig = getConfig;
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
      <span class="mn__hint">Enter 发送 · Shift+Enter 换行</span>
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
                await this.ensureNotebook();
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
            showMessage(`[MessageNote] 发送失败: ${e.message}`);
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
            const diary = await client.chat(config.systemPrompt, messagesText);

            // Find user's main notebook (first non-MessageNote, non-closed notebook)
            const data = await apiPost<{ notebooks: any[] }>("/api/notebook/lsNotebooks", {});
            const notebooks = data.notebooks || [];
            const mainNotebook = notebooks.find((nb: any) => nb.name !== NOTEBOOK_NAME && !nb.closed);
            if (!mainNotebook) {
                showMessage("[MessageNote] 未找到可用笔记本");
                return;
            }

            const dailyNoteResult = await apiPost<{ id: string }>("/api/filetree/createDailyNote", {
                notebook: mainNotebook.id,
            });
            const dailyNoteId = dailyNoteResult?.id;
            if (!dailyNoteId) {
                showMessage("[MessageNote] 创建 Daily Note 失败");
                return;
            }

            await apiPost("/api/block/appendBlock", {
                parentID: dailyNoteId,
                dataType: "markdown",
                data: diary,
            });

            showMessage(this.i18n.generateSuccess);
        } catch (e) {
            console.error("[MessageNote] generateDiary error:", e);
            showMessage(`${this.i18n.generateFail}: ${e.message}`);
        } finally {
            this.aiBtn.classList.remove("mn__ai-btn--loading");
        }
    }
}
