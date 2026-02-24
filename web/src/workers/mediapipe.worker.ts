// Web Worker for MediaPipe LLM inference — handles model loading and text generation off the main thread.

// Types for worker messages
interface WorkerMessage {
  type: string;
  id?: string;
  [key: string]: unknown;
}

interface InitMessage extends WorkerMessage {
  type: 'INIT';
  forceReload?: boolean;
}

interface InferMessage extends WorkerMessage {
  type: 'INFER';
  prompt: string;
}

interface StatusMessage extends WorkerMessage {
  type: 'STATUS';
  status: 'idle' | 'loading' | 'ready' | 'error';
  progress: number;
  message?: string;
}

interface ResultMessage extends WorkerMessage {
  type: 'RESULT';
  response: string;
  tokensGenerated: number;
  inferenceTime: number;
}

interface ErrorMessage extends WorkerMessage {
  type: 'ERROR';
  error: string;
}

// Store references to MediaPipe classes
let FilesetResolver: any = null;
let LlmInference: any = null;
let llmInference: any = null;

// Message queue for requests received before initialization
const messageQueue: InferMessage[] = [];

// Generate unique IDs for message correlation
let messageId = 0;
function generateId(): string {
  return `msg_${Date.now()}_${++messageId}`;
}

// Send message back to main thread
function sendMessage(message: WorkerMessage) {
  self.postMessage(message);
}

// Send status update
function sendStatus(status: StatusMessage['status'], progress: number, message?: string) {
  sendMessage({
    type: 'STATUS',
    status,
    progress,
    message,
  } as StatusMessage);
}

// Handle incoming messages
async function handleMessage(event: MessageEvent<WorkerMessage>) {
  const { type } = event.data;

  switch (type) {
    case 'INIT':
      await handleInit(event.data as InitMessage);
      break;
    case 'INFER':
      await handleInfer(event.data as InferMessage);
      break;
    case 'PING':
      sendMessage({ type: 'PONG' });
      break;
    default:
      sendMessage({
        type: 'ERROR',
        error: `Unknown message type: ${type}`,
      } as ErrorMessage);
  }
}

// Initialize MediaPipe
async function handleInit(message: InitMessage) {
  try {
    sendStatus('loading', 0, 'Starting initialization...');

    // Import MediaPipe modules
    sendStatus('loading', 10, 'Loading MediaPipe modules...');
    
    try {
      // Dynamic imports for MediaPipe
      const genai = await import('@mediapipe/tasks-genai');
      FilesetResolver = genai.FilesetResolver;
      LlmInference = genai.LlmInference;
    } catch (importError) {
      // If import fails, try using global scope
      if (typeof (self as any).FilesetResolver !== 'undefined') {
        FilesetResolver = (self as any).FilesetResolver;
        LlmInference = (self as any).LlmInference;
      } else {
        throw new Error('Failed to load MediaPipe modules. Please ensure the script is loaded correctly.');
      }
    }

    sendStatus('loading', 20, 'Creating fileset resolver...');

    // Create fileset resolver with WASM
    const filesetResolver = await FilesetResolver.forGenAiTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai/wasm'
    );

    sendStatus('loading', 40, 'Loading model...');

    // Load the model
    llmInference = await LlmInference.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: '/models/gemma3-1b-it-int4-web.task',
        delegate: 'GPU',
      },
      maxTokens: 512,
      temperature: 0.3,
      topK: 40,
    });

    sendStatus('loading', 90, 'Finalizing...');

    sendStatus('ready', 100, 'Model ready');

    // Process queued messages
    while (messageQueue.length > 0) {
      const queuedMessage = messageQueue.shift();
      if (queuedMessage) {
        await handleInfer(queuedMessage);
      }
    }

  } catch (error) {
    console.error('MediaPipe initialization error:', error);
    sendStatus('error', 0, error instanceof Error ? error.message : 'Unknown error');
  }
}

// Handle inference request
async function handleInfer(message: InferMessage) {
  const id = message.id || generateId();

  // If model not ready, queue the message
  if (!llmInference) {
    messageQueue.push(message);
    sendStatus('loading', 0, 'Model not ready, queuing request...');
    
    // If we're not already initializing, trigger initialization
    sendMessage({
      type: 'STATUS',
      status: 'loading',
      progress: 0,
      message: 'Model not loaded, initializing...',
    });
    return;
  }

  try {
    sendStatus('loading', 0, 'Processing...');

    const startTime = Date.now();

    // Run inference
    const systemPrompt = `You are AEGIS, a clinical triage AI assistant.
Analyze the patient's symptoms and provide a structured response.

IMPORTANT RULES:
1. Always respond with valid JSON
2. Extract ALL symptoms mentioned by the patient
3. Assess severity based on clinical urgency (high/medium/low)
4. Provide a concise clinical summary

JSON FORMAT:
{
  "symptoms": ["symptom1", "symptom2", ...],
  "severity": "high" | "medium" | "low",
  "summary": "brief clinical assessment"
}

Patient Input: ${message.prompt}

Provide your analysis in JSON format:`;

    const response = await llmInference.generateResponse(systemPrompt);

    const inferenceTime = Date.now() - startTime;
    const approximateWordCount = response.split(' ').length;

    sendStatus('ready', 100, 'Complete');

    sendMessage({
      type: 'RESULT',
      id,
      response,
      tokensGenerated: approximateWordCount,
      inferenceTime,
    } as ResultMessage);

  } catch (error) {
    console.error('Inference error:', error);
    sendMessage({
      type: 'ERROR',
      id,
      error: error instanceof Error ? error.message : 'Unknown inference error',
    } as ErrorMessage);
  }
}

// Set up message handler
self.onmessage = handleMessage;

// Send ready signal
sendStatus('idle', 0, 'Worker ready');

// Export for module usage (if needed)
export {};
