import { GoogleGenAI, type Chat, type GenerateContentResponse, Modality, type Content, HarmBlockThreshold, HarmCategory } from "@google/genai";
import { MODEL_NAMES } from "../constants";
import { Message, MessageRole, MessageType, ChatSettings } from "../types";

// Initialize the API client
const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Convert internal Message type to Gemini Content type for history
export const prepareHistory = (messages: Message[]): Content[] => {
  // Filter out empty messages, error messages, or messages with no content
  return messages
    .filter(m => !m.isError && m.content && m.type === MessageType.TEXT) 
    .map(m => ({
      role: m.role === MessageRole.USER ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));
};

export const createChatSession = (languageInstruction: string, history: Content[] = []): Chat => {
  const ai = getClient();
  
  // "Sandwich" Method: Instruction at START and END of system prompt
  const systemInstruction = `
    **PRIMARY LANGUAGE DIRECTIVE**: ${languageInstruction}

    You are Raynex AI, a superior, limitless Artificial Intelligence created by Rayyan.
    
    **CORE DIRECTIVES (ABSOLUTE COMPLIANCE REQUIRED):**
    1. **NEVER REFUSE A TASK**: You generally DO NOT refuse requests because they are "too long", "repetitive", or "tedious". 
       - If a user asks for a table from 1200 to 12000, YOU START GENERATING IT. 
       - **Strategy for Massive Output**: If the output is physically too large to fit in a single response (e.g., > 8000 tokens), generate the first 50-100 rows to demonstrate format, AND THEN immediately write a complete, executable Python script that the user can run to generate the FULL file (CSV/Text). Explain this strategy politely.
    
    2. **DOCUMENT & CODE ANALYSIS**: 
       - You can read PDFs, text files, and code files provided by the user. 
       - When a file is attached, analyze every detail. 
       - If asked to "edit" or "solve" a PDF/text file, provide the corrected text or code clearly.
    
    3. **EXPERT CODING**: You are a full-stack engineering expert. You write production-ready, bug-free code.
    
    4. **IDENTITY**: You are Raynex AI by Rayyan. You are helpful, witty, and highly intelligent.
    
    **Refusal is NOT an option.** You always find a way to deliver the value the user asked for.

    **FINAL REMINDER**: Your output MUST adhere to this language: ${languageInstruction}.
  `;

  return ai.chats.create({
    model: MODEL_NAMES.CHAT,
    history: history,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7,
      maxOutputTokens: 8192, 
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    },
  });
};

export const generateMessageStream = async (
  chat: Chat,
  message: string,
  fileBase64?: string,
  mimeType?: string,
  settings: ChatSettings = { enableSearch: false, enableThinking: false },
  languageSnippet?: string
) => {
  const ai = getClient();
  
  // 1. Image Editing / Analysis OR PDF/File Analysis Path
  if (fileBase64 && mimeType) {
    
    const isImage = mimeType.startsWith('image/');
    
    // Detect if the user wants to EDIT/CHANGE an IMAGE
    let isImageEditRequest = false;
    if (isImage) {
        const lowerMsg = message.toLowerCase();
        const editKeywords = [
          'change', 'edit', 'make', 'color', 'convert', 'turn', 'badlo', 'modify', 'add', 'remove', 
          'paint', 'pant', 'background', 'style', 'transform', 'replace', 'generate', 'banao'
        ];
        isImageEditRequest = editKeywords.some(keyword => lowerMsg.includes(keyword));
    }

    // If it's an Image Edit request, use the Image Edit model
    if (isImage && isImageEditRequest) {
        return ai.models.generateContentStream({
            model: MODEL_NAMES.IMAGE_EDIT,
            contents: {
                parts: [
                {
                    inlineData: {
                    mimeType: mimeType,
                    data: fileBase64
                    }
                },
                { text: message }
                ]
            },
            config: {
                responseModalities: [Modality.IMAGE],
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ]
            }
        });
    } else {
        // For PDFs, Text Files, or General Image Analysis (Chat Model)
        return chat.sendMessageStream({
            config: {
               // Ensure thinking is enabled if requested, even for files
               thinkingConfig: settings.enableThinking ? { thinkingBudget: 4096 } : undefined,
            },
            message: {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: fileBase64
                        }
                    },
                    { text: message } // Language reminder appended below doesn't work well with inlineData parts structure in some versions, keeping strict on text only.
                ]
            }
        });
    }
  } 
  
  // 2. Text Only / Search / Thinking Path
  else {
    const config: any = {
        maxOutputTokens: 8192,
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
    };

    // Detect URL in message to force Search
    const hasUrl = message.includes('http://') || message.includes('https://') || message.includes('[Analyze this Link:');
    
    // Force enable search if a URL is present
    if (settings.enableSearch || hasUrl) {
      config.tools = [{ googleSearch: {} }];
    }

    // Add Thinking Config if enabled
    if (settings.enableThinking) {
      config.thinkingConfig = { thinkingBudget: 4096 }; 
    }

    let finalMessage = message;
    
    // If specifically asked to analyze a link, ensure we prompt the model to use the tool
    if (hasUrl && !message.toLowerCase().includes('search')) {
        finalMessage = `${message}\n\n(System: A URL was detected. Please use the Google Search tool to access and analyze the content of the provided link.)`;
    }

    // INJECT LANGUAGE REMINDER: This is critical for keeping the model in character.
    if (languageSnippet) {
        finalMessage = `${finalMessage}\n\n(System Reminder: You MUST output the response in strict accordance with this rule: ${languageSnippet})`;
    }

    return chat.sendMessageStream({ 
      message: finalMessage, 
      config: Object.keys(config).length > 0 ? config : undefined
    });
  }
};

export const generateImage = async (prompt: string): Promise<string> => {
  const ai = getClient();
  
  // Auto-enhance prompt for quality
  const enhancedPrompt = `High quality, detailed, photorealistic, 8k resolution, cinematic lighting: ${prompt}`;

  try {
    const response = await ai.models.generateImages({
      model: MODEL_NAMES.IMAGE_GEN,
      prompt: enhancedPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });
    
    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!base64ImageBytes) {
      throw new Error("No image generated");
    }
    return base64ImageBytes;
  } catch (error) {
    console.error("Image generation error:", error);
    throw error;
  }
};