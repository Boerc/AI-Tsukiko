import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { ScreenAnalysis, DetectedObject, GameInfo } from '../types';

export class ScreenAnalysisService extends EventEmitter {
  private isAnalyzing: boolean = false;
  private analysisInterval: NodeJS.Timeout | null = null;
  private screenshotPath: string = '/tmp/screenshots';

  constructor() {
    super();
    this.ensureScreenshotDirectory();
  }

  private ensureScreenshotDirectory(): void {
    if (!fs.existsSync(this.screenshotPath)) {
      fs.mkdirSync(this.screenshotPath, { recursive: true });
    }
  }

  async startAnalysis(intervalMs: number = 5000): Promise<void> {
    if (this.isAnalyzing) {
      console.log('Screen analysis already running');
      return;
    }

    console.log('🖥️ Starting screen analysis...');
    this.isAnalyzing = true;

    this.analysisInterval = setInterval(async () => {
      try {
        await this.captureAndAnalyzeScreen();
      } catch (error) {
        console.error('❌ Error during screen analysis:', error);
      }
    }, intervalMs);

    // Initial analysis
    await this.captureAndAnalyzeScreen();
  }

  stopAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    this.isAnalyzing = false;
    console.log('🛑 Stopped screen analysis');
  }

  private async captureAndAnalyzeScreen(): Promise<void> {
    try {
      const screenshotBuffer = await this.captureScreen();
      const analysis = await this.analyzeScreenshot(screenshotBuffer);
      
      this.emit('analysis', analysis);
      
      // Save screenshot with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      const filepath = path.join(this.screenshotPath, filename);
      
      fs.writeFileSync(filepath, screenshotBuffer);
      
      // Clean up old screenshots (keep only last 10)
      this.cleanupOldScreenshots();
      
    } catch (error) {
      console.error('❌ Failed to capture and analyze screen:', error);
    }
  }

  private async captureScreen(): Promise<Buffer> {
    // For now, we'll create a mock screenshot
    // In a real implementation, you'd use screenshot-desktop or similar
    
    // Mock implementation - creates a simple colored rectangle
    const sharp = require('sharp');
    
    const mockImage = await sharp({
      create: {
        width: 1920,
        height: 1080,
        channels: 3,
        background: { r: 50, g: 100, b: 150 }
      }
    })
    .jpeg()
    .toBuffer();

    return mockImage;
  }

  private async analyzeScreenshot(imageBuffer: Buffer): Promise<ScreenAnalysis> {
    // Mock analysis - in a real implementation, you'd use Google Vision API or similar
    const mockObjects: DetectedObject[] = [
      {
        label: 'game_ui',
        confidence: 0.95,
        boundingBox: { x: 0, y: 0, width: 300, height: 100 }
      },
      {
        label: 'character',
        confidence: 0.87,
        boundingBox: { x: 960, y: 540, width: 100, height: 200 }
      },
      {
        label: 'health_bar',
        confidence: 0.92,
        boundingBox: { x: 50, y: 50, width: 200, height: 20 }
      }
    ];

    const mockGameInfo: GameInfo = {
      title: 'Unknown Game',
      genre: 'Action',
      scene: 'gameplay'
    };

    const suggestions = this.generateSuggestions(mockObjects, mockGameInfo);

    const analysis: ScreenAnalysis = {
      timestamp: new Date(),
      description: this.generateDescription(mockObjects),
      objects: mockObjects,
      gameInfo: mockGameInfo,
      suggestions
    };

    return analysis;
  }

  private generateDescription(objects: DetectedObject[]): string {
    if (objects.length === 0) {
      return 'Screen appears to be empty or unrecognizable.';
    }

    const highConfidenceObjects = objects
      .filter(obj => obj.confidence > 0.8)
      .map(obj => obj.label)
      .join(', ');

    if (highConfidenceObjects) {
      return `I can see ${highConfidenceObjects} on the screen.`;
    }

    return 'Various game elements are visible on screen.';
  }

  private generateSuggestions(objects: DetectedObject[], gameInfo?: GameInfo): string[] {
    const suggestions: string[] = [];

    // Health-based suggestions
    const healthBar = objects.find(obj => obj.label.includes('health'));
    if (healthBar && healthBar.confidence > 0.8) {
      suggestions.push('Keep an eye on your health!');
    }

    // UI-based suggestions
    const gameUI = objects.find(obj => obj.label.includes('ui'));
    if (gameUI) {
      suggestions.push('The game interface looks clean and organized.');
    }

    // Character-based suggestions
    const character = objects.find(obj => obj.label.includes('character'));
    if (character) {
      suggestions.push('Your character positioning looks good.');
    }

    // Game-specific suggestions
    if (gameInfo?.genre === 'Action') {
      suggestions.push('Stay alert for incoming threats!');
    }

    // Default suggestions if none generated
    if (suggestions.length === 0) {
      suggestions.push(
        'Looking good!',
        'The stream quality is excellent.',
        'Viewers are enjoying the gameplay.'
      );
    }

    return suggestions;
  }

  private cleanupOldScreenshots(): void {
    try {
      const files = fs.readdirSync(this.screenshotPath)
        .filter(file => file.startsWith('screenshot-') && file.endsWith('.png'))
        .map(file => ({
          name: file,
          path: path.join(this.screenshotPath, file),
          mtime: fs.statSync(path.join(this.screenshotPath, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the 10 most recent screenshots
      const filesToDelete = files.slice(10);
      
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error(`Failed to delete old screenshot ${file.name}:`, error);
        }
      });

    } catch (error) {
      console.error('Error cleaning up old screenshots:', error);
    }
  }

  getLatestScreenshot(): string | null {
    try {
      const files = fs.readdirSync(this.screenshotPath)
        .filter(file => file.startsWith('screenshot-') && file.endsWith('.png'))
        .map(file => ({
          name: file,
          path: path.join(this.screenshotPath, file),
          mtime: fs.statSync(path.join(this.screenshotPath, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      return files.length > 0 ? files[0].path : null;
    } catch (error) {
      console.error('Error getting latest screenshot:', error);
      return null;
    }
  }

  getAnalysisStatus(): { isAnalyzing: boolean; screenshotCount: number } {
    const screenshotCount = fs.existsSync(this.screenshotPath) 
      ? fs.readdirSync(this.screenshotPath).filter(f => f.endsWith('.png')).length 
      : 0;

    return {
      isAnalyzing: this.isAnalyzing,
      screenshotCount
    };
  }

  // Manual analysis trigger
  async analyzeNow(): Promise<ScreenAnalysis> {
    const screenshotBuffer = await this.captureScreen();
    return await this.analyzeScreenshot(screenshotBuffer);
  }
}