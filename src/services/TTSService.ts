import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { TTSRequest } from '../types';

export class TTSService extends EventEmitter {
  private audioOutputPath: string = '/tmp/tts-audio';
  private isEnabled: boolean = true;

  constructor() {
    super();
    this.ensureAudioDirectory();
  }

  private ensureAudioDirectory(): void {
    if (!fs.existsSync(this.audioOutputPath)) {
      fs.mkdirSync(this.audioOutputPath, { recursive: true });
    }
  }

  async synthesizeSpeech(request: TTSRequest): Promise<string> {
    if (!this.isEnabled) {
      throw new Error('TTS service is disabled');
    }

    try {
      // Mock TTS implementation
      // In a real implementation, you'd use Google Cloud Text-to-Speech API
      const audioFilePath = await this.generateMockAudio(request);
      
      this.emit('speech-synthesized', {
        request,
        audioFilePath,
        timestamp: new Date()
      });

      return audioFilePath;
      
    } catch (error) {
      console.error('❌ TTS synthesis failed:', error);
      throw error;
    }
  }

  private async generateMockAudio(request: TTSRequest): Promise<string> {
    // Generate a mock audio file (silent audio for demonstration)
    const timestamp = Date.now();
    const filename = `tts-${timestamp}.wav`;
    const filepath = path.join(this.audioOutputPath, filename);

    // Create a simple WAV header for a 1-second silent audio
    const sampleRate = 44100;
    const duration = 1; // seconds
    const numSamples = sampleRate * duration;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = numSamples * blockAlign;
    const fileSize = 44 + dataSize;

    const buffer = Buffer.alloc(fileSize);
    let offset = 0;

    // WAV header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // PCM format size
    buffer.writeUInt16LE(1, offset); offset += 2; // PCM format
    buffer.writeUInt16LE(numChannels, offset); offset += 2;
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(byteRate, offset); offset += 4;
    buffer.writeUInt16LE(blockAlign, offset); offset += 2;
    buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;

    // Silent audio data (all zeros)
    for (let i = 0; i < numSamples; i++) {
      buffer.writeInt16LE(0, offset);
      offset += 2;
    }

    fs.writeFileSync(filepath, buffer);
    
    console.log(`🔊 Mock TTS audio generated: ${filename} for text: "${request.text}"`);
    return filepath;
  }

  async playAudio(audioFilePath: string): Promise<void> {
    // Mock audio playback
    console.log(`🎵 Playing audio: ${path.basename(audioFilePath)}`);
    
    this.emit('audio-playing', {
      audioFilePath,
      timestamp: new Date()
    });

    // Simulate playback duration
    setTimeout(() => {
      this.emit('audio-finished', {
        audioFilePath,
        timestamp: new Date()
      });
    }, 1000);
  }

  async speakText(text: string, personality: string = 'default'): Promise<void> {
    const request: TTSRequest = {
      text,
      personality,
      voice: this.getVoiceForPersonality(personality)
    };

    const audioFilePath = await this.synthesizeSpeech(request);
    await this.playAudio(audioFilePath);
  }

  private getVoiceForPersonality(personality: string): string {
    const voiceMap: { [key: string]: string } = {
      'tsukiko': 'en-US-Standard-C',
      'sassy': 'en-US-Standard-E',
      'pro': 'en-US-Standard-B',
      'hype': 'en-US-Standard-D',
      'zen': 'en-US-Standard-A',
      'default': 'en-US-Standard-C'
    };

    return voiceMap[personality] || voiceMap['default'];
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`TTS service ${enabled ? 'enabled' : 'disabled'}`);
  }

  isServiceEnabled(): boolean {
    return this.isEnabled;
  }

  getAudioFiles(): string[] {
    try {
      return fs.readdirSync(this.audioOutputPath)
        .filter(file => file.endsWith('.wav'))
        .map(file => path.join(this.audioOutputPath, file));
    } catch (error) {
      console.error('Error reading audio files:', error);
      return [];
    }
  }

  cleanupOldAudio(): void {
    try {
      const files = fs.readdirSync(this.audioOutputPath)
        .filter(file => file.endsWith('.wav'))
        .map(file => ({
          name: file,
          path: path.join(this.audioOutputPath, file),
          mtime: fs.statSync(path.join(this.audioOutputPath, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the 20 most recent audio files
      const filesToDelete = files.slice(20);
      
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error(`Failed to delete old audio file ${file.name}:`, error);
        }
      });

    } catch (error) {
      console.error('Error cleaning up old audio files:', error);
    }
  }

  // Queue system for TTS requests
  private ttsQueue: TTSRequest[] = [];
  private isProcessingQueue: boolean = false;

  async queueSpeech(request: TTSRequest): Promise<void> {
    this.ttsQueue.push(request);
    
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.isProcessingQueue = true;

    while (this.ttsQueue.length > 0) {
      const request = this.ttsQueue.shift();
      if (request) {
        try {
          await this.speakText(request.text, request.personality);
        } catch (error) {
          console.error('Error processing TTS queue item:', error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  getQueueLength(): number {
    return this.ttsQueue.length;
  }

  clearQueue(): void {
    this.ttsQueue = [];
    console.log('TTS queue cleared');
  }
}