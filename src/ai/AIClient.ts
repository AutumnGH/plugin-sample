export class AIClient {
    constructor(
        private baseURL: string,
        private apiKey: string,
        private model: string
    ) {}

    async chat(systemPrompt: string, userContent: string): Promise<string> {
        const url = `${this.baseURL.replace(/\/$/, "")}/chat/completions`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent },
                ],
                temperature: 0.7,
                max_tokens: 2000,
            }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.choices[0].message.content;
    }
}
