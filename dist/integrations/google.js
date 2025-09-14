import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { SpeechClient } from '@google-cloud/speech';
import { VertexAI } from '@google-cloud/vertexai';
export class GoogleAI {
    ttsClient;
    sttClient;
    vertex;
    projectId;
    location;
    constructor(config) {
        this.projectId = config.projectId;
        this.location = config.location;
        this.ttsClient = new TextToSpeechClient();
        this.sttClient = new SpeechClient();
        this.vertex = this.projectId ? new VertexAI({ project: this.projectId, location: this.location }) : null;
    }
    async synthesizeTextToSpeech(text, voiceName = 'en-US-Neural2-F', speakingRate = 1.05) {
        const [response] = await this.ttsClient.synthesizeSpeech({
            input: { text },
            voice: { languageCode: 'en-US', name: voiceName },
            audioConfig: { audioEncoding: 'MP3', speakingRate }
        });
        const audio = response.audioContent;
        if (!audio)
            throw new Error('No audio content from TTS');
        return Buffer.from(audio);
    }
    async transcribeShortAudio(buffer, languageCode = 'en-US') {
        const [result] = await this.sttClient.recognize({
            audio: { content: buffer.toString('base64') },
            config: {
                languageCode,
                encoding: 'MP3',
                enableAutomaticPunctuation: true,
                model: 'latest_long'
            }
        });
        const transcript = result.results?.map((r) => r.alternatives?.[0]?.transcript ?? '').join(' ').trim() ?? '';
        return transcript;
    }
    async chat(prompt, system) {
        if (!this.vertex) {
            return '[Vertex AI not configured. Set GOOGLE_PROJECT_ID to enable chat]';
        }
        const model = this.vertex.getGenerativeModel({ model: 'gemini-1.5-pro' });
        const input = [
            system ? { role: 'system', parts: [{ text: system }] } : null,
            { role: 'user', parts: [{ text: prompt }] }
        ].filter(Boolean);
        const resp = await model.generateContent({ contents: input });
        const text = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return text;
    }
}
